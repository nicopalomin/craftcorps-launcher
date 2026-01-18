const { ipcMain } = require('electron');
const authService = require('../services/authService.cjs');
const log = require('electron-log');
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');

const API_BASE = 'https://api.craftcorps.net';

/**
 * Smart Server Join Handler
 * 
 * Flow:
 * 1. Ping server to check reachability
 * 2. Check last used instance compatibility
 * 3. If not compatible, scan vanilla instances, then modded
 * 4. If no compatible instance found, create new instance
 * 5. Launch game with server connection args
 */

/**
 * Ping a Minecraft server to check if it's reachable
 */
async function pingServer(serverIp) {
    try {
        log.info(`[SmartJoin] Pinging server: ${serverIp}`);

        // Use mcsrvstat API for quick server status check
        const response = await fetch(`https://api.mcsrvstat.us/3/${serverIp}`, {
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });

        if (!response.ok) return { success: false, error: 'Server ping failed' };

        const data = await response.json();

        if (!data.online) {
            return { success: false, error: 'Server is offline' };
        }

        log.info(`[SmartJoin] Server online: ${serverIp}, version: ${data.version}`);

        return {
            success: true,
            online: true,
            version: data.version,
            players: data.players?.online || 0,
            maxPlayers: data.players?.max || 0,
            platform: data.software?.includes('Bedrock') ? 'Bedrock' : 'Java'
        };
    } catch (error) {
        log.error(`[SmartJoin] Failed to ping ${serverIp}:`, error.message);
        return { success: false, error: 'Server unreachable' };
    }
}

/**
 * Check if an instance is compatible with a server
 */
async function checkInstanceCompatibility(instance, serverInfo) {
    if (!instance || !serverInfo) return { compatible: false, reason: 'Missing data' };

    log.info(`[SmartJoin] Checking compatibility: ${instance.name} (${instance.version}) vs ${serverInfo.version || 'Unknown'}`);

    // Platform check (Java vs Bedrock)
    const instancePlatform = instance.loader?.toLowerCase().includes('bedrock') ? 'Bedrock' : 'Java';
    if (instancePlatform !== serverInfo.platform) {
        return {
            compatible: false,
            reason: `Platform mismatch: Instance is ${instancePlatform}, server is ${serverInfo.platform}`
        };
    }

    // Version compatibility check
    if (serverInfo.version && instance.version) {
        const instanceVersion = instance.version.trim();
        const serverVersionString = serverInfo.version.trim();

        // Extract version numbers from server version string
        const versionPattern = /(\d+\.\d+(?:\.\d+)?)/g;
        const serverVersions = serverVersionString.match(versionPattern) || [];

        log.info(`[SmartJoin] Instance version: ${instanceVersion}, Server versions: ${serverVersions.join(', ')}`);

        // Check if instance version matches any server version or is within range
        const isCompatible = serverVersions.some(serverVer => {
            // Exact match
            if (instanceVersion === serverVer) return true;

            // Check if instance version starts with server version (e.g., 1.20 matches 1.20.1)
            if (instanceVersion.startsWith(serverVer) || serverVer.startsWith(instanceVersion)) return true;

            return false;
        });

        // If we have multiple versions (range), check if instance is within range
        if (serverVersions.length >= 2) {
            const minVersion = serverVersions[0];
            const maxVersion = serverVersions[serverVersions.length - 1];

            const compareVersions = (v1, v2) => {
                const parts1 = v1.split('.').map(Number);
                const parts2 = v2.split('.').map(Number);

                for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
                    const num1 = parts1[i] || 0;
                    const num2 = parts2[i] || 0;
                    if (num1 > num2) return 1;
                    if (num1 < num2) return -1;
                }
                return 0;
            };

            const inRange = compareVersions(instanceVersion, minVersion) >= 0 &&
                compareVersions(instanceVersion, maxVersion) <= 0;

            if (inRange || isCompatible) {
                log.info(`[SmartJoin] ✓ Instance ${instance.name} is compatible`);
                return { compatible: true, instance };
            }
        } else if (isCompatible) {
            log.info(`[SmartJoin] ✓ Instance ${instance.name} is compatible`);
            return { compatible: true, instance };
        }

        log.warn(`[SmartJoin] ✗ Version mismatch: Instance ${instanceVersion} not compatible with server ${serverVersionString}`);
        return {
            compatible: false,
            reason: `Version mismatch: Instance is ${instanceVersion}, server needs ${serverVersionString}`
        };
    }

    // If no version info, assume compatible (let user try)
    log.info(`[SmartJoin] ✓ No version constraints, assuming compatible`);
    return { compatible: true, instance };
}

