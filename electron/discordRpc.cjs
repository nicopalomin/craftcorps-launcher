const { ipcMain } = require('electron');
const DiscordRPC = require('discord-rpc');
const log = require('electron-log');

const clientId = '1454519577508708462';
let rpc;
let rpcReady = false;

function initDiscordRPC() {
    // DiscordRPC.register(clientId); // Not strictly needed for IPC presence and can cause issues on some systems

    // Defer RPC initialization to avoid blocking main process/window rendering on startup
    // Especially if connection fails or times out.
    setTimeout(() => {
        try {
            log.info('[Discord RPC] Initializing...');
            rpc = new DiscordRPC.Client({ transport: 'ipc' });

            rpc.on('ready', () => {
                rpcReady = true;
                log.info('[Discord RPC] Ready');
                setActivity({
                    details: 'In Launcher',
                    state: 'Idling',
                    startTimestamp: Date.now(),
                    largeImageKey: 'icon',
                    largeImageText: 'CraftCorps Launcher',
                    instance: false,
                });
            });

            rpc.login({ clientId }).catch(err => {
                log.warn(`[Discord RPC] Login failed (non-fatal): ${err.message}`);
            });
        } catch (e) {
            log.error(`[Discord RPC] Initialization failed: ${e.message}`);
        }
    }, 1500); // 1.5s delay to let app load first

    // Register IPC handlers immediately so frontend doesn't crash if it calls them too early
    // We just return early if rpc isn't ready.
    ipcMain.handle('discord-set-activity', async (event, activity) => {
        return setActivity(activity);
    });

    ipcMain.handle('discord-clear-activity', async () => {
        return clearActivity();
    });
}

async function setActivity(activity) {
    if (!rpcReady || !rpc) return;
    return rpc.setActivity(activity).catch(err => log.error(`[Discord RPC] Set activity failed: ${err}`));
}

async function clearActivity() {
    if (!rpcReady || !rpc) return;
    return rpc.clearActivity().catch(err => log.error(`[Discord RPC] Clear activity failed: ${err}`));
}

module.exports = {
    initDiscordRPC,
    setActivity,
    clearActivity
};
