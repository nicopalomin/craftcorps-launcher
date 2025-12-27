const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const { initDiscordRPC, setActivity } = require('./discordRpc.cjs');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.format = '[{h}:{i}:{s} {level}] {text}';
console.log = log.log; // Redirect console usage to electron-log handling
Object.assign(console, log.functions);

// Crash Handling (Fast & Free)
// Native Crash Reporting
app.setPath('crashDumps', path.join(app.getPath('userData'), 'crashDumps'));
const { crashReporter } = require('electron');

crashReporter.start({
    productName: 'CraftCorps',
    companyName: 'CraftCorps Authors',
    submitURL: 'http://148.113.49.235:3000/crash-report',
    uploadToServer: true,
    compress: true,
    extra: {
        'platform': process.platform
    }
});

// Crash Handling (Log-based)
log.errorHandler.startCatching(); // Built-in electron-log error catcher

process.on('uncaughtException', (error) => {
    log.error('CRITICAL: Uncaught Exception:', error);
    // Optional: Show error dialog
    dialog.showErrorBox('Application Error', `An unexpected error occurred.\n\n${error.message}`);
});

process.on('unhandledRejection', (reason) => {
    log.error('CRITICAL: Unhandled Rejection:', reason);
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) {
//     app.quit();
// }

let mainWindow;

const preloadPath = path.join(__dirname, 'preload.cjs');
console.log('Loading preload from:', preloadPath);

function createWindow() {
    const iconPath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '../public/icon.png')
        : path.join(__dirname, '../dist/icon.png');

    mainWindow = new BrowserWindow({
        icon: iconPath,
        width: 1200,
        height: 800,
        minWidth: 940,
        minHeight: 600,
        frame: false, // Custom frame
        transparent: true,
        backgroundColor: '#00000000', // Truly transparent for the rounded corners effect if css has it
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Required for contextBridge to reliably expose APIs in some environments
            nodeIntegration: false,
        },
    });

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadURL(startUrl);
        // mainWindow.webContents.openDevTools(); // Uncomment if needed for prod debug
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // Force window to top
        mainWindow.setAlwaysOnTop(true);
        mainWindow.setAlwaysOnTop(false);
        mainWindow.focus();
    });
}

