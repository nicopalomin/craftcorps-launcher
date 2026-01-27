const log = require('electron-log');
const telemetryService = require('./telemetryService.cjs');
const authService = require('./authService.cjs');

// PlayTime Service - Tracks local and syncs with API backend


let store;

/**
 * Initialize the PlayTimeService with the Electron Store instance.
 * @param {Object} electronStore 
 */
let onChangeCallback = null;

// Heartbeat State
let lastSyncTime = Date.now();
let heartbeatInterval = null;
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

function init(electronStore) {
    store = electronStore;

    // Start Heartbeat Loop
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    lastSyncTime = Date.now();
    heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Initial Sync
    sendHeartbeat();
    syncPlayTime();
}

function onChanged(callback) {
    onChangeCallback = callback;
}

function notify() {
    if (onChangeCallback) onChangeCallback();
}

const activeSessions = {};
const API_BASE = 'https://api.craftcorps.net'; // Assuming this base, or should I use authService base?

// Caching System
const cache = {};
const CACHE_TTL_BREAKDOWN = 120 * 1000; // 2 minutes
const CACHE_TTL_DEFAULT = 300 * 1000;   // 5 minutes

function getCached(key) {
    const entry = cache[key];
    if (entry && Date.now() < entry.expiry) return entry.data;
    return null;
}

function setCached(key, data, ttl) {
    cache[key] = { data, expiry: Date.now() + ttl };
}

/**
 * Fetch Playtime Breakdown
 */
async function getBreakdown() {
    const cached = getCached('breakdown');
    if (cached) return cached;

    try {
        const res = await authService.fetchAuthenticated(`${API_BASE}/sessions/playtime/summary`);
        if (!res.ok) throw new Error(`Failed to fetch summary: ${res.status}`);
        const data = await res.json();
        setCached('breakdown', data, CACHE_TTL_BREAKDOWN);
        return data;
    } catch (e) {
        log.error(`[PlayTime] getBreakdown error: ${e.message}`);
        return null;
    }
}

/**
 * Fetch Playtime History
 * @param {string} start ISO Date
 * @param {string} end ISO Date
 */
async function getHistory(start, end) {
    const cacheKey = `history_${start || 'def'}_${end || 'def'}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const url = new URL(`${API_BASE}/sessions/playtime/history`);
        if (start) url.searchParams.append('start', start);
        if (end) url.searchParams.append('end', end);

        const res = await authService.fetchAuthenticated(url.toString());
        if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
        const data = await res.json();
        setCached(cacheKey, data, CACHE_TTL_DEFAULT);
        return data;
    } catch (e) {
        log.error(`[PlayTime] getHistory error: ${e.message}`);
        return null; // Return null instead of throwing to avoid UI crashes
    }
}

/**
 * Fetch Detailed Instance Stats
 */
async function getDetailedStats() {
    const cached = getCached('detailed');
    if (cached) return cached;

    try {
        const res = await authService.fetchAuthenticated(`${API_BASE}/sessions/playtime/instances`);
        if (!res.ok) throw new Error(`Failed to fetch detailed stats: ${res.status}`);
        const data = await res.json();
        setCached('detailed', data, CACHE_TTL_DEFAULT);
        return data;
    } catch (e) {
        log.error(`[PlayTime] getDetailedStats error: ${e.message}`);
        return null;
    }
}

/**
 * Fetch Daily Session Log
 * @param {string} date YYYY-MM-DD
 */
async function getDailyLog(date) {
    const cacheKey = `daily_${date}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
        const res = await authService.fetchAuthenticated(`${API_BASE}/sessions/playtime/date/${date}`);
        if (!res.ok) throw new Error(`Failed to fetch daily log: ${res.status}`);
        const data = await res.json();
        setCached(cacheKey, data, CACHE_TTL_DEFAULT);
        return data;
    } catch (e) {
        log.error(`[PlayTime] getDailyLog error: ${e.message}`);
        return null;
    }
}

/**
 * Fetch Playtime Breakdown (Grouped by Server/Instance)
 */
