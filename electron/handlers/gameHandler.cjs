const { ipcMain, app } = require('electron');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');
const { setActivity } = require('../discordRpc.cjs');
const GameLauncher = require('../GameLauncher.cjs');
const JavaManager = require('../JavaManager.cjs');

function setupGameHandlers(getMainWindow) {
    const launcher = new GameLauncher();

    // --- Launcher Events ---
    launcher.on('log', (data) => {
        const { type, message } = data;
        // Log to file (Launcher/Sys logs only)
        if (type === 'ERROR') log.error(`[MCLC] ${message}`);
        else if (type === 'WARN') log.warn(`[MCLC] ${message}`);
        else if (type === 'DEBUG') console.log(`[DEBUG] ${message}`); // Log debugs to terminal
        else log.info(`[MCLC] ${message}`);

        // Forward to frontend
        getMainWindow()?.webContents.send('game-log', data);
    });

    launcher.on('game-output', (text) => {
        getMainWindow()?.webContents.send('game-log', { type: 'INFO', message: text });
    });

    launcher.on('progress', (data) => {
        getMainWindow()?.webContents.send('game-progress', data);
    });

    launcher.on('launch-error', (error) => {
        log.error(`[Main] Launch Error: ${error.summary}`);
        getMainWindow()?.webContents.send('launch-error', error);
    });

    launcher.on('exit', (code) => {
        log.info(`[Main] Game exited with code ${code}`);
        getMainWindow()?.webContents.send('game-exit', code);

        setActivity({
            details: 'In Launcher',
            state: 'Idling',
            startTimestamp: Date.now(),
            largeImageKey: 'icon',
            largeImageText: 'CraftCorps Launcher',
            instance: false,
        });

        if (code !== 0 && code !== -1 && code !== null) {
            log.error(`[Main] Game crashed with exit code ${code}`);
            getMainWindow()?.webContents.send('game-crash-detected', { code });
        }
    });

    // --- IPC Handlers ---
    ipcMain.on('launch-game', async (event, options) => {
        log.info(`[Launch] Received Request. GameDir: ${options.gameDir}, JavaPath: ${options.javaPath}, Version: ${options.version}`);

        // 1. Determine Required Java Version
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
        log.info(`[Launch] Version ${options.version} requires Java ${v}`);

        // 2. Validate Provided Path matches requirements
        let javaValid = false;
        if (options.javaPath && typeof options.javaPath === 'string') {
            try {
                if (fs.existsSync(options.javaPath)) {
                    const lower = path.basename(options.javaPath).toLowerCase();
                    if (lower.includes('java')) {
                        // Fix javaw -> java on Windows
                        if (process.platform === 'win32' && lower === 'javaw.exe') {
                            options.javaPath = options.javaPath.replace(/javaw\.exe$/i, 'java.exe');
                            log.info(`[Launch] Swapped javaw.exe to java.exe: ${options.javaPath}`);
                        }

                        // Check Version
                        log.info(`[Launch] Checking version of provided Java: ${options.javaPath}`);
                        const actualVersion = JavaManager.getVersionFromBinary(options.javaPath);
                        log.info(`[Launch] Detected Java Version: ${actualVersion} (Required: ${v})`);

                        if (actualVersion >= v) {
                            javaValid = true;
                        } else {
                            log.warn(`[Launch] Java path ${options.javaPath} is version ${actualVersion}, but ${v} is required. Will attempt auto-detection.`);
                        }
                    }
                }
            } catch (e) {
                log.warn(`[Launch] Failed to validate provided Java path: ${e.message}`);
            }
        }

        // 3. Auto-Detect / Install if invalid provided path
        if (!javaValid) {
            log.warn(`[Launch] Java invalid or missing. Attempting auto-detection for Java ${v}...`);

            const allJavas = await JavaManager.scanForJavas();
            let selectedJava = null;

            if (v === 8) {
                selectedJava = allJavas.find(j => j.version === 8);
            } else {
                const candidates = allJavas.filter(j => j.version >= v);
                candidates.sort((a, b) => a.version - b.version); // Pick smallest valid version (e.g. 17 for 17, not 21, unless only 21 exists)

                // Prefer exact match if possible? 
                // Actually picking smallest valid is good (e.g. don't use 21 for 1.18 if 17 is available)
                if (candidates.length > 0) selectedJava = candidates[0];
            }

            // Check managed store specifically if scan failed
            if (!selectedJava) {
                const managed = await JavaManager.checkJava(v);
                // checkJava returns path string, verify it again just in case?
                // checkJava does internal version check so it is safe.
                if (managed) {
                    // get version again to be sure? checkJava returns path.
                    const ver = JavaManager.getVersionFromBinary(managed);
                    selectedJava = { path: managed, version: ver };
                }
            }

            if (selectedJava) {
                log.info(`[Launch] Auto-detected: ${selectedJava.path} (v${selectedJava.version})`);
                options.javaPath = selectedJava.path;
                getMainWindow()?.webContents.send('game-log', { type: 'INFO', message: `Auto-selected Java ${selectedJava.version}: ${selectedJava.path}` });
                getMainWindow()?.webContents.send('java-path-updated', selectedJava.path);
            } else {
                log.warn(`[Launch] No suitable Java ${v} found.`);

                // Prompt user or try to install?
                // Returning specific error code for frontend to prompt install
                getMainWindow()?.webContents.send('launch-error', {
                    summary: `Java ${v} is missing.`,
                    advice: `Please install Java ${v} (JDK ${v}) to play this version.`
                });
                return; // Stop launch
            }
        }

        setActivity({
            details: 'In Game',
            state: options.version ? `Playing Minecraft ${options.version}` : 'Playing Minecraft',
            startTimestamp: Date.now(),
            largeImageKey: 'icon',
            largeImageText: 'CraftCorps Launcher',
            instance: true,
        });

        launcher.launch(options);
    });

    ipcMain.on('stop-game', () => {
        launcher.kill();
    });
    ipcMain.handle('delete-instance-folder', async (event, folderPath) => {
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
    });

    ipcMain.handle('get-new-instance-path', async (event, name) => {
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
            // We don't create the folder yet, MCLC/launcher will do it, or we can do it now.
            // Better to do it now to reserve the name? 
            // Actually MCLC creates if not exists. 
            // But let's return the path. 
            // Also ensure we create the dir so the user can verify it exists if they click "Open Folder" immediately?
            fs.mkdirSync(finalPath, { recursive: true });

            return finalPath;
        } catch (e) {
            log.error(`Failed to generate instance path: ${e.message}`);
            return null;
        }
    });

}

module.exports = { setupGameHandlers };
