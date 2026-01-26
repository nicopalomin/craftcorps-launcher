const { ipcMain, app } = require('electron');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const GameLauncher = require('../GameLauncher.cjs');
const nbt = require('prismarine-nbt');

// Track multiple active launchers
// Key: launchId (string), Value: { gameDir, launcher, options }
const activeLaunchers = new Map();

function isGameRunning(gameDir) {
    if (gameDir) return Array.from(activeLaunchers.values()).some(d => d.gameDir === gameDir);
    return activeLaunchers.size > 0;
}

const playTimeService = require('../services/playTimeService.cjs');

function setupGameHandlers(getMainWindow) {
    const { setActivity } = require('../discordRpc.cjs');
    const JavaManager = require('../JavaManager.cjs');

    const safeSend = (channel, ...args) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send(channel, ...args);
        }
    };

    const emitRunningInstances = () => {
        const instances = Array.from(activeLaunchers.entries())
            .filter(([id, data]) => data.status === 'running')
            .map(([id, data]) => ({
                id,
                gameDir: data.gameDir,
                name: data.options.name || path.basename(data.gameDir),
                version: data.options.version,
                icon: data.options.icon,
                username: data.options.authorization?.name || data.options.username
            }));
        safeSend('running-instances-changed', instances);
    };

    // Clear existing handlers
    ipcMain.removeAllListeners('launch-game');
    ipcMain.removeAllListeners('stop-game');
    ipcMain.removeHandler('delete-instance-folder');
    ipcMain.removeHandler('get-instances');
    ipcMain.removeHandler('get-instance-by-path');
    ipcMain.removeHandler('save-instance');
    ipcMain.removeHandler('get-new-instance-path');
    ipcMain.removeHandler('get-running-instances');
    ipcMain.removeHandler('read-servers-dat');

    // --- IPC Handlers ---

    ipcMain.handle('get-running-instances', getRunningInstances);
    ipcMain.handle('read-servers-dat', readServersDat);

    ipcMain.on('launch-game', async (event, options) => {
        const gameDir = options.gameDir;
        const launchId = crypto.randomUUID();
        const launcher = new GameLauncher();
        activeLaunchers.set(launchId, { gameDir, launcher, options, status: 'launching' });
        // Don't emitRunningInstances yet, it's not 'running'

        // Local state for this instance
        let lastCrashReport = null;

        log.info(`[Launch] Received Request. ID: ${launchId}, GameDir: ${gameDir}, JavaPath: ${options.javaPath}, Version: ${options.version}`);

        // Start Tracking Play Time
        // Note: multiple instances of same game will overlap updates, acceptable for now.
        playTimeService.startSession(options.id || '0', {
            playerName: options.username,
            playerUuid: options.uuid,
            isOnline: options.userType !== 'offline'
        });

        // --- Instance Listeners ---
        launcher.on('started', () => {
            const data = activeLaunchers.get(launchId);
            if (data) {
                data.status = 'running';
                emitRunningInstances();
            }
        });

        launcher.on('log', (data) => {
            const { type, message } = data;
            // Log to backend file
            // UNHOOKED: Game logs are no longer written to main.log to save disk/perf
            // if (type === 'ERROR') log.error(`[MCLC][${path.basename(gameDir)}] ${message}`);
            // else if (type === 'WARN') log.warn(`[MCLC][${path.basename(gameDir)}] ${message}`);
            // else if (type === 'DEBUG') console.log(`[DEBUG][${path.basename(gameDir)}] ${message}`);
            // else log.info(`[MCLC][${path.basename(gameDir)}] ${message}`);

            // Detect Crash Report
            if (message.includes('Crash report saved to:')) {
                const match = message.match(/Crash report saved to:\s*(?:#@!@#)?\s*(.*)/);
                if (match && match[1]) {
                    lastCrashReport = match[1].trim();
                    log.info(`[Main] Detected crash report for ${path.basename(gameDir)}: ${lastCrashReport}`);
                }
            }

            // Forward to frontend with gameDir
            safeSend('game-log', { ...data, gameDir, launchId });
        });

        launcher.on('game-output', (text) => {
            safeSend('game-log', { type: 'INFO', message: text, gameDir, launchId });
        });

        launcher.on('progress', (data) => {
            safeSend('game-progress', { ...data, gameDir, launchId });
        });

        launcher.on('launch-error', (error) => {
            log.error(`[Main] Launch Error (${path.basename(gameDir)}): ${error.summary}`);
            safeSend('launch-error', { ...error, gameDir, launchId });
            playTimeService.stopSession(options.id || '0');
            activeLaunchers.delete(launchId);
            emitRunningInstances();
        });

        launcher.on('exit', (code) => {
            log.info(`[Main] Game (${path.basename(gameDir)}) exited with code ${code}`);
            safeSend('game-exit', { code, gameDir, launchId });

            // Stop Tracking Play Time
            playTimeService.stopSession(options.id || '0');
            activeLaunchers.delete(launchId);
            emitRunningInstances();

            // Update Discord RPC if no other games are running
            if (activeLaunchers.size === 0) {
                setActivity({
                    details: 'In Launcher',
                    state: 'Idling',
                    startTimestamp: Date.now(),
                    largeImageKey: 'icon',
                    largeImageText: 'CraftCorps Launcher',
                    instance: false,
                });
            }

            if (code !== 0 && code !== -1 && code !== null) {
                log.error(`[Main] Game crashed with exit code ${code}`);
                safeSend('game-crash-detected', { code, crashReport: lastCrashReport, gameDir, launchId });
            }
        });


        // --- Java Validation Logic (Scoped to this launch) ---
        let v = 17;
        if (options.version) {
            const parts = options.version.split('.');
            if (parts.length >= 2) {
                const minor = parseInt(parts[1]);
                if (minor >= 21) {
                    v = 21;
                } else if (minor === 20) {
                    if (parts.length > 2 && parseInt(parts[2]) >= 5) v = 21;
                    else v = 17;
                } else if (minor >= 17) {
                    v = 17;
                } else {
                    v = 8;
                }
            }
        }

        let javaValid = false;
        if (options.javaPath && typeof options.javaPath === 'string') {
            try {
                if (fs.existsSync(options.javaPath)) {
                    const lower = path.basename(options.javaPath).toLowerCase();
                    if (lower.includes('java')) {
                        if (process.platform === 'win32' && lower === 'javaw.exe') {
                            options.javaPath = options.javaPath.replace(/javaw\.exe$/i, 'java.exe');
                        }
                        const actualVersion = JavaManager.getVersionFromBinary(options.javaPath);
                        if (actualVersion === v || (v !== 8 && actualVersion >= v)) {
                            javaValid = true;
                        }
                    }
                }
            } catch (e) {
                log.warn(`[Launch] Failed to validate provided Java path: ${e.message}`);
            }
        }

        if (!javaValid) {
            log.warn(`[Launch] Java invalid/missing. Auto-detecting Java ${v}...`);
            const allJavas = await JavaManager.scanForJavas();
            let selectedJava = null;

            if (v === 8) {
                selectedJava = allJavas.find(j => j.version === 8);
            } else {
                const candidates = allJavas.filter(j => j.version >= v);
                candidates.sort((a, b) => a.version - b.version);
                if (candidates.length > 0) selectedJava = candidates[0];
            }

            if (!selectedJava) {
                const managed = await JavaManager.checkJava(v);
                if (managed) {
                    const ver = JavaManager.getVersionFromBinary(managed);
                    if (ver === v || (v !== 8 && ver >= v)) {
                        selectedJava = { path: managed, version: ver };
                    }
                }
            }

            if (selectedJava) {
                options.javaPath = selectedJava.path;
                safeSend('game-log', { type: 'INFO', message: `Auto-selected Java ${selectedJava.version}: ${selectedJava.path}` });
                safeSend('java-path-updated', selectedJava.path);
            } else {
                safeSend('launch-error', {
                    summary: `Java ${v} is missing.`,
                    advice: `Please install Java ${v} (JDK ${v}) to play this version.`
                });
                playTimeService.stopSession(gameDir);
                activeLaunchers.delete(launchId);
                return;
            }
        }

        // Set Discord RPC Activity for this launch
        setActivity({
            details: 'In Game',
            state: options.version ? `Playing Minecraft ${options.version}` : 'Playing Minecraft',
            startTimestamp: Date.now(),
            largeImageKey: 'icon',
            largeImageText: 'CraftCorps Launcher',
            instance: true,
        });

        // GO!
        launcher.launch(options);
    });

    ipcMain.on('stop-game', (event, target) => {
        if (target) {
            // Check if it's a specific launchId
            if (activeLaunchers.has(target)) {
                log.info(`[Main] Stopping specific launch ID: ${target}`);
                const data = activeLaunchers.get(target);
                if (data && data.launcher) data.launcher.kill();
                return;
            }

            log.info(`[Main] Stopping games for directory: ${target}`);
            // Stop ALL instances matching gameDir
            for (const [id, data] of activeLaunchers) {
                if (data.gameDir === target && data.launcher) {
                    data.launcher.kill();
                }
            }
        } else {
            // Stop ALL
            log.info(`[Main] Stopping ALL games (${activeLaunchers.size} active)`);
            for (const [id, data] of activeLaunchers) {
                if (data && data.launcher) {
                    data.launcher.kill();
                }
            }
        }
    });

    ipcMain.handle('delete-instance-folder', deleteInstanceFolder);

    /**
     * Get All Instances
     * Scans the instances directory for valid instance.json files
     */
    ipcMain.handle('get-instances', getInstances);

    /**
     * Get Single Instance by Path (Optimized for startup)
     */
    ipcMain.handle('get-instance-by-path', getInstanceByPath);

    /**
     * Save/Update Instance
     */
    ipcMain.handle('save-instance', saveInstance);

    ipcMain.handle('get-new-instance-path', getNewInstancePath);

    ipcMain.on('focus-game', handleFocusGame);

}

const getInstances = async () => {
    const userData = app.getPath('userData');
    const instancesDir = path.join(userData, 'instances');

    try {
        await fs.promises.mkdir(instancesDir, { recursive: true });
    } catch (e) {
        // ignore if exists
    }

    try {
        const dirs = await fs.promises.readdir(instancesDir, { withFileTypes: true });

        // Filter directories first
        const instanceDirs = dirs.filter(d => d.isDirectory());

        // Process in parallel
        const instances = await Promise.all(instanceDirs.map(async (dir) => {
            const fullPath = path.join(instancesDir, dir.name);
            const jsonPath = path.join(fullPath, 'instance.json');

            try {
                // Check existence concurrently
                // Using stat to check if file exists, or just read and catch
                const jsonContent = await fs.promises.readFile(jsonPath, 'utf8');
                const data = JSON.parse(jsonContent);
                data.path = fullPath;

                // Ensure ID exists
                if (!data.id) {
                    data.id = crypto.randomUUID();
                    await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 4));
                }

                // Load Icon concurrently if exists
                const iconPath = path.join(fullPath, 'icon.png');
                try {
                    // Try reading icon, if fails, no icon
                    const iconBuffer = await fs.promises.readFile(iconPath);
                    data.icon = `data:image/png;base64,${iconBuffer.toString('base64')}`;
                } catch (e) {
                    // No icon or read error
                }

                return data;
            } catch (e) {
                // Not an instance folder or corrupt, separate catch?
                // log.warn(`[Instance] Failed to parse ${dir.name}: ${e.message}`);
                return null;
            }
        }));

        // Filter out nulls
        return instances.filter(i => i !== null);

    } catch (e) {
        log.error(`[Instance] Failed to scan instances: ${e.message}`);
        return [];
    }
};