async function getOfficialBreakdown() {
    try {
        const res = await authService.fetchAuthenticated(`${API_BASE}/sessions/playtime/breakdown`);
        if (!res.ok) throw new Error(`Failed to fetch breakdown: ${res.status}`);
        return await res.json();
    } catch (e) {
        log.error(`[PlayTime] getOfficialBreakdown error: ${e.message}`);
        return null;
    }
}

async function syncPlayTime() {
    log.info('[PlayTime] Syncing with server...');
    try {
        // 1. Fetch Official Total (from Summary)
        const summary = await getBreakdown();
        log.info(`[PlayTime] DEBUG: Summary response: ${JSON.stringify(summary)}`);

        if (summary) {
            let totalSeconds = 0;
            const syncedTracker = {};

            // Check if we have the servers structure
            if (summary.servers && Array.isArray(summary.servers)) {
                log.info(`[PlayTime] DEBUG: Parsing servers array...`);
                summary.servers.forEach(server => {
                    log.info(`[PlayTime] DEBUG: Processing server: ${server.serverName}, total: ${server.totalPlaytime}`);
                    totalSeconds += (server.totalPlaytime || 0);

                    // Summary also includes per-instance breakdown
                    if (server.instances) {
                        Object.entries(server.instances).forEach(([id, seconds]) => {
                            log.info(`[PlayTime] DEBUG: Instance ${id} -> ${seconds}s`);
                            syncedTracker[id] = (syncedTracker[id] || 0) + (seconds * 1000);
                        });
                    }
                });
            } else {
                // Fallback if no servers array, check for root level totals
                log.info(`[PlayTime] DEBUG: No 'servers' array found, using global totals.`);
                totalSeconds = summary.totalSeconds || summary.gameplaySeconds || (summary.totals && summary.totals.gameplaySeconds) || 0;
            }

            const serverTotalMs = totalSeconds * 1000;

            log.info(`[PlayTime] DEBUG: Storing total: ${serverTotalMs}ms (${totalSeconds}s)`);

            // Calculate robust total from instance breakdowns
            const localTracker = store.get('playTime.tracker', {});
            // We just updated syncedTracker in memory, let's use the one we just built
            // Note: syncedTracker is defined inside this scope in previous lines (re-read file to be sure, yes line 168)

            let calculatedTotal = 0;
            const allIds = new Set([...Object.keys(localTracker), ...Object.keys(syncedTracker)]);
            allIds.forEach(id => {
                calculatedTotal += Math.max(localTracker[id] || 0, syncedTracker[id] || 0);
            });

            log.info(`[PlayTime] DEBUG: Calculated Sum of Instances: ${calculatedTotal}ms`);

            // Fix: Total should be at least the Server Total OR the Sum of known instances
            // Preserves local progress (calculatedTotal) and historical/deleted data (serverTotalMs)
            const currentTotal = store.get('playTime.total', 0);
            const finalTotal = Math.max(currentTotal, serverTotalMs, calculatedTotal);

            store.set('playTime.total', finalTotal);

            store.set('playTime.syncedTotal', serverTotalMs);

            log.info(`[PlayTime] DEBUG: Storing syncedTracker: ${JSON.stringify(syncedTracker)}`);
            store.set('playTime.syncedTracker', syncedTracker);

            log.info(`[PlayTime] Sync complete. Total: ${Math.round(finalTotal / 1000)}s`);
        } else {
            log.warn(`[PlayTime] DEBUG: Summary was null or undefined`);
        }

        // 2. Fetch Detailed Per-Instance Stats (REQUIRED for InstanceHero UI)
        try {
            const detailed = await getDetailedStats();
            log.info(`[PlayTime] DEBUG: Detailed instances response: ${JSON.stringify(detailed)}`);

            if (detailed) {
                const syncedTracker = {};

                // Handle "Servers" structure (Official API Spec)
                if (detailed.servers && Array.isArray(detailed.servers)) {
                    detailed.servers.forEach(server => {
                        if (server.instances) {
                            Object.entries(server.instances).forEach(([id, seconds]) => {
                                syncedTracker[id] = (syncedTracker[id] || 0) + (seconds * 1000);
                            });
                        }
                    });
                }
                // Handle legacy flat/array structures just in case
                else if (Array.isArray(detailed)) {
                    detailed.forEach(item => {
                        const id = item.instanceId || item.id;
                        if (id) syncedTracker[id] = (item.durationSeconds || item.playtime || 0) * 1000;
                    });
                } else if (typeof detailed === 'object') {
                    Object.entries(detailed).forEach(([id, stats]) => {
                        // Ignore 'servers' key if it was object but handled above, strictly check for instance-like keys? 
                        // Actually if it's the objects map format:
                        if (id !== 'servers') {
                            const seconds = typeof stats === 'number' ? stats : (stats.gameplaySeconds || stats.duration || 0);
                            syncedTracker[id] = (syncedTracker[id] || 0) + (seconds * 1000);
                        }
                    });
                }

                log.info(`[PlayTime] DEBUG: Storing detailed syncedTracker: ${JSON.stringify(syncedTracker)}`);
                store.set('playTime.syncedTracker', syncedTracker);
                log.info(`[PlayTime] Synced tracker updated with ${Object.keys(syncedTracker).length} instances.`);
            }
        } catch (detailError) {
            log.error(`[PlayTime] Failed to sync detailed stats: ${detailError.message}`);
        }

        notify();
        return true;
    } catch (e) {
        log.error(`[PlayTime] syncPlayTime error: ${e.message}`);
        return false;
    }
}

