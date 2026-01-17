const { ipcMain } = require('electron');
const authService = require('../services/authService.cjs');
const log = require('electron-log');

const API_BASE = 'https://api.craftcorps.net';



/**
 * Fetch discover servers from the backend
 */
async function getDiscoverServers(event, { offset = 0, limit = 9, category = 'all', version, language, query }) {
    try {
        let url = `${API_BASE}/servers/discover?offset=${offset}&limit=${limit}&category=${category}`;
        if (version) url += `&version=${encodeURIComponent(version)}`;
        if (language) url += `&language=${encodeURIComponent(language)}`;
        if (query) url += `&query=${encodeURIComponent(query)}`;

        log.info(`[Discovery] Fetching servers from ${url}`);

        const response = await authService.fetchAuthenticated(url, {
            headers: {
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

async function getDiscoverCategories(event) {
    try {
        const url = `${API_BASE}/servers/categories`;

        const response = await authService.fetchAuthenticated(url);

        if (!response.ok) throw new Error('Failed to fetch categories');
        return await response.json();
    } catch (error) {
        log.error('[Discovery] Failed to fetch categories', error);
        return { success: false, categories: [] };
    }
}

async function joinServer(event, payload) {
    try {
        const url = `${API_BASE}/servers/join`;

        const response = await authService.fetchAuthenticated(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Join failed');
        return await response.json();
    } catch (error) {
        log.error('[Discovery] Join failed', error);
        return { success: false, error: error.message };
    }
}

async function getDiscoverMetadata(event) {
    try {
        const url = `${API_BASE}/servers/metadata`;

        const response = await authService.fetchAuthenticated(url);

        if (!response.ok) throw new Error('Failed to fetch metadata');
        return await response.json();
    } catch (error) {
        log.error('[Discovery] Failed to fetch metadata', error);
        return { success: false, categories: [], versions: [], languages: [] };
    }
}

function setupDiscoveryHandlers() {
    ipcMain.removeHandler('get-discover-servers');
    ipcMain.removeHandler('get-discover-categories');
    ipcMain.removeHandler('join-server');

    ipcMain.handle('get-discover-servers', getDiscoverServers);
    ipcMain.handle('get-discover-categories', getDiscoverCategories);
    ipcMain.handle('join-server', joinServer);
    ipcMain.handle('get-discover-metadata', getDiscoverMetadata);
}

module.exports = { setupDiscoveryHandlers };