/**
 * Find a compatible instance from user's installed instances
 */
async function findCompatibleInstance(serverInfo, getInstancesFn, lastUsedInstancePath) {
    try {
        log.info('[SmartJoin] Finding compatible instance...');
        log.info(`[SmartJoin] Server requirements: Platform=${serverInfo.platform}, Version=${serverInfo.version}`);

        const instances = await getInstancesFn();
        if (!instances || instances.length === 0) {
            log.warn('[SmartJoin] No instances available');
            return { found: false, reason: 'No instances available' };
        }

        log.info(`[SmartJoin] Found ${instances.length} total instances`);

        // 1. Check selected/last used instance first
        if (lastUsedInstancePath) {
            const lastUsed = instances.find(i => i.path === lastUsedInstancePath);
            if (lastUsed) {
                log.info(`[SmartJoin] ━━━ Checking SELECTED/LAST USED instance ━━━`);
                log.info(`[SmartJoin]   Name: "${lastUsed.name}"`);
                log.info(`[SmartJoin]   Version: ${lastUsed.version}`);
                log.info(`[SmartJoin]   Loader: ${lastUsed.loader || 'vanilla'}`);

                const check = await checkInstanceCompatibility(lastUsed, serverInfo);

                if (check.compatible) {
                    log.info(`[SmartJoin] ✅ MATCH! Using selected/last used instance "${lastUsed.name}"`);
                    return { found: true, instance: lastUsed, reason: 'Selected/Last used instance' };
                } else {
                    log.warn(`[SmartJoin] ❌ Selected/last used instance not compatible: ${check.reason}`);
                }
            }
        }

        // 2. Scan vanilla instances first (fastest to launch)
        log.info('[SmartJoin] ━━━ Scanning VANILLA instances ━━━');
        const vanillaInstances = instances.filter(i =>
            !i.loader || i.loader === 'vanilla' || i.loader === 'Vanilla'
        );

        log.info(`[SmartJoin] Found ${vanillaInstances.length} vanilla instances`);

        for (let i = 0; i < vanillaInstances.length; i++) {
            const instance = vanillaInstances[i];
            log.info(`[SmartJoin] [${i + 1}/${vanillaInstances.length}] Checking "${instance.name}"`);
            log.info(`[SmartJoin]   Version: ${instance.version}`);
            log.info(`[SmartJoin]   Path: ${instance.path}`);

            const check = await checkInstanceCompatibility(instance, serverInfo);

            if (check.compatible) {
                log.info(`[SmartJoin] ✅ MATCH! Using vanilla instance "${instance.name}"`);
                return { found: true, instance, reason: 'Vanilla instance match' };
            } else {
                log.warn(`[SmartJoin] ❌ Not compatible: ${check.reason}`);
            }
        }

        // 3. Scan modded instances
        log.info('[SmartJoin] ━━━ Scanning MODDED instances ━━━');
        const moddedInstances = instances.filter(i =>
            i.loader && i.loader !== 'vanilla' && i.loader !== 'Vanilla'
        );

        log.info(`[SmartJoin] Found ${moddedInstances.length} modded instances`);

        for (let i = 0; i < moddedInstances.length; i++) {
            const instance = moddedInstances[i];
            log.info(`[SmartJoin] [${i + 1}/${moddedInstances.length}] Checking "${instance.name}"`);
            log.info(`[SmartJoin]   Version: ${instance.version}`);
            log.info(`[SmartJoin]   Loader: ${instance.loader}`);
            log.info(`[SmartJoin]   Path: ${instance.path}`);

            const check = await checkInstanceCompatibility(instance, serverInfo);

            if (check.compatible) {
                log.info(`[SmartJoin] ✅ MATCH! Using modded instance "${instance.name}"`);
                return { found: true, instance, reason: 'Modded instance match' };
            } else {
                log.warn(`[SmartJoin] ❌ Not compatible: ${check.reason}`);
            }
        }

        log.warn('[SmartJoin] ⚠️ No compatible instance found - will create new one');
        return { found: false, reason: 'No compatible instance found' };

    } catch (error) {
        log.error('[SmartJoin] Error finding compatible instance:', error);
        return { found: false, reason: error.message };
    }
}

