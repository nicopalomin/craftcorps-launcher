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

    // Log update feed URL for debugging
    log.info('Auto-updater feed URL: https://download.craftcorps.net/');

    // Switch to generic provider to avoid GitHub API limits/errors
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://download.craftcorps.net/',
        channel: 'latest',
        useMultipleRangeRequest: false // Disable range requests to fix download issues
    });

    // Force using default request options (no proxy, standard headers)
    autoUpdater.requestHeaders = {
        'User-Agent': 'CraftCorps-Launcher',
        'Cache-Control': 'no-cache'
    };

    // Disable differential downloads (use full download instead)
    autoUpdater.disableDifferentialDownload = true;

    // Discord-style: auto-download updates silently
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

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
        log.error('Error stack:', err.stack);
        log.error('Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));

        // Check if this is a code signing error (macOS unsigned build)
        const isCodeSignError = err.message && err.message.includes('code signature');

        if (isCodeSignError) {
            const homedir = require('os').homedir();
            const updatePath = require('path').join(homedir, 'Library', 'Caches', 'craftcorps-launcher-updater', 'pending');

            log.warn('Code signing error detected. App is not signed. User will need to manually install.');
            safeSend('update-status', {
                status: 'manual-install-required',
                error: 'Auto-install requires code-signed app',
                updatePath: updatePath,
                reason: 'code-signing'
            });
        } else {
            safeSend('update-status', {
                status: 'error',
                error: err.message,
                errorCode: err.code,
                errorDetails: err.toString()
            });
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        // log.info(log_message); // Too verbose for file log usually?

        safeSend('update-status', { status: 'downloading', progress: progressObj });
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded. Auto-installing in 3 seconds...');
        safeSend('update-status', { status: 'downloaded', info });

        // Discord-style: auto quit and install after brief delay
        setTimeout(() => {
            try {
                log.info('Auto quit-and-install triggered');
                autoUpdater.quitAndInstall(true, true);
            } catch (err) {
                // If auto-install fails (e.g., code signing error on macOS)
                log.error('Auto-install failed:', err);
                const homedir = require('os').homedir();
                const updatePath = require('path').join(homedir, 'Library', 'Caches', 'craftcorps-launcher-updater', 'pending');

                safeSend('update-status', {
                    status: 'manual-install-required',
                    error: err.message,
                    updatePath: updatePath,
                    info: info
                });
            }
        }, 3000);
    });

    // --- IPC Handlers ---

    ipcMain.handle('check-for-updates', checkForUpdates);

    ipcMain.handle('download-update', async () => {
        try {
            log.info('Starting update download...');
            const result = await autoUpdater.downloadUpdate();
            log.info('Download initiated successfully');
            return result;
        } catch (error) {
            log.error('Failed to start download:', error);
            log.error('Download error stack:', error.stack);
            throw error;
        }
    });

    ipcMain.handle('quit-and-install', () => {
        autoUpdater.quitAndInstall(true, true);
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