const getInstanceByPath = async (event, fullPath) => {
    // If called via IPC, event is first arg.
    const targetPath = (typeof event === 'string') ? event : fullPath;
    if (!targetPath) return null;

    try {
        const jsonPath = path.join(targetPath, 'instance.json');

        // Check if exists first to avoid throwing
        if (!fs.existsSync(jsonPath)) return null;

        const jsonContent = await fs.promises.readFile(jsonPath, 'utf8');
        const data = JSON.parse(jsonContent);
        data.path = targetPath;

        // Ensure ID exists
        if (!data.id) {
            data.id = crypto.randomUUID();
            await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 4));
        }

        // Load Icon
        const iconPath = path.join(targetPath, 'icon.png');
        try {
            const iconBuffer = await fs.promises.readFile(iconPath);
            data.icon = `data:image/png;base64,${iconBuffer.toString('base64')}`;
        } catch (e) {
            // No icon
        }

        return data;
    } catch (e) {
        log.warn(`[Instance] Failed to load instance from ${targetPath}: ${e.message}`);
        return null; // Return null effectively handles deleted instances
    }
};

const deleteInstanceFolder = async (event, folderPath) => {
    if (!folderPath) return { success: false, error: 'No path provided' };

    // Safety checks to prevent deleting system folders
    const norm = path.normalize(folderPath);
    const root = path.parse(norm).root;
    const appData = process.env.APPDATA || process.env.HOME;

    if (norm === root) return { success: false, error: 'Cannot delete root directory' };
    if (norm === appData) return { success: false, error: 'Cannot delete AppData/Home' };
    if (!norm.includes('craftcorps') && !norm.includes('.minecraft')) {
        // Extra paranoid check, though user might have custom paths.
        // Let's at least check it exists.
    }

    try {
        if (fs.existsSync(norm)) {
            log.info(`[Instance] Deleting instance folder: ${norm}`);
            fs.rmSync(norm, { recursive: true, force: true });
            return { success: true };
        } else {
            return { success: false, error: 'Folder does not exist' };
        }
    } catch (e) {
        log.error(`[Instance] Failed to delete folder ${norm}: ${e.message}`);
        return { success: false, error: e.message };
    }
};

