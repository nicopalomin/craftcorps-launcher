const { ipcMain, app, dialog, shell } = require('electron');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');

const os = require('os');
const si = require('systeminformation');

function setupAppHandlers(getMainWindow, store) {

    // System Info for Telemetry
    ipcMain.handle('get-system-info', async () => {
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

            // Add system info for context
            const sysInfo = `
=== SYSTEM INFO ===
OS: ${process.platform} ${process.arch} ${typeof process.getSystemVersion === 'function' ? process.getSystemVersion() : 'Unknown Version'}
App Version: ${app.getVersion()}
Electron: ${process.versions.electron}
Date: ${new Date().toISOString()}
===================
            `;

            const finalContent = sysInfo + '\n' + logContent;

            // Upload
            const blob = new Blob([finalContent], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('file', blob, 'manual_log_report.txt');

            const uploadUrl = 'http://148.113.49.235:3000/crash-report';

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}: ${response.statusText}`);

            return { success: true, message: 'Logs uploaded successfully.' };
        } catch (e) {
            log.error('Manual Log Upload Failed:', e);
            return { success: false, error: e.message };
        }
    });
}

module.exports = { setupAppHandlers };
