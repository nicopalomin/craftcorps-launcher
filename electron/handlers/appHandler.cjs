const { ipcMain, app, dialog, shell } = require('electron');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');

const os = require('os');
// const si = require('systeminformation'); // Lazy loaded

function setupAppHandlers(getMainWindow, store) {
    // Remove existing handlers to prevent duplicate registration on hot-reload
    const handlers = [
        'get-system-info', 'get-app-version', 'select-file', 'select-folder',
        'open-logs-folder', 'open-path', 'upload-logs-manually', 'get-device-id',
        'capture-marketing-shot', 'get-unread-count', 'get-notifications', 'mark-notifications-read'
    ];
    handlers.forEach(h => {
        try { ipcMain.removeHandler(h); } catch (e) { /* ignore */ }
    });

    // System Info for Telemetry
    ipcMain.handle('get-system-info', async () => {
        const si = require('systeminformation');
        try {
            const cpu = await si.cpu();
            const mem = await si.mem();
            const graphics = await si.graphics();
            const osInfo = await si.osInfo();

            return {
                os: osInfo.platform, // 'win32', 'darwin'
                osVersion: osInfo.release, // '10.0.19045'
                ram: `${Math.round(mem.total / 1024 / 1024 / 1024)} GB`,
                cpu: `${cpu.manufacturer} ${cpu.brand}`,
                gpu: graphics.controllers.length > 0 ? graphics.controllers[0].model : 'Unknown'
            };
        } catch (e) {
            log.error('Failed to get system info:', e);
            return {
                os: process.platform,
                osVersion: process.getSystemVersion ? process.getSystemVersion() : 'Unknown',
                ram: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
                cpu: 'Unknown',
                gpu: 'Unknown'
            };
        }
    });

    // Electron Store Access
    ipcMain.handle('store-get', (event, key) => {
        return store ? store.get(key) : null;
    });

    ipcMain.handle('store-set', (event, key, value) => {
        store.set(key, value);
    });

    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    ipcMain.handle('get-device-id', async () => {
        // Use node-machine-id for consistent device identification
        try {
            const { machineIdSync } = require('node-machine-id');
            return machineIdSync({ original: true });
        } catch (e) {
            log.error('Failed to get machine ID:', e);
            // Fallback to stored UUID if machine-id fails
            let fallbackId = store.get('device_id_fallback');
            if (!fallbackId) {
                const crypto = require('crypto');
                fallbackId = crypto.randomUUID();
                store.set('device_id_fallback', fallbackId);
            }
            return fallbackId;
        }
    });

    // File Selection
    ipcMain.handle('select-file', async () => {
        const filters = process.platform === 'win32'
            ? [{ name: 'Executables', extensions: ['exe'] }]
            : []; // Allow any file on Mac/Linux

        const result = await dialog.showOpenDialog(getMainWindow(), {
            properties: ['openFile'],
            filters: filters
        });
        return result.canceled ? null : result.filePaths[0];
    });

    // Logging from Renderer
    ipcMain.on('renderer-log', (event, { level, message }) => {
        if (log[level]) {
            log[level](`[Renderer] ${message}`);
        } else {
            log.info(`[Renderer] ${message}`);
        }
    });

    // Open Logs Folder
    ipcMain.handle('open-logs-folder', async () => {
        const logPath = log.transports.file.getFile().path;
        return shell.showItemInFolder(logPath);
    });

    // Open Any Path (Folder or File)
    ipcMain.handle('open-path', async (event, targetPath) => {
        if (!targetPath) return { success: false, error: 'No path provided' };
        try {
            const error = await shell.openPath(targetPath);
            if (error) {
                log.error(`Failed to open path ${targetPath}: ${error}`);
                return { success: false, error };
            }
            return { success: true };
        } catch (e) {
            log.error(`Exception opening path ${targetPath}: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // Manual Log Upload
    ipcMain.handle('upload-logs-manually', async () => {
        try {
            const telemetryService = require('../services/telemetryService.cjs'); // Lazy import
            const logPath = log.transports.file.getFile().path;

            // Read the log file
            let logContent = '';
            try {
                if (fs.existsSync(logPath)) {
                    logContent = fs.readFileSync(logPath, 'utf8');
                } else {
                    logContent = 'Log file not found.';
                }
            } catch (err) {
                logContent = `Failed to read log file: ${err.message}`;
            }

            // System Info for Context
            const sysInfo = `
=== SYSTEM INFO ===
OS: ${process.platform} ${process.arch} ${typeof process.getSystemVersion === 'function' ? process.getSystemVersion() : 'Unknown Version'}
App Version: ${app.getVersion()}
Electron: ${process.versions.electron}
Date: ${new Date().toISOString()}
===================
            `;

            // Use the Crash Report endpoint via Telemetry Service
            // This ensures it appears in the "Crash Reports" tab of the panel
            await telemetryService.sendManualCrashReport(logContent, sysInfo);

            return { success: true, message: 'Logs uploaded successfully to crash reporter.' };
        } catch (e) {
            log.error('Manual Log Upload Failed:', e);
            return { success: false, error: e.message };
        }
    });

    // Unified Telemetry IPC
    const telemetryService = require('../services/telemetryService.cjs');
    const authService = require('../services/authService.cjs'); // [NEW]

    ipcMain.handle('track-telemetry-event', (event, { type, metadata }) => {
        telemetryService.track(type, metadata);
    });

    ipcMain.handle('get-auth-user-id', () => {
        return authService.getUserId();
    });

    // Launch on Startup
    ipcMain.handle('get-start-on-startup', () => {
        // Return stored preference if available (UI consistency), otherwise check system
        const stored = store ? store.get('settings_start_on_startup') : undefined;
        if (stored !== undefined) return stored;

        // Fallback to system state (e.g. migration from older version)
        const systemValue = app.getLoginItemSettings().openAtLogin;

        // Sync system state to store to ensure consistency going forward
        if (store) {
            store.set('settings_start_on_startup', systemValue);
        }

        return systemValue;
    });

    ipcMain.handle('set-start-on-startup', (event, value) => {
        const args = [];
        if (process.env.NODE_ENV === 'development') {
            args.push(app.getAppPath());
        }
        if (value) {
            args.push('--hidden');
        }

        app.setLoginItemSettings({
            openAtLogin: value,
            openAsHidden: value, // macOS
            path: app.getPath('exe'),
            args: args // Windows
        });

        if (store) {
            store.set('settings_initialized_startup', true);
            store.set('settings_start_on_startup', value);
        }

        // Return valid boolean directly to ensure UI updates immediately
        return value;
    });

    // Handle Default Value (First Run)
    if (store && !store.get('settings_initialized_startup')) {
        const args = [];
        if (process.env.NODE_ENV === 'development') {
            args.push(app.getAppPath());
        }
        args.push('--hidden');

        app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: true,
            path: app.getPath('exe'),
            args: args
        });
        store.set('settings_initialized_startup', true);
        store.set('settings_start_on_startup', true);
        log.info('[AppHandler] Startup enabled by default on first run.');
    }
}

module.exports = { setupAppHandlers };
