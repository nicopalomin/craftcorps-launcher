const { ipcMain } = require('electron');
const { authenticateMicrosoft, refreshMicrosoftAuth } = require('../microsoftAuth.cjs');
const authService = require('../services/authService.cjs');

const DEFAULT_CONSENT = {
    type: 'TOS_AND_PRIVACY',
    version: '2026-1-18'
};



function setupAuthHandlers(getMainWindow) {
    // --- Standard Auth ---

    ipcMain.handle('register', async (event, { email, password, username }) => {
        try {
            await authService.register(email, password, username);
            return { success: true };
        } catch (error) {
            console.error('[AuthHandler] Register failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('login', async (event, { email, password }) => {
        try {
            const data = await authService.login(email, password);
            return { success: true, data };
        } catch (error) {
            console.error('[AuthHandler] Login failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('logout', async () => {
        try {
            await authService.logout();
            return { success: true };
        } catch (error) {
            console.error('[AuthHandler] Logout failed:', error);
            return { success: false, error: error.message };
        }
    });

    // --- Microsoft Auth ---

    ipcMain.handle('microsoft-login', async (event, consent) => {
        try {
            const consentToRecord = consent || DEFAULT_CONSENT;

            // 1. Authenticate with Microsoft (Get Access Token)
            console.log('[AuthHandler] Starting Microsoft authentication window...');
            const msAccount = await authenticateMicrosoft(getMainWindow());
            console.log('[AuthHandler] Microsoft auth successful. User:', msAccount.name);

            // 2. Record Consent (Optional, but good practice before login if needed)
            try {
                await authService.recordConsent(consentToRecord);
            } catch (ignore) { }

            // 3. Login with Backend using MS Token
            console.log('[AuthHandler] Exchange Microsoft token for CraftCorps session...');
            const data = await authService.loginMicrosoft(msAccount.accessToken);
            console.log('[AuthHandler] Backend login successful. Received accessToken:', !!data.accessToken, 'refreshToken:', !!data.refreshToken);

            return { success: true, data, account: msAccount };
        } catch (error) {
            console.error('[AuthHandler] Microsoft Login Failed:', error);
            return { success: false, error: error.message || error };
        }
    });

    ipcMain.handle('link-microsoft', async (event, consent) => {
        try {
            const consentToRecord = consent || DEFAULT_CONSENT;

            // 1. Authenticate with Microsoft
            const msAccount = await authenticateMicrosoft(getMainWindow());

            // 2. Record Consent
            if (consentToRecord) {
                await authService.recordConsent(consentToRecord);
            }

            // 3. Link with Backend
            await authService.linkMicrosoft(msAccount.accessToken);

            return { success: true };
        } catch (error) {
            console.error('[AuthHandler] Microsoft Link Failed:', error);
            return { success: false, error: error.message || error };
        }
    });

    // --- Linking & Profiles ---

    ipcMain.handle('link-credentials', async (event, { email, password }) => {
        try {
            await authService.linkCredentials(email, password);
            return { success: true };
        } catch (error) {
            console.error('[AuthHandler] Link Credentials failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('link-profile', async (event, { profile, consent }) => {
        try {
            const consentToRecord = consent || DEFAULT_CONSENT;
            if (consentToRecord) {
                await authService.recordConsent(consentToRecord);
            }
            const result = await authService.linkProfile(profile);
            return { success: result };
        } catch (error) {
            console.error('[AuthHandler] Link profile failed:', error);
            return { success: false, error: error.message || error };
        }
    });

    // --- Utils ---

    ipcMain.handle('refresh-microsoft-token', async (event, refreshToken) => {
        try {
            const account = await refreshMicrosoftAuth(refreshToken);
            return { success: true, account };
        } catch (error) {
            console.error('Refresh Failed:', error);
            return { success: false, error: error.message || error };
        }
    });

    ipcMain.handle('refresh-backend-session', async () => {
        try {
            const success = await authService.refreshSession();
            return {
                success,
                accessToken: authService.token,
                refreshToken: authService.refreshToken
            };
        } catch (error) {
            console.error('[AuthHandler] Backend Refresh Failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-backend-token', async () => {
        return authService.token;
    });

    ipcMain.handle('detect-local-accounts', async () => {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const os = require('os');

            let mcPath;
            if (process.platform === 'win32') {
                mcPath = path.join(process.env.APPDATA, '.minecraft');
            } else if (process.platform === 'darwin') {
                mcPath = path.join(os.homedir(), 'Library', 'Application Support', 'minecraft');
            } else {
                mcPath = path.join(os.homedir(), '.minecraft');
            }

            const accountsPath = path.join(mcPath, 'launcher_accounts.json');

            try {
                const data = await fs.readFile(accountsPath, 'utf8');
                const json = JSON.parse(data);

                if (json.accounts) {
                    const accounts = Object.values(json.accounts)
                        .filter(acc => acc.type === 'msa' && acc.minecraftProfile)
                        .map(acc => ({
                            name: acc.minecraftProfile.name,
                            uuid: acc.minecraftProfile.id,
                            type: 'microsoft'
                        }));

                    return { success: true, accounts };
                }
            } catch (e) {
                // File not found or unreadable
                return { success: false, error: 'NO_LOCAL_ACCOUNTS' };
            }

            return { success: false, error: 'NO_LOCAL_ACCOUNTS' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    // --- Advanced Profile ---

    ipcMain.handle('get-user-profile', async () => {
        try {
            const profile = await authService.getUserProfile();
            return { success: true, profile };
        } catch (error) {
            console.error('[AuthHandler] Get Profile failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-invite-code', async () => {
        try {
            const code = await authService.getInviteCode();
            return { success: true, code };
        } catch (error) {
            console.error('[AuthHandler] Get Invite Code failed:', error);
            // Return null code instead of erroring out to UI
            return { success: false, code: null };
        }
    });

    ipcMain.handle('link-discord', async (event) => {
        try {
            const { BrowserWindow } = require('electron');
            const token = await authService.getToken();

            // Backend endpoint that starts the Discord OAuth flow for a logged-in user
            // We append a custom param to signal the backend to redirect to a launcher-friendly success page
            const authUrl = `https://api.craftcorps.net/auth/link/discord?client=launcher`;

            return new Promise((resolve) => {
                const authWindow = new BrowserWindow({
                    width: 500,
                    height: 800,
                    show: true,
                    parent: getMainWindow(),
                    modal: true,
                    autoHideMenuBar: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });

                let processed = false;

                const checkUrl = (url) => {
                    if (processed) return;

                    // Check for success signals
                    // Assuming backend redirects to .../success or returns a JSON with success
                    // Or we can check if it goes to a specific callback
                    if (url.includes('success=true') || url.includes('/link/success')) {
                        processed = true;
                        authWindow.close();
                        resolve({ success: true });
                    }
                    if (url.includes('error=')) {
                        processed = true;
                        authWindow.close();
                        resolve({ success: false, error: 'Discord interaction failed' });
                    }
                };

                // Inject Auth Header
                authWindow.webContents.on('will-navigate', (event, url) => checkUrl(url));
                authWindow.webContents.on('did-navigate', (event, url) => checkUrl(url));
                authWindow.webContents.on('will-redirect', (event, url) => checkUrl(url));

                authWindow.on('closed', () => {
                    if (!processed) resolve({ success: false, error: 'Cancelled by user' });
                });

                authWindow.loadURL(authUrl, {
                    extraHeaders: `Authorization: Bearer ${token}\n`
                });
            });

        } catch (error) {
            console.error('[AuthHandler] Link Discord failed:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { setupAuthHandlers };
