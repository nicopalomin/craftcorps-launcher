const { ipcMain } = require('electron');
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
        // Auto-Detect Java Logic (Moved from main.cjs)
        let javaValid = false;
        if (options.javaPath && typeof options.javaPath === 'string') {
            try {
                if (fs.existsSync(options.javaPath)) {
                    const lower = path.basename(options.javaPath).toLowerCase();
                    if (lower.includes('java')) {
                        javaValid = true;
                        if (process.platform === 'win32' && lower === 'javaw.exe') {
                            options.javaPath = options.javaPath.replace(/javaw\.exe$/i, 'java.exe');
                            log.info(`[Launch] Swapped javaw.exe to java.exe: ${options.javaPath}`);
                        }
                    }
                }
            } catch (e) { }
        }

        if (!javaValid) {
            log.warn(`[Launch] Provided Java path '${options.javaPath}' invalid or missing. Attempting auto-detection...`);

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

            log.info(`[Launch] Required Java Version for ${options.version}: base ${v}`);
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
                if (managed) selectedJava = { path: managed, version: v };
            }

            if (selectedJava) {
                log.info(`[Launch] Auto-detected: ${selectedJava.path}`);
                options.javaPath = selectedJava.path;
                getMainWindow()?.webContents.send('game-log', { type: 'INFO', message: `Auto-selected Java ${selectedJava.version}: ${selectedJava.path}` });
                getMainWindow()?.webContents.send('java-path-updated', selectedJava.path);
            } else {
                log.warn(`[Launch] No suitable Java ${v} found.`);
                getMainWindow()?.webContents.send('game-log', { type: 'WARN', message: `No suitable Java ${v} found. Please install it.` });
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
}

module.exports = { setupGameHandlers };
