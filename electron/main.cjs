const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');

// Import Handlers - Moved to app.whenReady for faster startup

// Configure logging
log.transports.file.level = 'info';
log.transports.console.format = '[{h}:{i}:{s} {level}] {text}';
console.log = log.log;
Object.assign(console, log.functions);

// Crash Handling
app.setPath('crashDumps', path.join(app.getPath('userData'), 'crashDumps'));
const { crashReporter } = require('electron');

crashReporter.start({
    productName: 'CraftCorps',
    companyName: 'CraftCorps Authors',
    submitURL: 'http://148.113.49.235:3000/crash-report',
    uploadToServer: true,
    compress: true,
    extra: { 'platform': process.platform }
});

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

const Store = require('electron-store');
const store = new Store();

function createWindow() {
    const iconPath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, '../public/icon.png')
        : path.join(__dirname, '../dist/icon.png');

    // Restore saved window state
    const { width, height } = store.get('windowBounds', { width: 1200, height: 800 });

    mainWindow = new BrowserWindow({
        icon: iconPath,
        width: width,
        height: height,
        minWidth: 940,
        minHeight: 600,
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

    // Save window state on resize
    mainWindow.on('resize', () => {
        const { width, height } = mainWindow.getBounds();
        store.set('windowBounds', { width, height });
    });

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadURL(startUrl);
    }

    // Show immediately to feel faster (splash screen style)
    mainWindow.show();
    mainWindow.focus();

    mainWindow.once('ready-to-show', () => {
        // Just ensure focus/top if needed
        mainWindow.setAlwaysOnTop(true);
        mainWindow.setAlwaysOnTop(false);
    });
}

// Helper to access mainWindow from handlers
const getMainWindow = () => mainWindow;

app.whenReady().then(() => {
    createWindow();

    // Lazy load handlers to prioritize window creation
    const { initDiscordRPC } = require('./discordRpc.cjs');
    const { setupWindowHandlers } = require('./handlers/windowHandler.cjs');
    const { setupAuthHandlers } = require('./handlers/authHandler.cjs');
    const { setupJavaHandlers } = require('./handlers/javaHandler.cjs');
    const { setupAppHandlers } = require('./handlers/appHandler.cjs');
    const { setupGameHandlers } = require('./handlers/gameHandler.cjs');

    // Start Discord RPC
    initDiscordRPC();

    // --- Register Handlers ---
    setupWindowHandlers(getMainWindow);
    setupAuthHandlers(getMainWindow);
    setupJavaHandlers(getMainWindow);
    setupAppHandlers(getMainWindow);
    setupGameHandlers(getMainWindow);

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
