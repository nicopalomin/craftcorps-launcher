const { ipcMain } = require('electron');
const { authenticateMicrosoft } = require('../microsoftAuth.cjs');

function setupAuthHandlers(getMainWindow) {
    ipcMain.handle('microsoft-login', async () => {
        try {
            const account = await authenticateMicrosoft(getMainWindow());
            return { success: true, account };
        } catch (error) {
            console.error('Login Failed:', error);
            return { success: false, error: error.message || error };
        }
    });
}

module.exports = { setupAuthHandlers };