/**
 * Create a new vanilla instance for the server's version
 */
async function createNewInstance(serverInfo, createInstanceFn) {
    try {
        log.info(`[SmartJoin] Creating new instance for server version: ${serverInfo.version}`);

        // Extract version from server version string (take first version found)
        let targetVersion = '1.21.1'; // Default to latest
        if (serverInfo.version) {
            const versionMatch = serverInfo.version.match(/\d+\.\d+(?:\.\d+)?/);
            if (versionMatch) {
                targetVersion = versionMatch[0];
            }
        }

        const instanceName = `Server-${targetVersion}`;

        // Create the instance
        const newInstance = await createInstanceFn({
            name: instanceName,
            version: targetVersion,
            loader: 'vanilla',
            autoGenerated: true
        });

        if (!newInstance || !newInstance.path) {
            throw new Error('Failed to create instance');
        }

        log.info(`[SmartJoin] Successfully created instance: ${instanceName}`);
        return { success: true, instance: newInstance };

    } catch (error) {
        log.error('[SmartJoin] Failed to create new instance:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Launch game with server connection
 */
async function launchWithServer(instance, serverIp, launchGameFn) {
    try {
        log.info(`[SmartJoin] Launching instance "${instance.name}" with server ${serverIp}`);

        // Launch game with auto-connect args
        const result = await launchGameFn(instance.path, {
            autoConnect: true,
            serverAddress: serverIp,
            serverPort: 25565 // Default, will be parsed from IP if specified
        });

        return { success: true, ...result };

    } catch (error) {
        log.error('[SmartJoin] Failed to launch game:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Main smart join handler
 */
async function handleSmartJoin(event, { serverIp, serverData, selectedInstancePath }, dependencies) {
    const {
        getInstances,
        getLastUsedInstance,
        createInstance,
        launchGame
    } = dependencies;

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

        // Use selectedInstancePath if available, otherwise fallback to lastUsed (which is currently null but good to keep logic)
        let primaryInstanceToCheck = selectedInstancePath;
        if (!primaryInstanceToCheck) {
            primaryInstanceToCheck = await getLastUsedInstance();
        }

        const instanceResult = await findCompatibleInstance(serverInfo, getInstances, primaryInstanceToCheck);

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

            const createResult = await createNewInstance(serverInfo, createInstance);

            if (!createResult.success) {
                return {
                    success: false,
                    error: 'Failed to create instance: ' + createResult.error,
                    step: 'create'
                };
            }

            targetInstance = createResult.instance;
        }

        // Step 4: Launch game
        event.sender.send('smart-join-progress', { step: 'launch', message: 'Launching game...' });

        const launchResult = await launchWithServer(targetInstance, serverIp, launchGame);

        if (!launchResult.success) {
            return {
                success: false,
                error: 'Failed to launch game: ' + launchResult.error,
                step: 'launch'
            };
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

        log.info(`[SmartJoin] Successfully joined ${serverIp}!`);

        return {
            success: true,
            instance: targetInstance.name,
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

module.exports = {
    handleSmartJoin,
    pingServer,
    checkInstanceCompatibility,
    findCompatibleInstance
};
