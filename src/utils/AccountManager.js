/**
 * Centralized account management utility
 * Provides consistent access to active account data across the app
 */

class AccountManager {
    /**
     * Get the currently active account
     * @returns {Promise<Object>} Active account object with name, uuid, accessToken, etc.
     */
    static async getActiveAccount() {
        // Get from localStorage (where useAccounts hook stores it!)
        try {
            const saved = localStorage.getItem('craftcorps_active_account');
            if (saved) {
                const activeAccount = JSON.parse(saved);
                if (activeAccount && activeAccount.uuid) {
                    console.log('[AccountManager] ✅ Using active account from localStorage:', {
                        name: activeAccount.name,
                        type: activeAccount.type,
                        uuid: activeAccount.uuid?.substring(0, 8) + '...'
                    });
                    return activeAccount;
                }
            }
        } catch (e) {
            console.warn('[AccountManager] Failed to get local account:', e);
        }

        // Fallback to offline mode with device ID
        console.warn('[AccountManager] No active account found, using offline mode');
        try {
            if (window.electronAPI?.getDeviceId) {
                const deviceId = await window.electronAPI.getDeviceId();
                return {
                    name: 'Player',
                    uuid: deviceId,
                    accessToken: '0', // Proper offline token format
                    type: 'offline',
                    xuid: null
                };
            }
        } catch (e) {
            console.warn('[AccountManager] Failed to get device ID:', e);
        }

        // Last resort fallback
        return {
            name: 'Player',
            uuid: '00000000-0000-0000-0000-000000000000',
            accessToken: '0', // Proper offline token format
            type: 'offline',
            xuid: null
        };
    }

    /**
     * Build launch options for a game instance
     * @param {Object} instance - Instance data
     * @param {number} ram - RAM in GB
     * @param {string|null} server - Server address for auto-connect
     * @param {string} javaPath - Java executable path
     * @returns {Promise<Object>} Launch options ready for electronAPI.launchGame()
     */
    static async buildLaunchOptions(instance, ram, serverAddress = null, javaPath = null, accountOverride = null) {
        let account = accountOverride;
        if (!account) {
            account = await this.getActiveAccount();
        }

        if (!account) throw new Error('No active account found');

        return {
            version: instance.version,
            maxMem: ram * 1024, // GB to MB
            username: account.name,
            uuid: account.uuid,
            accessToken: account.accessToken,
            userType: account.type,
            xuid: account.xuid,
            useDefaultPath: !instance.path,
            gameDir: instance.path || null,
            server: serverAddress,
            javaPath: javaPath,
            loader: instance.loader,
            loaderVersion: instance.loaderVersion
        };
    }
}

export default AccountManager;
