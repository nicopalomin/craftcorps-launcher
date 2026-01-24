console.time('[MAIN] boot');
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu } = require('electron');
const path = require('path');
const log = require('electron-log');
const telemetryService = require('./services/telemetryService.cjs');
const authService = require('./services/authService.cjs');
const playTimeService = require('./services/playTimeService.cjs');

// Set AppUserModelID for Windows Taskbar
const pkg = require('../package.json');
const isCanary = pkg.isCanary === true;

if (process.platform === 'win32') {
    app.setAppUserModelId(isCanary ? 'com.craftcorps.launcher.canary' : 'com.craftcorps.launcher');
}
app.setName(isCanary ? 'CraftCorps Canary' : 'CraftCorps Launcher');

// --- Instance Isolation & Profile Support ---
// This ensures that development, marketing shots, or different user profiles don't collide.
const profileArg = process.argv.find(arg => arg.startsWith('--profile='));
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const isMarketing = process.argv.includes('--marketing-shot');

if (profileArg || isDev || isMarketing) {
    let profileSuffix = 'dev';
    if (profileArg) profileSuffix = profileArg.split('=')[1];
    else if (isMarketing) profileSuffix = 'marketing';

    const currentDataPath = app.getPath('userData');
    const newDataPath = path.join(path.dirname(currentDataPath), `CraftCorps-${profileSuffix}`);

    app.setPath('userData', newDataPath);

    // Also isolate logs!
    if (log.transports && log.transports.file) {
        log.transports.file.resolvePathFn = () => path.join(newDataPath, 'logs', 'main.log');
    }

    log.info(`[MAIN] Instance Isolated. Profile: ${profileSuffix}`);
    log.info(`[MAIN] UserData Path: ${newDataPath}`);
}

if (isMarketing) {
    app.commandLine.appendSwitch('force-device-scale-factor', '2');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
    return;
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });
}

// Import Handlers - Moved to app.whenReady for faster startup

// Configure logging
log.transports.file.level = 'info';
log.transports.console.format = '[{h}:{i}:{s} {level}] {text}';
console.log = log.log;
Object.assign(console, log.functions);

let tray;
let mainWindow;

// Crash Handling
app.setPath('crashDumps', path.join(app.getPath('userData'), 'crashDumps'));
// crashReporter.start deferred to post-load

log.errorHandler.startCatching();

process.on('uncaughtException', (error) => {
    log.error('CRITICAL: Uncaught Exception:', error);
    telemetryService.trackCrash(error);
    dialog.showErrorBox('Application Error', `An unexpected error occurred.\n\n${error.message}`);
});

process.on('unhandledRejection', (reason) => {
    log.error('CRITICAL: Unhandled Rejection:', reason);
    telemetryService.trackCrash(reason instanceof Error ? reason : new Error(String(reason)));
});

const preloadPath = path.join(__dirname, 'preload.cjs');
console.log('Loading preload from:', preloadPath);

// Global reference
let store;

