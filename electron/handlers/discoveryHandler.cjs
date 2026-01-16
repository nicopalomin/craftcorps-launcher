const { ipcMain } = require('electron');
const authService = require('../services/authService.cjs');
const log = require('electron-log');

const API_BASE = 'https://api.craftcorps.net';

/**
 * Fetch discover servers from the backend
 */
async function getDiscoverServers(event, { offset = 0, limit = 9 }) {
    try {
        const token = await authService.getToken();
        const url = `${API_BASE}/servers/discover?offset=${offset}&limit=${limit}`;

        log.info(`[Discovery] Fetching servers from ${url}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        log.error('[Discovery] Failed to fetch servers:', error);
        return { success: false, error: error.message, servers: [] };
    }
}

function setupDiscoveryHandlers() {
    // Remove existing if any (hot reload safety)
    ipcMain.removeHandler('get-discover-servers');

    ipcMain.handle('get-discover-servers', getDiscoverServers);
}

module.exports = { setupDiscoveryHandlers };
