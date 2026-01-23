const { ipcMain } = require('electron');
const { authenticateMicrosoft, refreshMicrosoftAuth } = require('../microsoftAuth.cjs');
const authService = require('../services/authService.cjs');

const DEFAULT_CONSENT = {
    type: 'TOS_AND_PRIVACY',
    version: '2026-1-18'
};

function setupAuthHandlers(getMainWindow) {
    ipcMain.handle('microsoft-login', async (event, consent) => {
        try {
            // Use provided consent or fallback to hardcoded default (Implied Consent)
            const consentToRecord = consent || DEFAULT_CONSENT;

            if (!consentToRecord) {
                // Should not happen with default, but good for safety
                throw new Error('User consent (TOS/EULA) is required to login.');
            }

            // 1. Record Consent first
            await authService.recordConsent(consentToRecord);

            // 2. Perform Login
            const account = await authenticateMicrosoft(getMainWindow());

            // 3. Link Profile to User Account
            try {
                await authService.linkProfile({
                    uuid: account.uuid,
                    name: account.name,
                    authType: 'MOJANG'
                });
            } catch (linkErr) {
                console.error('[AuthHandler] Failed to auto-link profile:', linkErr);
            }

            return { success: true, account };
        } catch (error) {
            console.error('Login Failed:', error);
            return { success: false, error: error.message || error };
        }
    });

    ipcMain.handle('link-profile', async (event, { profile, consent }) => {
        try {
            // Always record consent if linking profile, using default if needed
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

    ipcMain.handle('refresh-microsoft-token', async (event, refreshToken) => {
        try {
            const account = await refreshMicrosoftAuth(refreshToken);
            return { success: true, account };
        } catch (error) {
            console.error('Refresh Failed:', error);
            return { success: false, error: error.message || error };
        }
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
}

module.exports = { setupAuthHandlers };
