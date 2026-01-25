const { ipcMain } = require('electron');
// const DiscordRPC = require('discord-rpc'); // Lazy loaded
const log = require('electron-log');

const clientId = '1454519577508708462';
let rpc;
let rpcReady = false;
let startTimestamp = Date.now();
let currentActivity = null;
let isSuspended = false;

function initDiscordRPC(startSuspended = false) {
    isSuspended = startSuspended;
    // DiscordRPC.register(clientId); // Not strictly needed for IPC presence and can cause issues on some systems

    // Defer RPC initialization to avoid blocking main process/window rendering on startup
    // Especially if connection fails or times out.
    setTimeout(() => {
        try {
            const DiscordRPC = require('discord-rpc');
            log.info('[Discord RPC] Initializing...');
            rpc = new DiscordRPC.Client({ transport: 'ipc' });

            rpc.on('ready', () => {
                rpcReady = true;
                log.info('[Discord RPC] Ready');

                if (currentActivity) {
                    // If activity was set while connecting (e.g. game launched), use that
                    rpc.setActivity(currentActivity).catch(err => log.error(`[Discord RPC] Set pending activity failed: ${err}`));
                } else if (!startSuspended) {
                    // Set initial activity, using current time as baseline
                    setActivity({
                        details: 'In Launcher',
                        state: 'Idling',
                        startTimestamp: Date.now(),
                        largeImageKey: 'icon',
                        largeImageText: 'CraftCorps Launcher',
                        instance: false,
                    });
                }
            });

            rpc.login({ clientId }).catch(err => {
                log.warn(`[Discord RPC] Login failed (non-fatal): ${err.message}`);
            });
        } catch (e) {
            log.error(`[Discord RPC] Initialization failed: ${e.message}`);
        }
    }, 5000); // 5s delay to let app load first

    // Register IPC handlers immediately so frontend doesn't crash if it calls them too early
    // We just return early if rpc isn't ready.
    ipcMain.handle('discord-set-activity', async (event, activity) => {
        return setActivity(activity);
    });

    ipcMain.handle('discord-clear-activity', async () => {
        return clearActivity();
    });

    ipcMain.handle('discord-resume', () => {
        liftSuspension();
    });
}

function liftSuspension() {
    if (isSuspended) {
        isSuspended = false;
        log.info('[Discord RPC] Suspension lifted.');
        if (currentActivity) {
            setActivity(currentActivity);
        }
    }
}

async function setActivity(activity) {
    // Check if startTimestamp is provided in the update (e.g. Game Start/Stop)
    // If so, update our local tracker.
    if (activity.startTimestamp) {
        startTimestamp = activity.startTimestamp;
    } else {
        // If not provided (e.g. navigating UI), use the tracked timestamp to prevent resetting time
        activity.startTimestamp = startTimestamp;
    }

    currentActivity = activity;
    if (isSuspended) return;

    if (!rpcReady || !rpc) return;

    return rpc.setActivity(activity).catch(err => log.error(`[Discord RPC] Set activity failed: ${err}`));
}

async function clearActivity() {
    currentActivity = null;
    if (!rpcReady || !rpc) return;
    return rpc.clearActivity().catch(err => log.error(`[Discord RPC] Clear activity failed: ${err}`));
}

module.exports = {
    initDiscordRPC,
    setActivity,
    clearActivity,
    liftSuspension
};
