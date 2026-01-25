const { ipcMain } = require('electron');
const authService = require('../services/authService.cjs');
const { handleSmartJoin, pingServer, findCompatibleInstance } = require('../services/smartJoinService.cjs');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.craftcorps.net';

/**
 * Fetch discover servers from the backend
 */
async function getDiscoverServers(event, payload = {}) {
    log.info('[DiscoveryHandler] get-discover-servers IPC INVOKED', payload);
    const { offset = 0, limit = 9, category = 'all', version, language, query, isOfflineAccount } = payload;
    try {
        let url = `${API_BASE}/servers/discover?offset=${offset}&limit=${limit}&category=${category}`;
        if (version) url += `&version=${encodeURIComponent(version)}`;
        if (language) url += `&language=${encodeURIComponent(language)}`;
        if (query) url += `&query=${encodeURIComponent(query)}`;
        if (isOfflineAccount) url += `&offlineMode=true`;


        log.info(`[Discovery] Fetching servers from ${url}`);

        const response = await authService.fetchAuthenticated(url, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        log.info(`[Discovery] API Response status: ${response.status} for ${url}`);

        if (!response.ok) {
            log.error(`[Discovery] API Error: ${response.status} ${response.statusText}`);
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
    log.info('[DiscoveryHandler] getDiscoverCategories IPC INVOKED');
    try {
        const url = `${API_BASE}/servers/categories`;

        const response = await authService.fetchAuthenticated(url);

        if (!response.ok) throw new Error('Failed to fetch categories');
        return await response.json();
    } catch (error) {
        log.error('[Discovery] Failed to fetch categories', error);
        return [];
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

async function createServer(event, { ip }) {
    try {
        const url = `${API_BASE}/servers/create`;
        const response = await authService.fetchAuthenticated(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
        if (!response.ok) throw new Error('Failed to create server');
        return await response.json();
    } catch (error) {
        log.error('[Discovery] Create server failed', error);
        return { success: false, error: error.message };
    }
}

async function verifyServer(event, { ownerUuid, verificationCode }) {
    try {
        const url = `${API_BASE}/servers/verify`;
        const response = await authService.fetchAuthenticated(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerUuid, verificationCode })
        });
        if (!response.ok) throw new Error('Failed to verify server');
        return await response.json();
    } catch (error) {
        log.error('[Discovery] Verify server failed', error);
        return { success: false, error: error.message };
    }
}

async function voteServer(event, { serverId, voterUuid, verificationString }) {
    try {
        const url = `${API_BASE}/servers/vote`;
        const response = await authService.fetchAuthenticated(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId, voterUuid, verificationString })
        });
        if (!response.ok) throw new Error('Failed to vote server');
        return await response.json();
    } catch (error) {
        log.error('[Discovery] Vote server failed', error);
        return { success: false, error: error.message };
    }
}

/**
 * Smart join handler - uses the comprehensive smart join flow
 */
