const { ipcMain } = require('electron');

function setupWindowHandlers(getMainWindow) {
    ipcMain.on('window-minimize', () => getMainWindow()?.minimize());

    ipcMain.on('window-maximize', () => {
        const win = getMainWindow();
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    });

    ipcMain.on('window-close', () => getMainWindow()?.close());
    ipcMain.on('window-hide', () => getMainWindow()?.hide());
    ipcMain.on('window-show', () => getMainWindow()?.show());
}

module.exports = { setupWindowHandlers };