async function createWindow() {
    console.time('[MAIN] createWindow');
    const iconPath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '../public/images/cc-logo.png')
        : path.join(__dirname, '../dist/images/cc-logo.png');

    // Dynamic import for ESM module support
    // Dynamic import for ESM module support
    if (!store) {
        const { default: Store } = await import('electron-store');
        store = new Store();

        // Initialize Authentication Service (Critical Path)
        authService.init(store);

        // Defer Service Init (Telemetry & PlayTime) to avoid startup contention
        setTimeout(() => {
            telemetryService.init(store);
            playTimeService.init(store);
            playTimeService.syncPlayTime(); // Verify & Sync with Backend
        }, 5000);

        // Register PlayTime Listeners immediately (lightweight, handles missing store gracefully)
        ipcMain.handle('get-total-playtime', () => playTimeService.getTotalPlayTime());
        ipcMain.handle('get-instance-playtime', (e, id) => playTimeService.getInstancePlayTime(id));
        ipcMain.handle('get-playtime-breakdown', () => playTimeService.getBreakdown());
        ipcMain.handle('get-playtime-history', (e, start, end) => playTimeService.getHistory(start, end));
        ipcMain.handle('get-playtime-detailed', () => playTimeService.getDetailedStats());
        ipcMain.handle('get-playtime-daily', (e, date) => playTimeService.getDailyLog(date));
    }

    // Restore saved window state
    const { width, height } = store.get('windowBounds', { width: 1200, height: 800 });

    console.time('[MAIN] BrowserWindow ctor');
    mainWindow = new BrowserWindow({
        icon: iconPath,
        width: width,
        height: height,
        minWidth: 940,
        minHeight: 600,
        show: false,
        frame: false,
        transparent: false, // Disabled for faster startup
        backgroundColor: '#020617',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
    });
    console.timeEnd('[MAIN] BrowserWindow ctor');

    // Save window state on resize - Debounced
    let boundsTimer;
    function scheduleBoundsSave() {
        clearTimeout(boundsTimer);
        boundsTimer = setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                const { width, height } = mainWindow.getBounds();
                store.set('windowBounds', { width, height });
            }
        }, 300);
    }
    mainWindow.on('resize', scheduleBoundsSave);
    mainWindow.on('move', scheduleBoundsSave);

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('close', (e) => {
        if (app.isQuitting) return;

        try {
            const { isGameRunning } = require('./handlers/gameHandler.cjs');
            if (isGameRunning()) {
                e.preventDefault();
                mainWindow.hide();
                return;
            }
        } catch (err) {
            console.error('Failed to check game status on close:', err);
        }
    });

    console.time('[MAIN] loadURL');
    if (process.env.NODE_ENV === 'development') {
        await mainWindow.loadURL('http://localhost:51173');
    } else {
        await mainWindow.loadURL(startUrl);
    }
    console.timeEnd('[MAIN] loadURL');

    // Create Tray if not exists
    if (!tray) {
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show Launcher', click: () => mainWindow.show() },
            { type: 'separator' },
            {
                label: 'Quit', click: () => {
                    app.isQuitting = true;
                    app.quit();
                }
            }
        ]);
        tray.setToolTip('CraftCorps Launcher');
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => mainWindow.show());
    }
}

// Helper to access mainWindow from handlers
const getMainWindow = () => mainWindow;