async function smartJoinServer(event, { serverIp, serverData, selectedInstancePath }) {
    // Import actual game handler methods
    const { getInstances, getNewInstancePath, saveInstance } = require('./gameHandler.cjs');

    const dependencies = {
        getInstances: async () => {
            try {
                return await getInstances();
            } catch (e) {
                log.error('[SmartJoin] Failed to get instances:', e);
                return [];
            }
        },
        getLastUsedInstance: async () => {
            // Fallback if no selected instance path provided
            try {
                // TODO: Track last used instance in settings if needed, but for now return null
                return null;
            } catch (e) {
                return null;
            }
        },
        createInstance: async (config) => {
            try {
                log.info('[SmartJoin] Creating new instance:', config);

                // Get a new instance path
                const instancePath = await getNewInstancePath(event, config.name);

                if (!instancePath) {
                    throw new Error('Failed to get instance path');
                }

                // Create instance directory structure
                const instancesDir = path.dirname(instancePath);
                if (!fs.existsSync(instancesDir)) {
                    fs.mkdirSync(instancesDir, { recursive: true });
                }
                if (!fs.existsSync(instancePath)) {
                    fs.mkdirSync(instancePath, { recursive: true });
                }

                // Create basic instance data
                const instanceData = {
                    path: instancePath,
                    name: config.name,
                    version: config.version,
                    loader: config.loader || 'vanilla',
                    loaderVersion: null,
                    javaVersion: 'auto',
                    javaPath: '',
                    minRam: 2048,
                    maxRam: 4096,
                    windowWidth: 854,
                    windowHeight: 480,
                    fullscreen: false,
                    customJavaArgs: [],
                    customGameArgs: [],
                    autoGenerated: config.autoGenerated || false
                };

                // Save the instance
                await saveInstance(event, instanceData);

                log.info('[SmartJoin] Instance created successfully:', instanceData);

                return instanceData;
            } catch (e) {
                log.error('[SmartJoin] Failed to create instance:', e);
                throw e;
            }
        }
    };

    try {
        log.info(`[SmartJoin] Starting smart join for ${serverIp}`);

        // Step 1: Ping server
        event.sender.send('smart-join-progress', { step: 'ping', message: 'Checking server...' });
        const pingResult = await pingServer(serverIp);

        if (!pingResult.success) {
            return {
                success: false,
                error: pingResult.error || 'Server is unreachable',
                step: 'ping'
            };
        }

        const serverInfo = { ip: serverIp, ...pingResult };

        // Step 2: Find compatible instance
        event.sender.send('smart-join-progress', { step: 'instance', message: 'Finding compatible instance...' });

        // Use selectedInstancePath as the primary check
        let primaryCheckPath = selectedInstancePath;
        if (!primaryCheckPath) {
            primaryCheckPath = await dependencies.getLastUsedInstance();
        }

        const instanceResult = await findCompatibleInstance(serverInfo, dependencies.getInstances, primaryCheckPath);

        let targetInstance = null;

        if (instanceResult.found) {
            targetInstance = instanceResult.instance;
            log.info(`[SmartJoin] Using existing instance: ${targetInstance.name}`);
        } else {
            // Step 3: Create new instance
            log.info('[SmartJoin] No compatible instance found, creating new one...');
            event.sender.send('smart-join-progress', {
                step: 'create',
                message: 'Preparing everything for you, please wait...',
                showPopup: true
            });

            const createResult = await dependencies.createInstance(serverInfo);

            if (!createResult) {
                return {
                    success: false,
                    error: 'Failed to create instance',
                    step: 'create'
                };
            }

            targetInstance = createResult;
        }

        // Record join in telemetry
        if (serverData) {
            try {
                await authService.fetchAuthenticated(`${API_BASE}/servers/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serverId: serverData.id || serverIp,
                        snapshotData: {
                            playerCount: serverInfo.players,
                            listPosition: serverData.listPosition || 0,
                            joinMethod: 'smart_join'
                        }
                    })
                });
            } catch (e) {
                log.warn('[SmartJoin] Failed to record join telemetry:', e.message);
            }
        }

        log.info(`[SmartJoin] Smart join completed for ${serverIp}!`);

        // Return instance data - frontend will handle launch
        return {
            success: true,
            instance: targetInstance,
            server: serverIp
        };

    } catch (error) {
        log.error('[SmartJoin] Unexpected error:', error);
        return {
            success: false,
            error: error.message,
            step: 'unknown'
        };
    }
}

function setupDiscoveryHandlers() {
    ipcMain.removeHandler('get-discover-servers');
    ipcMain.removeHandler('get-discover-categories');
    ipcMain.removeHandler('join-server');
    ipcMain.removeHandler('get-discover-metadata');
    ipcMain.removeHandler('smart-join-server');
    ipcMain.removeHandler('create-server');
    ipcMain.removeHandler('verify-server');
    ipcMain.removeHandler('vote-server');

    ipcMain.handle('get-discover-servers', getDiscoverServers);
    ipcMain.handle('get-discover-categories', getDiscoverCategories);
    ipcMain.handle('join-server', joinServer);
    ipcMain.handle('get-discover-metadata', getDiscoverMetadata);
    ipcMain.handle('smart-join-server', smartJoinServer);
    ipcMain.handle('create-server', createServer);
    ipcMain.handle('verify-server', verifyServer);
    ipcMain.handle('vote-server', voteServer);
}

module.exports = { setupDiscoveryHandlers };