const FabricHandler = require('../launcher/FabricHandler.cjs');
const ForgeHandler = require('../launcher/ForgeHandler.cjs');
const NeoForgeHandler = require('../launcher/NeoForgeHandler.cjs');
const QuiltHandler = require('../launcher/QuiltHandler.cjs');

const ensureLoaderInstalled = async (instanceData) => {
    if (!instanceData.loader || instanceData.loader === 'Vanilla') return;

    try {
        // Use Instance Folder as Root for Isolation (like Prism/MultiMC)
        // This ensures versions/mods/etc are self-contained or at least version json is checked locally if needed?
        // Wait, if we use instanceData.path as root, we duplicate assets/libraries?
        // MCLC has 'overrides' but core structure is usually shared.
        // However, user specifically asked to check isolated file. 
        // If we set root to instance folder, MCLC will look there.

        // Let's use the instance folder as the root for this setup check.
        const instanceRoot = instanceData.path;

        const options = {
            loader: instanceData.loader,
            version: instanceData.version,
            loaderVersion: instanceData.loaderVersion
        };

        const launchOptions = {
            root: instanceRoot, // Changed from commonRoot
            version: { number: instanceData.version }
        };

        const emit = (type, data) => {
            const msg = data && data.message ? data.message : data;
            log.info(`[LoaderSetup] ${msg}`);
        };

        const lower = instanceData.loader.toLowerCase();
        log.info(`[LoaderSetup] optimizing ${lower} setup for ${instanceData.version} in ${instanceRoot}...`);

        if (lower.includes('fabric')) await FabricHandler.prepare(options, launchOptions, emit);
        else if (lower.includes('neoforge')) await NeoForgeHandler.prepare(options, launchOptions, emit);
        else if (lower.includes('forge')) await ForgeHandler.prepare(options, launchOptions, emit);
        else if (lower.includes('quilt')) await QuiltHandler.prepare(options, launchOptions, emit);

    } catch (e) {
        log.error(`[LoaderSetup] Failed to install loader: ${e.message}`);
    }
};

