const { Client, Authenticator } = require('minecraft-launcher-core');
const path = require('path');
const EventEmitter = require('events');

class GameLauncher extends EventEmitter {
    constructor() {
        super();
        this.client = new Client();
        this.isCancelled = false;

        this.client.on('debug', (e) => this.emit('log', { type: 'INFO', message: e }));
        this.client.on('data', (e) => this.emit('log', { type: 'INFO', message: e }));
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

        this.isCancelled = false; // Reset cancel flag on new launch

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
                this.emit('log', { type: 'ERROR', message: "Game launch failed: No process returned. Please verify your Java path." });
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
                this.emit('log', { type: 'ERROR', message: `MCLC Error: ${e}` });
            }
        });
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
