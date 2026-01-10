const { ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

function setupUpdateHandlers(getMainWindow) {
    ipcMain.removeHandler('check-for-updates');
    ipcMain.removeHandler('download-update');
    ipcMain.removeHandler('quit-and-install');

    // Configure logging
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';

    // Switch to generic provider to avoid GitHub API limits/errors
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://download.craftcorps.net/'
    });

    // Disable auto-downloading if you want to ask the user first
    // autoUpdater.autoDownload = false; 
    // For this implementation, let's keep it true for seamless updates, 
    // or we can make it false to show a "Update Available" button.
    // Let's go with autoDownload = false to give user control.
    autoUpdater.autoDownload = false;

    const safeSend = (channel, ...args) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send(channel, ...args);
        }
    };

    // --- Events ---

    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
        safeSend('update-status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Update available:', info);
        safeSend('update-status', { status: 'available', info });
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available:', info);
        safeSend('update-status', { status: 'not-available', info });
    });

    autoUpdater.on('error', (err) => {
        log.error('Error in auto-updater:', err);
        safeSend('update-status', { status: 'error', error: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        // log.info(log_message); // Too verbose for file log usually?

        safeSend('update-status', { status: 'downloading', progress: progressObj });
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded');
        safeSend('update-status', { status: 'downloaded', info });
    });

    // --- IPC Handlers ---

    ipcMain.handle('check-for-updates', checkForUpdates);

    ipcMain.handle('download-update', async () => {
        return autoUpdater.downloadUpdate();
    });

    ipcMain.handle('quit-and-install', () => {
        autoUpdater.quitAndInstall();
    });
}

const checkForUpdates = async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return result;
    } catch (e) {
        log.error('Failed to check for updates:', e);
        throw e;
    }
};

module.exports = { setupUpdateHandlers, checkForUpdates };