const saveInstance = async (event, instanceData) => {
    if (!instanceData || !instanceData.path) return { success: false, error: 'Invalid instance data' };

    // Ensure ID
    if (!instanceData.id) {
        instanceData.id = crypto.randomUUID();
    }

    try {
        // Fix: getNewInstancePath already creates the folder, so we must check for instance.json to see if it's truly new content-wise
        const jsonPath = path.join(instanceData.path, 'instance.json');
        const isNewInstance = !fs.existsSync(jsonPath);

        if (!fs.existsSync(instanceData.path)) {
            fs.mkdirSync(instanceData.path, { recursive: true });
        }

        fs.writeFileSync(jsonPath, JSON.stringify(instanceData, null, 4));

        // Ensure Loader is Ready (Backgroud-ish but awaited for safety)
        await ensureLoaderInstalled(instanceData);

        // Auto-install Fabric API for new Fabric instances
        if (isNewInstance && instanceData.loader === 'Fabric') {
            log.info('[Instance] New Fabric instance detected. Auto-installing Fabric API...');
            // running in background to not block UI? No, user expects it to be ready.
            try {
                await installFabricApi(instanceData.path, instanceData.version);
            } catch (err) {
                log.warn(`[Instance] Failed to auto-install Fabric API: ${err.message}`);
                // Don't fail the whole creation, just warn
            }
        }

        return { success: true };
    } catch (e) {
        log.error(`[Instance] Failed to save instance: ${e.message}`);
        return { success: false, error: e.message };
    }
};

