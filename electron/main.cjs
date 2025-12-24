const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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
}

app.whenReady().then(() => {
    createWindow();

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

    // Game Launcher Integration
    const GameLauncher = require('./GameLauncher.cjs');
    const launcher = new GameLauncher();

    launcher.on('log', (log) => {
        mainWindow?.webContents.send('game-log', log);
    });

    launcher.on('progress', (data) => {
        mainWindow?.webContents.send('game-progress', data);
    });

    launcher.on('exit', (code) => {
        mainWindow?.webContents.send('game-exit', code);
    });

    ipcMain.on('launch-game', (event, options) => {
        // Here you would normally resolve paths to libraries/assets based on the version
        // For now, we pass the raw options or defaults
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
