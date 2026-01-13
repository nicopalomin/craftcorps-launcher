const log = require('electron-log');
const telemetryService = require('./telemetryService');

let store;

/**
 * Initialize the PlayTimeService with the Electron Store instance.
 * @param {Object} electronStore 
 */
function init(electronStore) {
    store = electronStore;
}

const activeSessions = {};

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
    getInstancePlayTime
};