app.whenReady().then(async () => {
    if (process.argv.includes('--marketing-shot')) {
        const { runMarketingShot } = require('./marketing.cjs');
        await runMarketingShot(app);
        return;
    }

    console.time('[MAIN] registerHandlers');

    // Critical Handlers - Load immediately
    const { setupWindowHandlers } = require('./handlers/windowHandler.cjs');
    const { setupAuthHandlers } = require('./handlers/authHandler.cjs');
    const { setupAppHandlers } = require('./handlers/appHandler.cjs');

    // Discord RPC - Registers handlers immediately, defers connection internally (lightweight)
    const { initDiscordRPC } = require('./discordRpc.cjs');
    initDiscordRPC();

    setupWindowHandlers(getMainWindow);
    setupAppHandlers(getMainWindow, store);
    setupAuthHandlers(getMainWindow);

    const { setupDiscoveryHandlers } = require('./handlers/discoveryHandler.cjs');
    setupDiscoveryHandlers();

    // --- Lazy Handlers (Performance) ---

    /**
     * Lazy register a handler. 
     * @param {string} channel 
     * @param {Function} loader Returns the function to handle the request
     */
    function lazyHandle(channel, loader) {
        let loaded = false;
        ipcMain.handle(channel, async (event, ...args) => {
            // If we are here, it means the handler is being called.
            // If we haven't loaded yet, load now.
            if (!loaded) {
                console.log(`[IPC] Lazy loading handler for ${channel}...`);
                const handlerFn = await loader();
                loaded = true;
                return handlerFn(event, ...args);
            }
            // If we are already loaded, we shouldn't be here IF we removed the handler?
            // Actually, if we simply return the function from loader, we are just executing the function.
            // We are NOT doing the "replace handler" trick here to avoid race conditions.
            // We just stick with the proxy for the life of the app? 
            // OR: If the delayed setup runs, it removes THIS handler and installs the native one.
            // IF the delayed setup has NOT run yet, we use this proxy.
            const handlerFn = await loader();
            return handlerFn(event, ...args);
        });
    }

    // Lazy: Java
    lazyHandle('get-available-javas', () => {
        const { getAvailableJavas } = require('./handlers/javaHandler.cjs');
        return getAvailableJavas;
    });

    lazyHandle('install-java', () => {
        const { handleInstallJava } = require('./handlers/javaHandler.cjs');
        return handleInstallJava(getMainWindow);
    });

    lazyHandle('cancel-java-install', () => {
        const { handleCancelJavaInstall } = require('./handlers/javaHandler.cjs');
        return handleCancelJavaInstall;
    });

    lazyHandle('pause-java-install', () => {
        const { handlePauseJavaInstall } = require('./handlers/javaHandler.cjs');
        return handlePauseJavaInstall;
    });

    lazyHandle('resume-java-install', () => {
        const { handleResumeJavaInstall } = require('./handlers/javaHandler.cjs');
        return handleResumeJavaInstall;
    });

    // Lazy: Instances
    lazyHandle('get-instances', () => {
        const { getInstances } = require('./handlers/gameHandler.cjs');
        return getInstances;
    });

    lazyHandle('get-instance-by-path', () => {
        const { getInstanceByPath } = require('./handlers/gameHandler.cjs');
        return getInstanceByPath;
    });

    // Lazy: Mods & Resource Packs & Modrinth
    let cachedModHandlers = null;
    const createModLoader = (channel) => async () => {
        if (!cachedModHandlers) {
            console.log('[IPC] Lazy loading Mod Handlers...');
            const { setupModHandlers: setupMods } = require('./handlers/modHandler.cjs');
            cachedModHandlers = setupMods(getMainWindow);
        }
        const handler = cachedModHandlers[channel];
        if (!handler) {
            console.error(`[IPC] No handler found for ${channel} after loading.`);
            return () => null;
        }
        return handler;
    };

    const modChannels = [
        'get-instance-mods', 'delete-mod', 'add-instance-mods', 'select-mod-files',
        'get-instance-resource-packs', 'select-resource-pack-files', 'add-instance-resource-packs', 'delete-resource-pack',
        'modrinth-cancel-install', 'modrinth-search', 'modrinth-get-tags',
        'modrinth-install-mod', 'modrinth-install-modpack',
        'modrinth-get-project', 'modrinth-get-projects', 'modrinth-get-versions'
    ];

    modChannels.forEach(channel => {
        lazyHandle(channel, createModLoader(channel));
    });

    // Lazy: Shaders
    let cachedShaderHandlers = null;
    const createShaderLoader = (channel) => async () => {
        if (!cachedShaderHandlers) {
            console.log('[IPC] Lazy loading Shader Handlers...');
            const { setupShaderPackHandlers } = require('./handlers/shaderPackHandler.cjs');
            cachedShaderHandlers = setupShaderPackHandlers();
        }
        const handler = cachedShaderHandlers[channel];
        if (!handler) {
            console.error(`[IPC] No handler found for ${channel} after loading.`);
            return () => null;
        }
        return handler;
    };

    const shaderChannels = [
        'get-instance-shaders', 'select-shader-files', 'add-instance-shaders', 'delete-shader'
    ];

    shaderChannels.forEach(channel => {
        lazyHandle(channel, createShaderLoader(channel));
    });



    // Lazy: Game Launch
    // Lazy: Game Launch
    ipcMain.on('launch-game', (event, ...args) => {
        console.log('[IPC] Lazy loading Game Launch...');
        const { setupGameHandlers } = require('./handlers/gameHandler.cjs');
        setupGameHandlers(getMainWindow);
        // Handler is now replaced. Re-emit logic.
        ipcMain.emit('launch-game', event, ...args);
    });

    // Lazy: Game Running Status
    lazyHandle('get-running-instances', () => {
        const { getRunningInstances } = require('./handlers/gameHandler.cjs');
        return getRunningInstances;
    });

    ipcMain.on('focus-game', (event, ...args) => {
        const { handleFocusGame } = require('./handlers/gameHandler.cjs');
        handleFocusGame(event, ...args);
    });

    lazyHandle('save-instance', () => {
        const { saveInstance } = require('./handlers/gameHandler.cjs');
        return saveInstance;
    });

    lazyHandle('delete-instance-folder', () => {
        const { deleteInstanceFolder } = require('./handlers/gameHandler.cjs');
        return deleteInstanceFolder;
    });

    lazyHandle('get-new-instance-path', () => {
        const { getNewInstancePath } = require('./handlers/gameHandler.cjs');
        return getNewInstancePath;
    });

    // Lazy: Import Handlers
    lazyHandle('import-instance-dialog', () => {
        const { handleImportDialog } = require('./handlers/importHandler.cjs');
        return handleImportDialog;
    });

    lazyHandle('perform-import-instance', () => {
        const { handlePerformImport } = require('./handlers/importHandler.cjs');
        return handlePerformImport;
    });

    // Lazy: Updates (Self-Upgrading)
    // We handle this manually to ensure setupUpdateHandlers is called to register events
    ipcMain.handle('check-for-updates', async (event, ...args) => {
        console.log('[IPC] Lazy loading updates...');
        ipcMain.removeHandler('check-for-updates'); // Remove this proxy
        const { setupUpdateHandlers, checkForUpdates } = require('./handlers/updateHandler.cjs');
        setupUpdateHandlers(getMainWindow); // Registers real handlers & events, overwrites others
        return checkForUpdates(event, ...args);
    });

    ipcMain.handle('subscribe-newsletter', async (event, email) => {
        const { subscribeToNewsletter } = require('./handlers/marketingHandler.cjs');
        return subscribeToNewsletter(event, email);
    });

    lazyHandle('get-minecraft-skin', () => {
        const { handleGetMinecraftSkin } = require('./handlers/skinHandler.cjs');
        return handleGetMinecraftSkin;
    });

    lazyHandle('upload-minecraft-skin', () => {
        const { handleUploadMinecraftSkin } = require('./handlers/skinHandler.cjs');
        return handleUploadMinecraftSkin;
    });

    lazyHandle('read-skin-file', () => {
        const { handleReadSkin } = require('./handlers/skinHandler.cjs');
        return handleReadSkin;
    });

    ipcMain.handle('show-open-dialog', async (event, options) => {
        const { dialog } = require('electron');
        return await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), options);
    });

    // Screenshot Tool (Shift+S) - Register immediately
    ipcMain.handle('capture-marketing-shot', async (event) => {
        const fs = require('fs');
        const win = getMainWindow();
        if (!win) return false;

        const marketingDir = path.join(app.getPath('userData'), 'marketing-shots');
        if (!fs.existsSync(marketingDir)) fs.mkdirSync(marketingDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rawPath = path.join(marketingDir, `shot-${timestamp}-raw.png`);
        const optimizedPath = path.join(marketingDir, `shot-${timestamp}.webp`);

        try {
            const img = await win.webContents.capturePage();
            const buffer = img.toPNG();
            fs.writeFileSync(rawPath, buffer);

            // Try optimize with Sharp if available
            try {
                const sharp = require('sharp');
                await sharp(buffer)
                    .webp({ quality: 80, effort: 6 })
                    .toFile(optimizedPath);

                // Clean up raw if successful
                fs.unlinkSync(rawPath);
                require('electron').shell.showItemInFolder(optimizedPath);
                return true;
            } catch (e) {
                console.error('Sharp optimization failed, keeping raw PNG:', e);
                require('electron').shell.showItemInFolder(rawPath);
                return true;
            }
        } catch (e) {
            console.error('Screenshot failed:', e);
            return false;
        }
    });

    await createWindow();
    console.timeEnd('[MAIN] registerHandlers');
    console.timeEnd('[MAIN] boot');

    // Defer non-critical handlers and heavy requires
    mainWindow.webContents.once('did-finish-load', () => {
        console.timeEnd('[MAIN] first-paint-ish');
        if (process.env.NODE_ENV === 'development') console.log('[MAIN] Deferring non-critical handlers...');

        setTimeout(() => {
            // Remove crashReporter, usage replaced by TelemetryService

            // Heavy Imports - Run setups if they haven't been triggered by lazy loading yet
            // Note: setupXHandlers are safe to call multiple times because we added removal logic.

            const { setupJavaHandlers } = require('./handlers/javaHandler.cjs');
            // const { setupGameHandlers } = require('./handlers/gameHandler.cjs'); // REMOVED: Loaded via lazy 'launch-game'
            const { setupModHandlers } = require('./handlers/modHandler.cjs');
            // const { setupImportHandlers } = require('./handlers/importHandler.cjs'); // REMOVED: Loaded via lazy
            const { setupUpdateHandlers } = require('./handlers/updateHandler.cjs');
            const { subscribeToNewsletter } = require('./handlers/marketingHandler.cjs');

            setupJavaHandlers(getMainWindow);
            // setupGameHandlers(getMainWindow); // REMOVED

            // setupImportHandlers(); // REMOVED
            setupUpdateHandlers(getMainWindow); // It's safe to call again (removes/re-adds)

            // Discord is already initted at top

        }, 1500);
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

app.on('will-quit', () => {
    try {
        const { saveModCacheToDisk } = require('./handlers/localModHandler.cjs');
        if (saveModCacheToDisk) saveModCacheToDisk();
    } catch (e) {
        // Module might not have been loaded or other error
    }
});
