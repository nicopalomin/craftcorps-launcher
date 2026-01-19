const { ipcMain } = require('electron');
const log = require('electron-log');
const JavaManager = require('../JavaManager.cjs');

function setupJavaHandlers(getMainWindow) {
    ipcMain.removeHandler('install-java');
    ipcMain.removeHandler('cancel-java-install');
    ipcMain.removeHandler('pause-java-install');
    ipcMain.removeHandler('resume-java-install');
    ipcMain.removeHandler('get-available-javas');

    ipcMain.handle('install-java', handleInstallJava(getMainWindow));
    ipcMain.handle('cancel-java-install', handleCancelJavaInstall);
    ipcMain.handle('pause-java-install', handlePauseJavaInstall);
    ipcMain.handle('resume-java-install', handleResumeJavaInstall);
    ipcMain.handle('get-available-javas', getAvailableJavas);
}

const handleInstallJava = (getMainWindow) => async (event, version = 17) => {
    try {
        // First check if we already have it
        const existing = await JavaManager.checkJava(version);
        if (existing) return existing;

        // If not, download
        await JavaManager.downloadAndInstall(version, (stats) => {
            const win = getMainWindow();
            if (win && !win.isDestroyed()) {
                win.webContents.send('java-progress', stats);
            }
        });

        // Return valid path
        return await JavaManager.checkJava(version);
    } catch (error) {
        log.error(`[JavaManager] Installation failed or checks: ${error}`);
        throw error;
    }
};

const handleCancelJavaInstall = () => JavaManager.cancelDownload();
const handlePauseJavaInstall = () => JavaManager.pauseDownload();
const handleResumeJavaInstall = async () => {
    return JavaManager.resumeDownload();
};

const getAvailableJavas = async () => {
    return JavaManager.scanForJavas();
};

module.exports = {
    setupJavaHandlers,
    getAvailableJavas,
    handleInstallJava,
    handleCancelJavaInstall,
    handlePauseJavaInstall,
    handleResumeJavaInstall
};
