console.time('[MAIN] boot');
const { app, BrowserWindow, ipcMain, dialog, crashReporter } = require('electron');
const path = require('path');
const log = require('electron-log');

// Set AppUserModelID for Windows Taskbar
if (process.platform === 'win32') {
    app.setAppUserModelId('com.craftcorps.launcher'); // Matches package.json appId
}
app.setName('CraftCorps Launcher');

// Import Handlers - Moved to app.whenReady for faster startup

// Configure logging
log.transports.file.level = 'info';
log.transports.console.format = '[{h}:{i}:{s} {level}] {text}';
console.log = log.log;
Object.assign(console, log.functions);

// Crash Handling
app.setPath('crashDumps', path.join(app.getPath('userData'), 'crashDumps'));
// crashReporter.start deferred to post-load

log.errorHandler.startCatching();

process.on('uncaughtException', (error) => {
    log.error('CRITICAL: Uncaught Exception:', error);
    dialog.showErrorBox('Application Error', `An unexpected error occurred.\n\n${error.message}`);
});

process.on('unhandledRejection', (reason) => {
    log.error('CRITICAL: Unhandled Rejection:', reason);
});

let mainWindow;

const preloadPath = path.join(__dirname, 'preload.cjs');
console.log('Loading preload from:', preloadPath);

// Global reference
let store;

async function createWindow() {
    console.time('[MAIN] createWindow');
    const iconPath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '../public/icon.png')
        : path.join(__dirname, '../dist/icon.png');

    // Dynamic import for ESM module support
    if (!store) {
        const { default: Store } = await import('electron-store');
        store = new Store();
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

    console.time('[MAIN] loadURL');
    if (process.env.NODE_ENV === 'development') {
        await mainWindow.loadURL('http://localhost:5173');
    } else {
        await mainWindow.loadURL(startUrl);
    }
    console.timeEnd('[MAIN] loadURL');
}

// Helper to access mainWindow from handlers
const getMainWindow = () => mainWindow;

app.whenReady().then(async () => {
    console.time('[MAIN] registerHandlers');
    await createWindow();

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

    // Lazy: Instances
    lazyHandle('get-instances', () => {
        const { getInstances } = require('./handlers/gameHandler.cjs');
        return getInstances;
    });

    // Lazy: Mods & Resource Packs (Grouped)
    // We register these individually but they all trigger the same setup function
    // which replaces ALL of them with the real handlers.
    const modLoader = async () => {
        console.log('[IPC] Lazy loading Mod Handlers...');
        // We need to clean up the proxy handlers we just made
        // But since setupModHandlers clears them too, it's fine.
        const { setupModHandlers: setupMods } = require('./handlers/modHandler.cjs');
        setupMods(getMainWindow); // This replaces handlers

        // Return a handler function for the current request
        return () => [];
    };

    lazyHandle('get-instance-mods', modLoader);
    lazyHandle('get-instance-resource-packs', modLoader);


    // Lazy: Updates (Self-Upgrading)
    // We handle this manually to ensure setupUpdateHandlers is called to register events
    ipcMain.handle('check-for-updates', async (event, ...args) => {
        console.log('[IPC] Lazy loading updates...');
        ipcMain.removeHandler('check-for-updates'); // Remove this proxy
        const { setupUpdateHandlers, checkForUpdates } = require('./handlers/updateHandler.cjs');
        setupUpdateHandlers(getMainWindow); // Registers real handlers & events, overwrites others
        return checkForUpdates(event, ...args);
    });

    console.timeEnd('[MAIN] registerHandlers');
    console.timeEnd('[MAIN] boot');

    // Defer non-critical handlers and heavy requires
    mainWindow.webContents.once('did-finish-load', () => {
        console.timeEnd('[MAIN] first-paint-ish');
        if (process.env.NODE_ENV === 'development') console.log('[MAIN] Deferring non-critical handlers...');

        setTimeout(() => {
            // Initialize Crash Reporter
            crashReporter.start({
                productName: 'CraftCorps',
                companyName: 'CraftCorps Authors',
                submitURL: 'http://148.113.49.235:3000/crash-report',
                uploadToServer: true,
                compress: true,
                extra: { 'platform': process.platform }
            });

            // Heavy Imports - Run setups if they haven't been triggered by lazy loading yet
            // Note: setupXHandlers are safe to call multiple times because we added removal logic.

            const { setupJavaHandlers } = require('./handlers/javaHandler.cjs');
            const { setupGameHandlers } = require('./handlers/gameHandler.cjs');
            const { setupModHandlers } = require('./handlers/modHandler.cjs');
            const { setupImportHandlers } = require('./handlers/importHandler.cjs');
            const { setupUpdateHandlers } = require('./handlers/updateHandler.cjs');
            const { subscribeToNewsletter } = require('./handlers/marketingHandler.cjs');

            setupJavaHandlers(getMainWindow);
            setupGameHandlers(getMainWindow);
            console.log('[MAIN] Setting up Mod Handlers (Deferred)...');
            setupModHandlers(getMainWindow);
            setupImportHandlers();
            setupUpdateHandlers(getMainWindow); // It's safe to call again (removes/re-adds)
            ipcMain.handle('subscribe-newsletter', subscribeToNewsletter);

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