const getNewInstancePath = async (event, name) => {
    try {
        const userData = app.getPath('userData');
        const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const instancesDir = path.join(userData, 'instances');

        if (!fs.existsSync(instancesDir)) {
            fs.mkdirSync(instancesDir, { recursive: true });
        }

        // Uniquify
        let finalName = sanitized;
        let counter = 1;
        while (fs.existsSync(path.join(instancesDir, finalName))) {
            finalName = `${sanitized}_${counter}`;
            counter++;
        }

        const finalPath = path.join(instancesDir, finalName);
        fs.mkdirSync(finalPath, { recursive: true });

        return finalPath;
    } catch (e) {
        log.error(`Failed to generate instance path: ${e.message}`);
        return null;
    }
};

const getRunningInstances = async () => {
    return Array.from(activeLaunchers.entries())
        .filter(([id, data]) => data.status === 'running')
        .map(([id, data]) => ({
            id,
            gameDir: data.gameDir,
            name: data.options.name || path.basename(data.gameDir),
            version: data.options.version,
            icon: data.options.icon,
            username: data.options.authorization?.name || data.options.username
        }));
};

const handleFocusGame = (event, gameDir) => {
    if (!gameDir) return;

    // Find first match
    // Key is launchId, Value is object
    let match = null;
    for (const data of activeLaunchers.values()) {
        if (data.gameDir === gameDir) {
            match = data;
            break;
        }
    }

    if (match && match.launcher && match.launcher.process && match.launcher.process.pid) {
        const pid = match.launcher.process.pid;
        log.info(`[Main] Focusing game PID: ${pid}`);

        // Windows-specific focus
        if (process.platform === 'win32') {
            const { exec } = require('child_process');
            const cmd = `powershell -command "(New-Object -ComObject WScript.Shell).AppActivate(${pid})"`;
            exec(cmd, (err) => {
                if (err) log.error(`[Main] Failed to focus game: ${err.message}`);
            });
        }
    }
};

