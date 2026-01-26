const net = require('net');
const log = require('electron-log');
const { setActivity, clearActivity } = require('./discordRpc.cjs');
const authService = require('./services/authService.cjs');
const pkg = require('../package.json');
const API_BASE = 'https://api.craftcorps.net';
const DEFAULT_HOVER_TEXT = `CraftCorps ${pkg.version}`;

let server;
let port = 0;
let connections = new Set();

const RPC_PORT = 14545;
const THROTTLE_INTERVAL = 15000; // 15 seconds

// Throttling state
let lastUpdateTime = 0;
let pendingActivity = null;
let throttleTimer = null;

function startRpcServer() {
    if (server) {
        log.warn('[RPC Server] Server already started');
        return;
    }

    server = net.createServer((socket) => {
        log.info('[RPC Server] Mod connected');
        connections.add(socket);

        let buffer = '';

        socket.on('data', (data) => {
            buffer += data.toString();

            // Handle multiple JSON objects if they arrive together or are split
            let boundary = buffer.indexOf('\n');
            while (boundary !== -1) {
                const line = buffer.substring(0, boundary).trim();
                buffer = buffer.substring(boundary + 1);

                if (line) {
                    try {
                        const message = JSON.parse(line);
                        handleModMessage(message);
                    } catch (e) {
                        log.error('[RPC Server] Failed to parse message from mod:', line, e.message);
                    }
                }
                boundary = buffer.indexOf('\n');
            }
        });

        socket.on('error', (err) => {
            log.error('[RPC Server] Socket error:', err.message);
        });

        socket.on('close', () => {
            log.info('[RPC Server] Mod disconnected');
            connections.delete(socket);
        });
    });

    server.on('error', (err) => {
        log.error('[RPC Server] Server error:', err);
    });

    // Listen on 127.0.0.1 for security
    server.listen(RPC_PORT, '127.0.0.1', () => {
        port = RPC_PORT;
        log.info(`[RPC Server] Listening on 127.0.0.1:${port}`);
    });
}

/**
 * Executes the Discord RPC update, respecting rate limits.
 */
function executeUpdate(activity) {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime;

    if (timeSinceLastUpdate >= THROTTLE_INTERVAL) {
        log.info(`[RPC Server] Executing RPC update. Icon: ${activity.largeImageKey}`);
        setActivity(activity);
        lastUpdateTime = now;
        pendingActivity = null;
        if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
        }
    } else {
        // Queue the update
        pendingActivity = activity;
        const delay = THROTTLE_INTERVAL - timeSinceLastUpdate;

        if (!throttleTimer) {
            log.info(`[RPC Server] Update throttled. Queuing for execution in ${Math.round(delay / 1000)}s`);
            throttleTimer = setTimeout(() => {
                if (pendingActivity) {
                    log.info('[RPC Server] Executing queued update after throttle.');
                    executeUpdate(pendingActivity);
                }
            }, delay);
        } else {
            log.debug('[RPC Server] Update throttled. Replacing pending queued activity.');
        }
    }
}

async function handleModMessage(message) {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'setActivity') {
        log.info('[RPC Server] Received setActivity from mod:', message.activity);

        const modActivity = message.activity;

        // Map Mod Schema -> Discord RPC Schema
        const activity = {
            details: modActivity.name || 'In Game',
            state: modActivity.address === 'idle' ? 'In Main Menu' : `Playing on ${modActivity.address || 'Server'}`,
            largeImageKey: 'icon',
            largeImageText: DEFAULT_HOVER_TEXT,
            instance: true,
            ...modActivity // Allow overrides (including startTimestamp if provided)
        };

        log.debug(`[RPC Server] Base activity mapped: ${activity.details} | ${activity.state}`);

        // If address is "idle", we use the default launcher icon
        if (modActivity.address === 'idle') {
            log.info('[RPC Server] State is idle, using default launcher icon');
            activity.largeImageKey = 'icon';
            activity.largeImageText = DEFAULT_HOVER_TEXT;
        }
        // OTHERWISE, try to fetch a custom server icon
        else {
            const serverQuery = modActivity.name || modActivity.address;
            const serverAddress = modActivity.address;

            // Set a default fallback to mcsrvstat.us immediately in case API search fails or is slow
            if (serverAddress && serverAddress !== 'idle') {
                const fallbackUrl = `https://api.mcsrvstat.us/icon/${serverAddress}`;
                activity.largeImageKey = fallbackUrl;
                log.info(`[RPC Server] Set mcsrvstat.us fallback icon for: ${serverAddress}`);
            }

            if (serverQuery) {
                try {
                    const query = encodeURIComponent(serverQuery);
                    const url = `${API_BASE}/servers/discover?limit=1&query=${query}`;
                    log.debug(`[RPC Server] Searching discovery API for: ${serverQuery}`);

                    const response = await authService.fetchAuthenticated(url);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.servers && data.servers.length > 0) {
                            const server = data.servers[0];
                            if (server.iconUrl) {
                                log.info(`[RPC Server] Found premium icon in discovery: ${server.name}`);
                                activity.largeImageKey = server.iconUrl;
                                activity.largeImageText = server.name || serverQuery;
                            }
                        } else {
                            log.debug(`[RPC Server] No premium icon found in discovery for: ${serverQuery}`);
                        }
                    } else {
                        log.warn(`[RPC Server] Discovery API returned status: ${response.status}`);
                    }
                } catch (e) {
                    log.error('[RPC Server] Failed to fetch server icon from discovery:', e.message);
                }
            }
        }

        // Pass to the throttled execution engine
        executeUpdate(activity);

    } else if (message.type === 'clearActivity') {
        log.info('[RPC Server] Received clearActivity from mod. Resetting to launcher state.');
        pendingActivity = null;
        if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
        }

        // Don't clear! Revert to launcher idling status
        setActivity({
            details: 'In Launcher',
            state: 'Idling',
            startTimestamp: Date.now(),
            largeImageKey: 'icon',
            largeImageText: DEFAULT_HOVER_TEXT,
            instance: false,
        });
    }
}

function getRpcPort() {
    return port;
}

function stopRpcServer() {
    if (server) {
        connections.forEach(s => s.destroy());
        server.close();
        server = null;
        port = 0;
        log.info('[RPC Server] Stopped');
    }
}

module.exports = {
    startRpcServer,
    getRpcPort,
    stopRpcServer
};
