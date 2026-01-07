const { Client } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

const VersionManager = require('./launcher/VersionManager.cjs');
const ForgeHandler = require('./launcher/ForgeHandler.cjs');
const FabricHandler = require('./launcher/FabricHandler.cjs');
const NeoForgeHandler = require('./launcher/NeoForgeHandler.cjs');

class GameLauncher extends EventEmitter {
    constructor() {
        super();
        this.isCancelled = false;
        this.lastError = null;
    }

    async launch(options) {
        // 1. Determine Paths
        const os = process.platform;
        const home = process.env.HOME || process.env.USERPROFILE;
        let commonRoot;
        if (os === 'win32') commonRoot = path.join(process.env.APPDATA, '.minecraft');
        else if (os === 'darwin') commonRoot = path.join(home, 'Library', 'Application Support', 'minecraft');
        else commonRoot = path.join(home, '.minecraft');

        let gameRoot = options.instancePath || options.gameDir || commonRoot;

        // 2. Bootstrap & Validation via VersionManager
        if (options.version) {
            try {
                const manifestPath = await VersionManager.bootstrapManifest(commonRoot, (t, m) => this.emit(t === 'log' ? 'log' : t, m), options.version);
                options.version = VersionManager.validateVersion(options.version, manifestPath, (t, m) => this.emit(t === 'log' ? 'log' : t, m));
            } catch (e) {
                if (e.summary) {
                    this.emit('launch-error', e);
                    this.emit('exit', 1);
                    return;
                }
            }
        }

        const launchOptions = {
            clientPackage: null, // Let MCLC handle it
            authorization: {
                access_token: options.accessToken || '000000',
                client_token: options.clientToken || '000000',
                uuid: options.uuid || '00000000-0000-0000-0000-000000000000',
                name: options.username || 'Player',
                user_properties: '{}',
                meta: { type: options.userType === 'Microsoft' ? 'msa' : 'mojang' }
            },
            root: commonRoot,
            version: {
                number: options.version || '1.16.5',
                type: 'release'
            },
            memory: {
                max: options.maxMem ? options.maxMem + "M" : "4G",
                min: options.maxMem ? options.maxMem + "M" : "4G" // Set Xms = Xmx for performance
            },
            javaPath: options.javaPath || 'java',
            customArgs: [
                // Platform specific
                ...(process.platform === 'darwin' ? [
                    '-Xdock:name=CraftCorps',
                    '-Xdock:icon=' + path.join(__dirname, '..', 'public', 'icon.png')
                ] : []),
                `-Duser.dir=${gameRoot}`, // Force working directory for old mods (ContentTweaker)
                // Aikar's Optimization Flags (Client Tuned)
                '-XX:+UseG1GC',
                '-XX:+ParallelRefProcEnabled',
                '-XX:MaxGCPauseMillis=200',
                '-XX:+UnlockExperimentalVMOptions',
                '-XX:+DisableExplicitGC',
                '-XX:+AlwaysPreTouch',
                '-XX:G1NewSizePercent=30',
                '-XX:G1MaxNewSizePercent=40',
                '-XX:G1HeapRegionSize=8M',
                '-XX:G1ReservePercent=20',
                '-XX:G1HeapWastePercent=5',
                '-XX:G1MixedGCCountTarget=4',
                '-XX:InitiatingHeapOccupancyPercent=15',
                '-XX:G1MixedGCLiveThresholdPercent=90',
                '-XX:G1RSetUpdatingPauseTimePercent=5',
                '-XX:SurvivorRatio=32',
                '-XX:+PerfDisableSharedMem',
                '-XX:MaxTenuringThreshold=1',
                '-Dsun.rmi.dgc.server.gcInterval=2147483646'
            ].filter((v, i, a) => a.indexOf(v) === i), // Dedupe just in case
            overrides: {
                detached: true,
                gameDirectory: gameRoot,
                cwd: gameRoot // Force CWD to instance folder for relative path mods (ZenScript)
            }
        };

        this.emit('log', { type: 'INFO', message: `Launch configured with Game Directory: ${gameRoot}` });
        this.emit('log', { type: 'INFO', message: `Launch configured with Common Root: ${commonRoot}` });

        // Ensure critical directories exist (Fix for picky mods like FancyMenu/Drippy)
        const dirsToEnsure = [
            'config',
            'mods',
            'saves',
            'screenshots',
            'local',
            path.join('config', 'fancymenu'),
            path.join('config', 'drippyloadingscreen'),
            'fancymenu_data'
        ];
        dirsToEnsure.forEach(d => {
            const p = path.join(gameRoot, d);
            if (!fs.existsSync(p)) {
                try {
                    fs.mkdirSync(p, { recursive: true });
                } catch (e) {
                    this.emit('log', { type: 'WARN', message: `Failed to create directory ${d}: ${e.message}` });
                }
            }
        });

        // 3. Mod Loader Handlers
        const emitShim = (type, message) => {
            // Handle 'log' {type, message} vs directly type, message
            if (typeof type === 'object' && type.type) {
                this.emit('log', type);
            } else {
                this.emit('log', { type: 'INFO', message: type }); // Fallback if called wrong
            }
        };

        // Also define a helper that matches the new handlers signatures: emit(type, data) or emit('log', {type, message})
        // The handlers were written to call emit('log', {...})
        const handlerEmit = (event, data) => this.emit(event, data);

        try {
            if (options.loader) {
                const lowerLoader = options.loader.toLowerCase();
                if (lowerLoader.includes('neoforge')) {
                    await NeoForgeHandler.prepare(options, launchOptions, handlerEmit);
                } else if (lowerLoader.includes('forge')) {
                    await ForgeHandler.prepare(options, launchOptions, handlerEmit);
                } else if (lowerLoader.includes('fabric')) {
                    await FabricHandler.prepare(options, launchOptions, handlerEmit);
                }
            }
        } catch (e) {
            this.emit('log', { type: 'ERROR', message: `Loader setup failed: ${e.message}` });
            this.emit('launch-error', {
                summary: `${options.loader} Installation Failed`,
                advice: e.message || "Could not install loader."
            });
            this.emit('exit', 1);
            return;
        }

        // 4. Server Auto-Connect
        if (options.server) {
            launchOptions.quickPlay = { type: 'multiplayer', identifier: options.server };
            this.emit('log', { type: 'INFO', message: `Auto-connecting to server: ${options.server}` });
        }

        // 5. Cleanup Corrupt Indexes (MCLC bug workaround)
        try {
            const versionId = launchOptions.version.number;
            const indexDir = path.join(launchOptions.root, 'assets', 'indexes');

            // Helper to check and delete bad index
            const checkIndex = (id) => {
                const indexFile = path.join(indexDir, `${id}.json`);
                if (fs.existsSync(indexFile)) {
                    let corrupt = false;
                    try {
                        const content = fs.readFileSync(indexFile, 'utf-8');
                        if (!content || content.trim().length === 0) {
                            corrupt = true;
                        } else {
                            JSON.parse(content); // Try parsing
                        }
                    } catch (e) {
                        corrupt = true;
                    }

                    if (corrupt) {
                        this.emit('log', { type: 'WARN', message: `Detected corrupt asset index for ${id}. Deleting to allow redownload.` });
                        fs.unlinkSync(indexFile);
                    }
                }
            };

            // Check loader version (e.g. fabric-loader-...)
            checkIndex(versionId);

            // Check base version (e.g. 1.21.1)
            // If ID contains "fabric" or "forge", try to extract the last part which is likely the game ver
            if (versionId.includes('fabric') || versionId.includes('forge')) {
                const parts = versionId.split('-');
                const lastPart = parts[parts.length - 1]; // "1.21.1" usually at end
                if (lastPart.match(/^\d+\.\d+(\.\d+)?$/)) { // Simple semver-ish check
                    checkIndex(lastPart);
                }
            }

        } catch (e) {
            this.emit('log', { type: 'WARN', message: `Asset index cleanup check failed: ${e.message}` });
        }

        this.isCancelled = false;
        this.lastError = null;
        this.client = new Client();

        // Attach Listeners
        this.client.on('data', (e) => {
            const line = e.toString().trim();
            this.emit('log', { type: 'INFO', message: `[Game Output] ${line}` });
            this.emit('game-output', line);
        });

        this.client.on('close', (e) => this.emit('log', { type: 'INFO', message: `[Game Exit] Code: ${e}` }));
        this.client.on('error', (e) => this.emit('log', { type: 'ERROR', message: `[MCLC Error] ${e}` }));

        this.client.on('debug', (e) => {
            const raw = e.toString();
            this.emit('log', { type: 'DEBUG', message: `[MCLC-Debug] ${raw}` });
            this.emit('game-output', raw);

            // Analysis
            if (raw.includes('SyntaxError') && raw.includes('JSON')) {
                this.lastError = { summary: 'Asset index corruption detected.', advice: 'The game asset index is corrupted. The launcher will attempt to fix this automatically on the next launch.' };

                // Enhanced Debugging: Inspect the suspicious asset index file
                try {
                    const versionId = launchOptions.version.number;
                    // For modded versions like fabric-loader-..., MCLC might be looking for the fabric JSON or the resolved vanilla JSON index?
                    // Usually it fails on the version's asset index.
                    // e.g. .minecraft/assets/indexes/1.19.json
                    // BUT for fabric 1.21.1 it might look for 1.21.1.json

                    // Let's check both possibilities to be helpful
                    const possibleFiles = [
                        path.join(launchOptions.root, 'assets', 'indexes', `${versionId}.json`),
                        path.join(launchOptions.root, 'assets', 'indexes', `${launchOptions.version.number}.json`)
                    ];

                    // If versionId has hyphens (fabric-loader-...), try to guess base version
                    if (versionId.includes('-')) {
                        const parts = versionId.split('-');
                        const last = parts[parts.length - 1]; // 1.21.1
                        possibleFiles.push(path.join(launchOptions.root, 'assets', 'indexes', `${last}.json`));
                    }

                    possibleFiles.forEach(f => {
                        if (fs.existsSync(f)) {
                            const stats = fs.statSync(f);
                            this.emit('log', { type: 'DEBUG', message: `[Debug-Check] Found index file: ${f}` });
                            this.emit('log', { type: 'DEBUG', message: `[Debug-Check] Size: ${stats.size} bytes` });

                            // Delete the corrupt file immediately to fix next launch
                            try {
                                fs.unlinkSync(f);
                                this.emit('log', { type: 'WARN', message: `[Auto-Fix] Deleted corrupt asset index: ${f}` });
                            } catch (delErr) {
                                this.emit('log', { type: 'ERROR', message: `[Auto-Fix] Failed to delete corrupt file: ${delErr.message}` });
                            }

                            if (stats.size < 1000) {
                                // It's small, print it
                                try {
                                    const content = fs.readFileSync(f, 'utf-8');
                                    this.emit('log', { type: 'DEBUG', message: `[Debug-Check] Content: ${content}` });
                                } catch (readErr) {
                                    this.emit('log', { type: 'DEBUG', message: `[Debug-Check] Could not read content: ${readErr.message}` });
                                }
                            }
                        } else {
                            this.emit('log', { type: 'DEBUG', message: `[Debug-Check] File does not exist: ${f}` });
                        }
                    });

                } catch (err) {
                    this.emit('log', { type: 'WARN', message: `[Debug-Check] Failed to run diagnostics: ${err.message}` });
                }

                // IMPORTANT: Abort launch to prevent getting stuck
                this.emit('log', { type: 'ERROR', message: '[Critical] Aborting launch due to JSON SyntaxError in assets.' });
                this.emit('launch-error', this.lastError);
                this.emit('exit', 1);
                this.isCancelled = true;
                return;
            }
            if (raw.includes('ENOTFOUND') && raw.includes('mojang')) {
                this.lastError = { summary: 'Network Error: Cannot reach Minecraft servers.', advice: 'Check internet.' };
            }
            if (raw.includes('EPERM') || raw.includes('EACCES')) {
                this.lastError = { summary: 'Permission Error', advice: 'Run as Admin?' };
            }
        });

        this.client.on('progress', (e) => {
            if (e.total === 0) return;
            let percent = Math.round((e.task / e.total) * 100);
            if (percent > 100) percent = 100;
            this.emit('progress', { type: e.type, task: e.task, total: e.total, percent });
        });

        this.emit('log', { type: 'INFO', message: `Starting MCLC for version ${launchOptions.version.number}` });

        this.client.launch(launchOptions).then((process) => {
            if (this.isCancelled) {
                if (process) process.kill();
                return;
            }
            if (process) {
                process.unref(); // Ensure game survives launcher exit
            }
            if (!process) {
                const errorInfo = this.lastError || { summary: "Game process failed to start.", advice: "Check game logs regarding the crash." };
                this.emit('launch-error', errorInfo);
                this.emit('exit', 1);
                return;
            }

            this.process = process;
            this.emit('log', { type: 'INFO', message: "Game process started!" });

            this.process.on('close', (code) => {
                this.process = null;
                this.emit('exit', code);
            });
        }).catch(e => {
            this.emit('log', { type: 'ERROR', message: `MCLC Launch Failure: ${e.message}` });
            this.emit('launch-error', { summary: "Internal Launcher Error", advice: e.message });
            this.emit('exit', 1);
        });
    }

    kill() {
        this.isCancelled = true;
        if (this.process) {
            this.process.kill();
            this.emit('log', { type: 'WARN', message: "Game killed by user." });
        }
    }
}

module.exports = GameLauncher;