/**
 * Heartbeat Sync
 * Sends deltas to backend
 */
async function sendHeartbeat() {
    const now = Date.now();
    const deltaMs = now - lastSyncTime;

    if (deltaMs <= 0) return;

    const deltaSeconds = Math.round(deltaMs / 1000);
    if (deltaSeconds <= 0) return; // Too small to report

    const token = await authService.getToken();
    if (!token) return; // Not logged in or no token available

    const instances = Object.entries(activeSessions).map(([id, data]) => ({
        instanceId: id,
        deltaSeconds: deltaSeconds,
        playerName: data.playerName,
        playerUuid: data.playerUuid,
        isOnline: data.isOnline
    }));

    const payload = {
        launcherDeltaSeconds: deltaSeconds,
        instances
    };

    try {
        const res = await authService.fetchAuthenticated(`${API_BASE}/presence/launcher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Success: Update lastSyncTime to NOW (effectively consuming the delta)
            lastSyncTime = now;

            // Also update local trackers for UI feedback immediately (optional but good)
            if (instances.length > 0) {
                instances.forEach(i => addPlayTime(i.instanceId, deltaMs));
            }
        } else {
            log.warn(`[PlayTime] Heartbeat failed: ${res.status}. Delta preserved.`);
        }
    } catch (e) {
        log.error(`[PlayTime] Heartbeat error: ${e.message}`);
    }
}


/**
 * Start tracking play time for a specific instance.
 * @param {string} instanceIdOrPath - Unique identifier for the instance (using path as ID)
 * @param {Object} playerData - { playerName, playerUuid, isOnline }
 */
function startSession(instanceIdOrPath, playerData) {
    if (!store) return;
    activeSessions[instanceIdOrPath] = {
        playerName: playerData?.playerName || 'Player',
        playerUuid: playerData?.playerUuid || '0',
        isOnline: !!playerData?.isOnline // Premium Status
    };
    log.info(`[PlayTime] Started session for ${instanceIdOrPath} (Player: ${activeSessions[instanceIdOrPath].playerName}, Premium: ${activeSessions[instanceIdOrPath].isOnline})`);
}

/**
 * Stop tracking play time and update the total duration.
 * @param {string} instanceIdOrPath 
 */
function stopSession(instanceIdOrPath) {
    if (!store) return;
    const session = activeSessions[instanceIdOrPath];
    if (session) {
        log.info(`[PlayTime] Stopped session for ${instanceIdOrPath}. Triggering final sync.`);

        // Immediate sync to flush remaining time
        sendHeartbeat();

        // Now remove from tracking
        delete activeSessions[instanceIdOrPath];
    }
}

/**
 * Add duration to the stored play time.
 * @param {string} instanceIdOrPath 
 * @param {number} durationMs 
 */
function addPlayTime(instanceIdOrPath, durationMs) {
    try {
        // Update Total Play Time
        const currentTotal = store.get('playTime.total', 0);
        store.set('playTime.total', currentTotal + durationMs);

        // Update Instance Play Time
        // We use a hash or a safe key format for the path to avoid dot notation issues in electron-store keys if path has dots
        // Actually electron-store handles nested keys with dots.
        // But paths have backslashes on windows.
        // Safe approach: store play times in a separate object keyed by hash or just use a dedicated "playTime.instances" object.
        // We'll use a simple object structure: playTime: { total: 0, instances: { "path/to/instance": 1000 } }

        // We need to fetch the whole instances object to update one key if we want to avoid deep path issues
        // or just use store.set(`playTime.instances.${safeKey}`, val)
        // Let's rely on retrieving the specific instance time first.

        // Issue: Keys in electron-store with dots are treated as nested. Windows paths have no dots usually? "1.19.2" has dots.
        // Best to hash the key or replace specific chars, or just use a look-up array?
        // Let's use `playTime.instances` as a dictionary, but we must escape the key.
        // Or simpler: define a separate store method? No, keep it in main store.

        // We will just replace backslashes with forward slashes for consistency, and maybe base64 encode or just use the path string if safe.
        // Electron-store uses `conf` which supports dot-notation access.
        // "C:\Users\..." -> escaping might be annoying.

        // Strategy: Use a map stored under 'playTime.tracker'
        const tracker = store.get('playTime.tracker', {});
        const currentInstanceTime = tracker[instanceIdOrPath] || 0;
        tracker[instanceIdOrPath] = currentInstanceTime + durationMs;
        store.set('playTime.tracker', tracker);
        notify();

        log.info(`[PlayTime] Added ${Math.round(durationMs / 1000)}s to ${instanceIdOrPath}. Total: ${Math.round((currentTotal + durationMs) / 1000)}s`);
    } catch (e) {
        log.error(`[PlayTime] Failed to save play time: ${e.message}`);
    }
}

/**
 * Get total play time in milliseconds.
 */
function getTotalPlayTime() {
    if (!store) return 0;
    return store.get('playTime.total', 0);
}

/**
 * Get play time for a specific instance in milliseconds.
 * @param {string} instanceIdOrPath 
 */
function getInstancePlayTime(instanceIdOrPath) {
    if (!store) return 0;

    // 1. Get Synced Time (Backend Authority)
    const syncedTracker = store.get('playTime.syncedTracker', {});
    const syncedTime = syncedTracker[instanceIdOrPath] || 0;

    // 2. Get Local Time (Device History / Pending Sync)
    const localTracker = store.get('playTime.tracker', {});
    const localTime = localTracker[instanceIdOrPath] || 0;

    // 3. Display whichever is greater.
    // This provides immediate UI feedback for new play time while favoring
    // the backend's official count once it catches up.
    let playTime = Math.max(syncedTime, localTime);

    // 4. Legacy Fallback: If current ID yields 0, checks if we have "0" (Legacy/Global) data
    // This handles cases where local instance has a UUID but backend data is under "0"
    /* if (playTime === 0) {
        const legacyTime = syncedTracker['0'] || 0;
        if (legacyTime > 0) return legacyTime;
    } */

    return playTime;
}

module.exports = {
    init,
    startSession,
    stopSession,
    getTotalPlayTime,
    getInstancePlayTime,
    getBreakdown,
    getHistory,
    getDetailedStats,
    getDailyLog,
    getOfficialBreakdown,
    syncPlayTime,
    onChanged,
    notify
};
