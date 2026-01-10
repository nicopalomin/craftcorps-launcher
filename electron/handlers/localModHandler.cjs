console.log('[DEBUG] Loading localModHandler.cjs');

const { ipcMain, dialog } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const getModMetadata = (fullPath, buffer = null) => {
    const file = path.basename(fullPath);
    const isEnabled = !file.endsWith('.disabled');
    let name = file;
    let version = '';

    try {
        const zip = buffer ? new AdmZip(buffer) : new AdmZip(fullPath);
        const zipEntries = zip.getEntries();

        // 1. Fabric (fabric.mod.json)
        const fabricEntry = zipEntries.find(e => e.entryName === 'fabric.mod.json');
        if (fabricEntry) {
            try {
                const json = JSON.parse(zip.readAsText(fabricEntry));
                name = json.name || json.id || file;
                version = json.version || '';
            } catch (e) { }
        }
        // 2. Forge (META-INF/mods.toml)
        else {
            const forgeEntry = zipEntries.find(e => e.entryName === 'META-INF/mods.toml');
            if (forgeEntry) {
                const text = zip.readAsText(forgeEntry);
                // Simple regex for displayName = "Name"
                const match = text.match(/displayName\s*=\s*["'](.*?)["']/);
                if (match) name = match[1];
                const verMatch = text.match(/version\s*=\s*["'](.*?)["']/);
                if (verMatch) version = verMatch[1];
            }
        }
    } catch (e) {
        // corrupted jar or otherwise unreadable
    }

    if (!version || version.startsWith('$')) {
        version = 'Unknown';
    }

    return {
        fileName: file,
        name: name,
        version: version,
        enabled: isEnabled,
        path: fullPath
    };
};

/**
 * Get Installed Mods
 */
const getInstanceMods = async (event, instancePath) => {
    if (!instancePath || !fs.existsSync(instancePath)) return [];

    const modsDir = path.join(instancePath, 'mods');
    if (!fs.existsSync(modsDir)) return [];

    try {
        const dirFiles = await fs.promises.readdir(modsDir);
        const files = dirFiles.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

        const mods = [];
        const chunkSize = 20;

        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);

            const chunkResults = await Promise.all(chunk.map(async (file) => {
                const fullPath = path.join(modsDir, file);
                try {
                    const buffer = await fs.promises.readFile(fullPath);
                    return getModMetadata(fullPath, buffer);
                } catch (e) {
                    return null;
                }
            }));

            chunkResults.forEach(r => { if (r) mods.push(r); });

            if (files.length > 100) await new Promise(r => setImmediate(r));
        }

        return mods;
    } catch (error) {
        log.error(`[Mods] Failed to scan mods: ${error.message}`);
        return [];
    }
};

/**
 * Delete Mod
 */
const deleteMod = async (event, filePath) => {
    if (!filePath) return { success: false, error: 'No file provided' };

    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }
        if (!filePath.endsWith('.jar') && !filePath.endsWith('.jar.disabled')) {
            return { success: false, error: 'Invalid file type' };
        }

        log.info(`[Mods] Deleting mod: ${filePath}`);
        fs.unlinkSync(filePath);
        return { success: true };
    } catch (error) {
        log.error(`[Mods] Failed to delete mod: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Add Instance Mods
 */
const addInstanceMods = async (event, { instancePath, filePaths }) => {
    log.info(`[Mods] Received add-instance-mods request for ${instancePath} with ${filePaths?.length} files`);

    try {
        if (!instancePath || !filePaths || filePaths.length === 0) {
            console.warn('[MAIN] Invalid arguments for add-instance-mods');
            return { success: false, error: 'Invalid arguments' };
        }

        const modsDir = path.join(instancePath, 'mods');
        if (!fs.existsSync(modsDir)) {
            try {
                fs.mkdirSync(modsDir, { recursive: true });
            } catch (e) {
                return { success: false, error: 'Could not create mods directory' };
            }
        }

        let addedCount = 0;
        const addedMods = [];
        const errors = [];

        for (const filePath of filePaths) {
            try {
                if (!fs.statSync(filePath).isFile()) continue;
                if (!filePath.toLowerCase().endsWith('.jar')) continue;
                const destPath = path.join(modsDir, path.basename(filePath));

                if (fs.existsSync(destPath)) {
                    errors.push(`Skipped ${path.basename(filePath)}: File already exists`);
                    continue;
                }

                await fs.promises.copyFile(filePath, destPath);
                const metadata = getModMetadata(destPath);
                addedMods.push(metadata);
                addedCount++;
            } catch (e) {
                errors.push(`Failed to copy ${path.basename(filePath)}: ${e.message}`);
            }
        }
        return { success: true, added: addedCount, errors, addedMods };

    } catch (globalError) {
        log.error('[Mods] Critical error in add-instance-mods:', globalError);
        return { success: false, error: `Internal Error: ${globalError.message}` };
    }
};

/**
 * Select Open Dialog for Mods
 */
const selectModFiles = async () => {
    log.info('[Mods] Opening file dialog for mod selection...');
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Mods (Jar)', extensions: ['jar'] }]
    });
    if (result.canceled) return [];
    return result.filePaths;
};

function setupLocalModHandlers() {
    log.info('[MAIN] Registered connection: setupLocalModHandlers');

    // Cleanup existing handlers (Safe for re-registration)
    ipcMain.removeHandler('get-instance-mods');
    ipcMain.removeHandler('delete-mod');
    ipcMain.removeHandler('add-instance-mods');
    ipcMain.removeHandler('select-mod-files');

    ipcMain.handle('get-instance-mods', getInstanceMods);
    ipcMain.handle('delete-mod', deleteMod);
    ipcMain.handle('add-instance-mods', addInstanceMods);
    ipcMain.handle('select-mod-files', selectModFiles);

    return {
        'get-instance-mods': getInstanceMods,
        'delete-mod': deleteMod,
        'add-instance-mods': addInstanceMods,
        'select-mod-files': selectModFiles
    };
}

module.exports = { setupLocalModHandlers, getInstanceMods, deleteMod, addInstanceMods, selectModFiles };
