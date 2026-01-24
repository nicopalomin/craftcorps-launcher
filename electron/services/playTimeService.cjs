const log = require('electron-log');
const telemetryService = require('./telemetryService.cjs');
const authService = require('./authService.cjs');

// PlayTime Service - Tracks local and syncs with API backend


let store;

/**
 * Initialize the PlayTimeService with the Electron Store instance.
 * @param {Object} electronStore 
 */
function init(electronStore) {
    store = electronStore;
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
        const res = await authService.fetchAuthenticated(`${API_BASE}/sessions/playtime/breakdown`);
        if (!res.ok) throw new Error(`Failed to fetch breakdown: ${res.status}`);
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
 * Sync local playtime with server truth
 */
async function syncPlayTime() {
    log.info('[PlayTime] Syncing with server...');
    const data = await getBreakdown();
    if (data && data.totals) {
        // Update local total
        // We multiply by 1000 because API returns seconds, we store ms
        const serverTotalMs = (data.totals.gameplaySeconds || 0) * 1000;

        // Only update if server has more data or to ensure consistency?
        // Usually server is authority.
        store.set('playTime.total', serverTotalMs);

        // We could also sync instance breakdown if we mapped it correctly, 
        // but local tracker is by path, server is by ID. 
        // We'll leave the local instance tracker as a "device" cache for now, 
        // unless we want to map server IDs to local paths.

        log.info(`[PlayTime] Synced total playtime: ${serverTotalMs}ms`);
        return true;
    }
    return false;
}


/**
 * Start tracking play time for a specific instance.
 * @param {string} instanceIdOrPath - Unique identifier for the instance (using path as ID)
 */
function startSession(instanceIdOrPath) {
    if (!store) return;
    const now = Date.now();

    // Start 5-minute interval for server-side tracking (Rewards)
    const intervalId = setInterval(() => {
        telemetryService.track('PLAY_TIME_PING', {
            instanceId: instanceIdOrPath,
            duration: 300000 // 5 minutes 
        });
        log.info(`[PlayTime] Server ping sent for ${instanceIdOrPath}`);
    }, 300000); // 5 minutes

    activeSessions[instanceIdOrPath] = { startTime: now, intervalId };
}

/**
 * Stop tracking play time and update the total duration.
 * @param {string} instanceIdOrPath 
 */
function stopSession(instanceIdOrPath) {
    if (!store) return;
    const session = activeSessions[instanceIdOrPath];
    if (!session) return;

    // Stop server pinging
    if (session.intervalId) clearInterval(session.intervalId);

    const endTime = Date.now();
    const durationMs = endTime - session.startTime;

    // clean up
    delete activeSessions[instanceIdOrPath];

    if (durationMs > 0) {
        addPlayTime(instanceIdOrPath, durationMs);
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
    const tracker = store.get('playTime.tracker', {});
    return tracker[instanceIdOrPath] || 0;
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
    syncPlayTime
};