const installFabricApi = async (instancePath, gameVersion) => {
    const { DownloaderHelper } = require('node-downloader-helper');

    // 1. Fetch Version from Modrinth
    // Project ID: P7dR8mSH (fabric-api)
    // Facet: [["versions:1.20.1"], ["project_type:mod"]]
    // But easier to use /v2/project/{id}/version

    // Need valid json array for query params
    const gvParam = JSON.stringify([gameVersion]);
    const loaderParam = JSON.stringify(['fabric']);

    const url = `https://api.modrinth.com/v2/project/fabric-api/version?game_versions=${gvParam}&loaders=${loaderParam}`;

    log.info(`[FabricAPI] Fetching versions from: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Modrinth API returned ${res.status}`);

    const versions = await res.json();
    if (!versions || versions.length === 0) {
        throw new Error(`No Fabric API version found for Minecraft ${gameVersion}`);
    }

    const bestVer = versions[0]; // First one is usually latest
    const file = bestVer.files.find(f => f.primary) || bestVer.files[0];

    if (!file) throw new Error('No valid file found in version data');

    const modsDir = path.join(instancePath, 'mods');
    if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
    }

    log.info(`[FabricAPI] Downloading ${file.filename}...`);
    const dl = new DownloaderHelper(file.url, modsDir, {
        fileName: file.filename,
        override: true
    });

    await new Promise((resolve, reject) => {
        dl.on('end', () => resolve());
        dl.on('error', (err) => reject(err));
        dl.start();
    });

    log.info('[FabricAPI] Installed successfully.');
};

const readServersDat = async (event, instancePath) => {
    try {
        if (!instancePath) return [];
        const serversDatPath = path.join(instancePath, 'servers.dat');

        if (!fs.existsSync(serversDatPath)) {
            return [];
        }

        const data = await fs.promises.readFile(serversDatPath);

        // nbt.parse returns a Promise in newer versions or can be awaited
        const { parsed } = await nbt.parse(data);

        // Parse NBT Structure
        // Usually: { type: 'compound', value: { servers: { type: 'list', value: { type: 'compound', value: [...] } } } }

        let serversList = [];

        // Safe access using optional chaining
        // servers tag is a List. The List's value is an object { type: 'compound', value: [...] } usually for lists of compounds?
        // Actually prismarine-nbt structure for List is: { type: 'list', value: { type: 'compound', value: [ ...items... ] } }

        const serversTag = parsed?.value?.servers;
        if (serversTag?.value?.value && Array.isArray(serversTag.value.value)) {
            serversList = serversTag.value.value;
        }

        // Alternative structure check just in case
        if (serversList.length === 0 && parsed?.value?.servers?.value && Array.isArray(parsed.value.servers.value)) {
            serversList = parsed.value.servers.value;
        }

        log.info(`[ServersDat] Found ${serversList.length} servers in ${instancePath}`);

        // Map to clean object
        const validServers = serversList.map((s, idx) => {
            const name = s.name?.value || 'Minecraft Server';
            const ip = s.ip?.value || 'Unknown IP';
            let icon = s.icon?.value || null;

            // Debug first server
            if (idx === 0) {
                log.info(`[ServersDat] Server 1: Name=${name}, IP=${ip}, HasIcon=${!!icon}`);
                if (icon) log.info(`[ServersDat] Icon Start: ${icon.substring(0, 30)}...`);
            }

            if (icon && !icon.startsWith('data:image')) {
                icon = `data:image/png;base64,${icon}`;
            }

            return { name, ip, icon };
        });

        // Deduplicate by IP
        const seenIps = new Set();
        return validServers.filter(s => {
            if (seenIps.has(s.ip)) return false;
            seenIps.add(s.ip);
            return true;
        });

    } catch (e) {
        log.error(`[ServersDat] Failed to read ${instancePath}:`, e);
        return [];
    }
};

module.exports = {
    setupGameHandlers,
    getInstances,
    getInstanceByPath,
    saveInstance,
    deleteInstanceFolder,
    getNewInstancePath,
    isGameRunning,
    getRunningInstances,
    handleFocusGame,
    readServersDat
};