app.whenReady().then(() => {
    createWindow();

    // --- Discord RPC Setup ---
    initDiscordRPC();

    // IPC Handlers

    ipcMain.on('window-minimize', () => mainWindow?.minimize());
    ipcMain.on('window-maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => mainWindow?.close());
    ipcMain.on('window-hide', () => mainWindow?.hide());
    ipcMain.on('window-show', () => mainWindow?.show());

    const { authenticateMicrosoft } = require('./microsoftAuth.cjs');
    ipcMain.handle('microsoft-login', async () => {
        try {
            const account = await authenticateMicrosoft(mainWindow);
            return { success: true, account };
        } catch (error) {
            console.error('Login Failed:', error);
            return { success: false, error: error.message || error };
        }
    });

    ipcMain.handle('select-file', async () => {
        const filters = process.platform === 'win32'
            ? [{ name: 'Executables', extensions: ['exe'] }]
            : []; // Allow any file on Mac/Linux (binaries usually have no extension)

        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: filters
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.on('renderer-log', (event, { level, message }) => {
        if (log[level]) {
            log[level](`[Renderer] ${message}`);
        } else {
            log.info(`[Renderer] ${message}`);
        }
    });

    ipcMain.handle('open-logs-folder', async () => {
        const logPath = log.transports.file.getFile().path;
        return shell.showItemInFolder(logPath);
    });

    const JavaManager = require('./JavaManager.cjs');

    ipcMain.handle('install-java', async (event, version = 17) => {
        try {
            // First check if we already have it
            const existing = await JavaManager.checkJava(version);
            if (existing) return existing;

            // If not, download
            await JavaManager.downloadAndInstall(version, (stats) => {
                mainWindow?.webContents.send('java-progress', stats);
            });

            // Return valid path
            return await JavaManager.checkJava(version);
        } catch (error) {
            // Don't log as error if it was just cancelled?
            log.error(`[JavaManager] Installation failed or checks: ${error}`);
            throw error;
        }
    });

    ipcMain.handle('cancel-java-install', () => JavaManager.cancelDownload());
    ipcMain.handle('pause-java-install', () => JavaManager.pauseDownload());
    ipcMain.handle('resume-java-install', async () => {
        return JavaManager.resumeDownload();
    });

    ipcMain.handle('get-available-javas', async () => {
        return JavaManager.scanForJavas();
    });
    // --- Manual Log Upload ---
    ipcMain.handle('upload-logs-manually', async () => {
        try {
            const logPath = log.transports.file.getFile().path; // Get the path to the main log file

            // Read the log file
            let logContent = '';
            try {
                if (fs.existsSync(logPath)) {
                    logContent = fs.readFileSync(logPath, 'utf8');
                } else {
                    logContent = 'Log file not found.';
                }
            } catch (err) {
                logContent = `Failed to read log file: ${err.message}`;
            }

            // Add system info for context
            const sysInfo = `
=== SYSTEM INFO ===
OS: ${process.platform} ${process.arch} ${typeof process.getSystemVersion === 'function' ? process.getSystemVersion() : 'Unknown Version'}
App Version: ${app.getVersion()}
Electron: ${process.versions.electron}
Date: ${new Date().toISOString()}
===================
            `;

            const finalContent = sysInfo + '\n' + logContent;

            // Upload
            // Electron 28+ has global fetch/FormData/Blob
            const blob = new Blob([finalContent], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('file', blob, 'manual_log_report.txt');

            const uploadUrl = 'http://148.113.49.235:3000/crash-report';

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}: ${response.statusText}`);

            return { success: true, message: 'Logs uploaded successfully.' };
        } catch (e) {
            log.error('Manual Log Upload Failed:', e);
            return { success: false, error: e.message };
        }
    });

    // Game Launcher Integration
    const GameLauncher = require('./GameLauncher.cjs');
    const launcher = new GameLauncher();

    launcher.on('log', (data) => {
        const { type, message } = data;
        // Log to file
        if (type === 'ERROR') log.error(`[MCLC] ${message}`);
        else if (type === 'WARN') log.warn(`[MCLC] ${message}`);
        else log.info(`[MCLC] ${message}`);

        // Forward to frontend
        mainWindow?.webContents.send('game-log', data);
    });

    launcher.on('progress', (data) => {
        mainWindow?.webContents.send('game-progress', data);
    });

    launcher.on('exit', (code) => {
        log.info(`[Main] Game exited with code ${code}`);
        mainWindow?.webContents.send('game-exit', code);

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
            // Auto-trigger detailed log dump? Or just let user know?
            // Sending a hint to frontend to maybe show a dedicated "Upload Logs" prompt
            mainWindow?.webContents.send('game-crash-detected', { code });
        }
    });

    ipcMain.on('launch-game', async (event, options) => {
        // Check if Java path is valid, if not, try to auto-detect
        let javaValid = false;
        if (options.javaPath && typeof options.javaPath === 'string') {
            try {
                if (fs.existsSync(options.javaPath)) {
                    // Start basic validation: filename must contain 'java'
                    const lower = path.basename(options.javaPath).toLowerCase();
                    if (lower.includes('java')) {
                        javaValid = true;
                    }
                }
            } catch (e) { }
        }

        if (!javaValid) {
            log.warn(`[Launch] Provided Java path '${options.javaPath}' invalid or missing (or not an executable). Attempting auto-detection...`);

            // Determine required Java version based on MC version
            let v = 17; // Default to 17
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

            // Scan widely for Javas
            const allJavas = await JavaManager.scanForJavas();
            log.info(`[Launch] System scan found ${allJavas.length} Java installations.`);

            let selectedJava = null;

            // Sort to find best match? 
            // We want closest to requirement, but newer is usually okay for >= 17

            // Strategy:
            // If v == 8: strict 8. (Unless user forces override, but usually 8)
            // If v >= 17: anything >= v. (Prefer closest?)

            if (v === 8) {
                // Try to find exactly 8
                selectedJava = allJavas.find(j => j.version === 8);
            } else {
                // Find all >= v
                const candidates = allJavas.filter(j => j.version >= v);
                // Sort ascending version (prefer 17 over 21 if 17 is requested? actually closer is safer)
                candidates.sort((a, b) => a.version - b.version);
                if (candidates.length > 0) selectedJava = candidates[0];
            }

            // Fallback: if we needed 8 but only have newer, maybe try newer? (Rarely works for modded 1.12, but for vanilla 1.12 it might run)
            // But per user request "do not force... if there are other versions available for the GIVEN java version"
            // "available for the GIVEN java version" implies matching the requirement.

            // Checking checkJava() as last resort (managed folder) if scan missed it?
            if (!selectedJava) {
                const managed = await JavaManager.checkJava(v);
                if (managed) selectedJava = { path: managed, version: v };
            }

            if (selectedJava) {
                log.info(`[Launch] Auto-detected suitable Java: ${selectedJava.path} (Version ${selectedJava.version})`);
                options.javaPath = selectedJava.path;
                // Emit log to frontend
                mainWindow?.webContents.send('game-log', { type: 'INFO', message: `Auto-selected Java ${selectedJava.version}: ${selectedJava.path}` });
                // Update frontend settings
                mainWindow?.webContents.send('java-path-updated', selectedJava.path);
            } else {
                log.warn(`[Launch] Could not find a suitable Java ${v} installation.`);
                mainWindow?.webContents.send('game-log', { type: 'WARN', message: `No suitable Java ${v} found. Please install it.` });
            }
        }

        // Here you would normally resolve paths to libraries/assets based on the version
        // For now, we pass the raw options or defaults
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

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
