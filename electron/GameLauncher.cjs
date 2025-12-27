const { Client, Authenticator } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class GameLauncher extends EventEmitter {
    constructor() {
        super();
        this.client = new Client();
        this.isCancelled = false;
        this.lastError = null;

        this.client.on('debug', (e) => {
            const raw = e.toString();
            // Don't emit generic info logs from game to main process file logger
            // this.emit('log', { type: 'INFO', message: raw });

            // Analyze for specific errors and emit user-friendly warnings
            if (raw.includes('SyntaxError') && raw.includes('JSON')) {
                this.lastError = {
                    summary: 'Asset index corruption detected.',
                    advice: 'We are attempting to clean up the corrupt file. Please try clicking Play again.'
                };
                this.emit('log', { type: 'ERROR', message: this.lastError.summary });
                this.emit('log', { type: 'WARN', message: this.lastError.advice });
            }

            if (raw.includes('ENOTFOUND') && raw.includes('mojang')) {
                this.lastError = {
                    summary: 'Network Error: Cannot reach Minecraft servers.',
                    advice: 'You seem to be offline or your DNS is blocked. Assets cannot be downloaded.'
                };
                this.emit('log', { type: 'ERROR', message: this.lastError.summary });
                this.emit('log', { type: 'WARN', message: this.lastError.advice });
            }

            if (raw.includes('EPERM') || raw.includes('EACCES')) {
                this.lastError = {
                    summary: 'Permission Error: Cannot write to game folder.',
                    advice: 'Close any open Minecraft instances, specific folder windows, or run the launcher as Administrator.'
                };
                this.emit('log', { type: 'ERROR', message: this.lastError.summary });
                this.emit('log', { type: 'WARN', message: this.lastError.advice });
            }
        });

        // Disable data logging to file, but we might want it for the Console Overlay.
        // The prompt says "Stop importing in-game logs into the application logs".
        // Application logs usually means the file/terminal output of the electron main process.
        // We still need to send it to the UI console overlay.

        // Current Flow: 
        // 1. client.on('data') -> emit('log')
        // 2. main.cjs: launcher.on('log') -> log.info(...) AND webContents.send('game-log')

        // We need to differentiate "Log to File" vs "Send to UI".
        // Let's emit a different event for raw game output vs app logs.
        this.client.on('data', (e) => this.emit('game-output', e.toString()));
        this.client.on('debug', (e) => this.emit('game-output', e.toString())); // Send debug to UI too? Often noisy. MCLC debug includes passwords sometimes? MCLC filters it usually.

        // Actually, let's just emit 'game-output' instead of 'log' for stdout
        // And update main.cjs to ONLY forward 'game-output' to UI, but NOT log it to electron-log.
        this.client.on('close', (e) => this.emit('exit', e));
        this.client.on('progress', (e) => {
            const percent = Math.round((e.task / e.total) * 100);
            this.emit('progress', {
                type: e.type,
                task: e.task,
                total: e.total,
                percent: percent
            });
            // Also log it for debugging/console history
            // this.emit('log', { type: 'INFO', message: `Downloading ${e.type}: ${percent}%` });
        });
        this.client.on('download-status', (e) => {
            // MCLC might emit this for overall file info
        });
    }

    launch(options) {
        // Resolve paths
        let rootPath = options.gameDir || process.cwd();

        if (options.useDefaultPath) {
            const os = process.platform;
            const home = process.env.HOME || process.env.USERPROFILE;
            if (os === 'win32') {
                rootPath = path.join(process.env.APPDATA, '.minecraft');
            } else if (os === 'darwin') {
                rootPath = path.join(home, 'Library', 'Application Support', 'minecraft');
            } else {
                rootPath = path.join(home, '.minecraft');
            }
        }

        const launchOptions = {
            clientPackage: null, // Let MCLC handle version manifest
            authorization: {
                access_token: options.accessToken || '',
                client_token: options.clientToken || '',
                uuid: options.uuid || '00000000-0000-0000-0000-000000000000',
                name: options.username || 'Player',
                user_properties: '{}',
                meta: { type: options.userType === 'Microsoft' ? 'msa' : 'mojang' }
            },
            root: rootPath,
            version: {
                number: options.version || '1.16.5', // "1.20.4"
                type: 'release'
            },
            memory: {
                max: options.maxMem ? options.maxMem + "M" : "4G",
                min: options.minMem ? options.minMem + "M" : "1G"
            },
            javaPath: options.javaPath || 'java',
            customArgs: process.platform === 'darwin' ? [
                '-Xdock:name=CraftCorps',
                '-Xdock:icon=' + path.join(__dirname, '..', 'public', 'icon.png')
            ] : [],
            overrides: {
                detached: false
            }
        };

        // Add server auto-connect if specified using quickPlay
        if (options.server) {
            launchOptions.quickPlay = {
                type: 'multiplayer',
                identifier: options.server
            };

            this.emit('log', { type: 'INFO', message: `Auto-connecting to server: ${options.server}` });
        }

        // Pre-launch check: Corruption in assets/indexes
        // MCLC crashes if the index file is empty (0 bytes), which happens if a previous download failed.
        // We proactively check and delete it to force redownload.
        try {
            const versionId = launchOptions.version.number;
            // The assets index generally matches the version ID for modern versions (1.7.10+)
            const indexFile = path.join(launchOptions.root, 'assets', 'indexes', `${versionId}.json`);
            if (fs.existsSync(indexFile)) {
                const stats = fs.statSync(indexFile);
                if (stats.size === 0) {
                    this.emit('log', { type: 'WARN', message: `Detected corrupt (empty) asset index for ${versionId}. Deleting to allow redownload.` });
                    fs.unlinkSync(indexFile);
                }
            }
        } catch (e) {
            this.emit('log', { type: 'WARN', message: `Failed to check asset index: ${e}` });
        }

        this.isCancelled = false; // Reset cancel flag on new launch
        this.lastError = null; // Reset last error

        this.emit('log', { type: 'INFO', message: `Starting MCLC for version ${launchOptions.version.number}` });
        this.emit('log', { type: 'INFO', message: `Root: ${launchOptions.root}` });
        this.emit('log', { type: 'INFO', message: `Java: ${launchOptions.javaPath}` });

        this.client.launch(launchOptions).then((process) => {
            if (this.isCancelled) {
                // User cancelled during download/prepare phase
                this.emit('log', { type: 'WARN', message: "Launch was cancelled by user. Killing spawned process immediately." });
                // If the process just spawned, kill it
                if (process) {
                    process.kill();
                }
                return;
            }

            if (!process) {
                const errorInfo = this.lastError || {
                    summary: "Game process failed to start.",
                    advice: `Please verify your Java path: ${launchOptions.javaPath}`
                };

                this.emit('launch-error', errorInfo);
                this.emit('log', { type: 'ERROR', message: `Game launch failed: ${errorInfo.summary}` });
                this.emit('exit', 1);
                return;
            }

            // MCLC returns the child process object on success
            this.process = process;
            this.emit('log', { type: 'INFO', message: "Game process started!" });

            this.process.on('close', (code) => {
                this.process = null;
                this.emit('exit', code);
            });

        }).catch((e) => {
            if (this.isCancelled) {
                this.emit('log', { type: 'INFO', message: "Launch aborted." });
            } else {
                const rawError = e.message || e.toString();
                const friendly = this.getFriendlyErrorMessage(rawError);

                this.emit('launch-error', friendly);
                this.emit('log', { type: 'ERROR', message: `Launch Error: ${friendly.summary}` });
                if (friendly.advice) {
                    this.emit('log', { type: 'WARN', message: `Advice: ${friendly.advice}` });
                }

                // Detailed technical log
                this.emit('log', { type: 'DEBUG', message: `Raw Trace: ${rawError}` });
            }
        });
    }

    getFriendlyErrorMessage(errorMsg) {
        const msg = errorMsg.toLowerCase();

        if (msg.includes('enoent') && msg.includes('java')) {
            return {
                summary: "Java executable not found.",
                advice: "Go to Settings and ensure the correct Java path is selected. Try 'Auto-Detect'."
            };
        }
        if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
            return {
                summary: "Network error: Could not reach Minecraft servers.",
                advice: "Check your internet connection. Mojang's servers might be blocked or down."
            };
        }
        if (msg.includes('eperm') || msg.includes('eacces') || msg.includes('operation not permitted')) {
            return {
                summary: "File Permission Error.",
                advice: "The launcher cannot write to the game folder. Try running as Administrator, or check if an Antivirus is blocking the file."
            };
        }
        if (msg.includes('syntaxerror') && msg.includes('json')) {
            return {
                summary: "Corrupted Game Assets.",
                advice: "A game configuration file is corrupt. We attempted to fix it, please try clicking Play again."
            };
        }
        if (msg.includes('401') || msg.includes('unauthorized')) {
            return {
                summary: "Authentication Failed.",
                advice: "Your session may have expired. Please log out and log back in."
            };
        }

        return {
            summary: "An unexpected error occurred during launch.",
            advice: "Check the console logs for more details. You may need to update Java or reinstall the game instance."
        };
    }

    kill() {
        if (this.process) {
            const pid = this.process.pid;
            try {
                require('tree-kill')(pid, 'SIGKILL', (err) => {
                    if (err) {
                        this.emit('log', { type: 'ERROR', message: `Failed to kill process: ${err.message}` });
                    } else {
                        this.emit('log', { type: 'INFO', message: 'Process killed by user (tree-kill).' });
                        this.process = null;
                        this.emit('exit', -1);
                    }
                });
            } catch (e) {
                this.emit('log', { type: 'ERROR', message: `Kill error: ${e}` });
            }
        } else {
            // Stopping during download/prep phase
            this.emit('log', { type: 'WARN', message: 'Aborting launch sequence...' });

            // MCLC doesn't have a public cancel(), but we can try to destroy the instance 
            // or at least signal the UI that we are done. 
            // The actual download might continue in background node process until completed
            // but we won't launch the game.

            // To "cancel", we basically ignore the upcoming launch promise resolution
            // and we set a flag 'isCancelled' if we were to implement robust cancellation.
            // But MCLC is a black box once started.
            // Best we can do: logic to prevent Process start if user cancelled.
            this.isCancelled = true;
            this.emit('exit', -1);
        }
    }
}

module.exports = GameLauncher;
