console.log('[DEBUG] Loading localModHandler.cjs');

const { ipcMain, dialog, app } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const getModMetadata = (fullPath, buffer = null) => {
    const file = path.basename(fullPath);
    const isEnabled = !file.endsWith('.disabled');
    let name = file;
    let version = '';
    let modId = null;

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
                modId = json.id || null;
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

                // Extract modId
                const idMatch = text.match(/modId\s*=\s*["'](.*?)["']/);
                if (idMatch) modId = idMatch[1];
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
        path: fullPath,
        modId: modId
    };
};


let modCache = {}; // { [instancePath]: { mtime: number, mods: [] } }
const modCachePath = path.join(app.getPath('userData'), 'mod-cache.json');

const loadModCacheFromDisk = () => {
    try {
        if (fs.existsSync(modCachePath)) {
            const data = fs.readFileSync(modCachePath, 'utf8');
            modCache = JSON.parse(data);
            log.info(`[Mods] Loaded mod cache from disk (${Object.keys(modCache).length} instances)`);
        }
    } catch (e) {
        log.error(`[Mods] Failed to load mod cache: ${e.message}`);
    }
};

const saveModCacheToDisk = () => {
    try {
        fs.writeFileSync(modCachePath, JSON.stringify(modCache));
        log.info('[Mods] Saved mod cache to disk');
    } catch (e) {
        log.error(`[Mods] Failed to save mod cache: ${e.message}`);
    }
};

// Load immediately on module load
loadModCacheFromDisk();

const scanModsDirectory = async (instancePath, modsDir) => {
    const getFilesRecursively = async (dir) => {
        const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.join(dir, dirent.name);
            return dirent.isDirectory() ? getFilesRecursively(res) : res;
        }));
        return files.flat();
    };

    let allFiles = [];
    try {
        allFiles = await getFilesRecursively(modsDir);
    } catch (e) {
        return [];
    }

    const jarFiles = allFiles.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

    const mods = [];
    const chunkSize = 20;

    for (let i = 0; i < jarFiles.length; i += chunkSize) {
        const chunk = jarFiles.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (fullPath) => {
            try {
                const buffer = await fs.promises.readFile(fullPath);
                return getModMetadata(fullPath, buffer);
            } catch (e) {
                return null;
            }
        }));
        chunkResults.forEach(r => { if (r) mods.push(r); });
        if (jarFiles.length > 20) await new Promise(r => setImmediate(r));
    }
    return mods;
};

/**
 * Verify Instance Mods (Background)
 */
const verifyInstanceMods = async (event, instancePath) => {
    if (!instancePath) return;
    const modsDir = path.join(instancePath, 'mods');

    // If mods dir missing, empty list
    if (!fs.existsSync(modsDir)) {
        if (modCache[instancePath] && modCache[instancePath].mods.length > 0) {
            // Changed from having mods to no mods
            modCache[instancePath] = { mtime: 0, mods: [] };
            if (event && event.sender && !event.sender.isDestroyed()) {
                event.sender.send('instance-mods-updated', { instancePath, mods: [] });
            }
        }
        return;
    }

    try {
        const stats = await fs.promises.stat(modsDir);
        const folderMtime = stats.mtimeMs;

        // Check if cache is stale based on directory mtime
        if (modCache[instancePath] && modCache[instancePath].mtime === folderMtime) {
            // Cache is valid based on mtime.
            return;
        }

        // Mtime changed, scan.
        const mods = await scanModsDirectory(instancePath, modsDir);

        // Update Cache
        modCache[instancePath] = {
            mtime: folderMtime,
            mods: mods
        };

        // Notify Frontend
        if (event && event.sender && !event.sender.isDestroyed()) {
            log.info(`[Mods] Background scan updated mods for ${path.basename(instancePath)}`);
            event.sender.send('instance-mods-updated', { instancePath, mods });
        }

    } catch (e) {
        log.error(`[Mods] Background verification failed: ${e.message}`);
    }
};

/**
 * Get Installed Mods
 */
const getInstanceMods = async (event, instancePath, force = false) => {
    if (!instancePath) return [];

    // 1. Return Cache Immediately if available (unless forced)
    if (modCache[instancePath] && !force) {
        // Trigger background verification
        verifyInstanceMods(event, instancePath).catch(err => console.error(err));

        log.info(`[Mods] Returning cached mods for ${path.basename(instancePath)} (Lazy verification started)`);
        return modCache[instancePath].mods;
    }

    // 2. If no cache, perform synchronous wait (or async but awaited) for first load
    if (!fs.existsSync(instancePath)) return [];
    const modsDir = path.join(instancePath, 'mods');
    if (!fs.existsSync(modsDir)) return [];

    try {
        const stats = await fs.promises.stat(modsDir);
        const folderMtime = stats.mtimeMs;
        const mods = await scanModsDirectory(instancePath, modsDir);

        modCache[instancePath] = {
            mtime: folderMtime,
            mods: mods
        };
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

        // Invalidate Cache
        const instancePath = path.dirname(path.dirname(filePath));

        if (modCache[instancePath]) {
            modCache[instancePath].mods = modCache[instancePath].mods.filter(m => m.path !== filePath);
        }

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

        // Update Cache
        if (modCache[instancePath]) {
            modCache[instancePath].mods = [...modCache[instancePath].mods, ...addedMods];
            const stats = fs.statSync(modsDir);
            modCache[instancePath].mtime = stats.mtimeMs;
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
        'select-mod-files': selectModFiles,
        saveModCacheToDisk // Exported for use in main
    };
}

module.exports = { setupLocalModHandlers, getInstanceMods, deleteMod, addInstanceMods, selectModFiles, saveModCacheToDisk };
