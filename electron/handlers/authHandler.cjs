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
        // Always record consent if linking profile, using default if needed
        const consentToRecord = consent || DEFAULT_CONSENT;
        if (consentToRecord) {
            await authService.recordConsent(consentToRecord);
        }
        return await authService.linkProfile(profile);
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
}

module.exports = { setupAuthHandlers };
