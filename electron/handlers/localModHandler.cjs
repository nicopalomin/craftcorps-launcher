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

function setupLocalModHandlers() {
    console.log('[MAIN] Registered connection: setupLocalModHandlers');
    log.info('[MAIN] Registered connection: setupLocalModHandlers');

    // Cleanup existing handlers (Safe for re-registration)
    ipcMain.removeHandler('get-instance-mods');
    ipcMain.removeHandler('delete-mod');
    ipcMain.removeHandler('add-instance-mods');
    ipcMain.removeHandler('select-mod-files');

    /**
     * Get Installed Mods
     */
    ipcMain.handle('get-instance-mods', async (event, instancePath) => {
        if (!instancePath || !fs.existsSync(instancePath)) return [];

        const modsDir = path.join(instancePath, 'mods');
        if (!fs.existsSync(modsDir)) return [];

        try {
            const dirFiles = await fs.promises.readdir(modsDir);
            const files = dirFiles.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

            const mods = [];
            const chunkSize = 20; // Process 20 files at a time to check resource usage

            for (let i = 0; i < files.length; i += chunkSize) {
                const chunk = files.slice(i, i + chunkSize);

                // Process chunk in parallel
                const chunkResults = await Promise.all(chunk.map(async (file) => {
                    const fullPath = path.join(modsDir, file);
                    try {
                        const buffer = await fs.promises.readFile(fullPath);
                        return getModMetadata(fullPath, buffer);
                    } catch (e) {
                        return null;
                    }
                }));

                // Filter nulls and add to main list
                chunkResults.forEach(r => { if (r) mods.push(r); });

                // Small yield to keep UI responsive if list is huge
                if (files.length > 100) await new Promise(r => setImmediate(r));
            }

            return mods;
        } catch (error) {
            log.error(`[Mods] Failed to scan mods: ${error.message}`);
            return [];
        }
    });

    /**
     * Delete Mod
     */
    ipcMain.handle('delete-mod', async (event, filePath) => {
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
    });

    /**
     * Add Instance Mods
     */
    /**
     * Add Instance Mods
     */
    ipcMain.handle('add-instance-mods', async (event, { instancePath, filePaths }) => {
        console.log(`[MAIN] add-instance-mods invoked for ${instancePath}`);
        log.info(`[Mods] Received add-instance-mods request for ${instancePath} with ${filePaths?.length} files`);

        try {
            if (!instancePath || !filePaths || filePaths.length === 0) {
                console.warn('[MAIN] Invalid arguments for add-instance-mods');
                log.warn('[Mods] Invalid arguments for add-instance-mods');
                return { success: false, error: 'Invalid arguments' };
            }

            const modsDir = path.join(instancePath, 'mods');
            if (!fs.existsSync(modsDir)) {
                try {
                    fs.mkdirSync(modsDir, { recursive: true });
                    console.log(`[MAIN] Created mods directory: ${modsDir}`);
                    log.info(`[Mods] Created mods directory: ${modsDir}`);
                } catch (e) {
                    console.error(`[MAIN] Failed to create mods dir: ${e.message}`);
                    log.error(`[Mods] Failed to create mods directory: ${e.message}`);
                    return { success: false, error: 'Could not create mods directory' };
                }
            }

            let addedCount = 0;
            const addedMods = [];
            const errors = [];

            for (const filePath of filePaths) {
                try {
                    console.log(`[MAIN] Processing file: ${filePath}`);
                    log.info(`[Mods] Processing file: ${filePath}`);
                    if (!fs.statSync(filePath).isFile()) {
                        log.warn(`[Mods] Not a file: ${filePath}`);
                        continue;
                    }
                    if (!filePath.toLowerCase().endsWith('.jar')) {
                        errors.push(`Skipped ${path.basename(filePath)}: Not a JAR file`);
                        log.warn(`[Mods] Skipped non-jar: ${filePath}`);
                        continue;
                    }
                    const destPath = path.join(modsDir, path.basename(filePath));

                    if (fs.existsSync(destPath)) {
                        const msg = `Skipped ${path.basename(filePath)}: File already exists`;
                        errors.push(msg);
                        log.info(`[Mods] ${msg}`);
                        continue; // Skip copy
                    }

                    console.log(`[MAIN] Copying to: ${destPath}`);
                    log.info(`[Mods] Copying to: ${destPath}`);
                    await fs.promises.copyFile(filePath, destPath);

                    console.log(`[MAIN] Reading metadata for: ${destPath}`);
                    log.info(`[Mods] Reading metadata for: ${destPath}`);
                    const metadata = getModMetadata(destPath);
                    addedMods.push(metadata);
                    addedCount++;
                    log.info(`[Mods] Successfully added: ${metadata.name}`);
                } catch (e) {
                    const msg = `Failed to copy ${path.basename(filePath)}: ${e.message}`;
                    errors.push(msg);
                    console.error(`[MAIN] Error processing file: ${e.message}`, e);
                    log.error(`[Mods] ${msg}`);
                }
            }

            console.log(`[MAIN] Finished adding mods. Added: ${addedCount}`);
            log.info(`[Mods] Finished adding mods. Added: ${addedCount}, Errors: ${errors.length}`);
            return { success: true, added: addedCount, errors, addedMods };

        } catch (globalError) {
            console.error('[MAIN] CRITICAL FILTER ERROR:', globalError);
            log.error('[Mods] Critical error in add-instance-mods:', globalError);
            return { success: false, error: `Internal Error: ${globalError.message}` };
        }
    });

    /**
     * Select Open Dialog for Mods
     */
    ipcMain.handle('select-mod-files', async () => {
        log.info('[Mods] Opening file dialog for mod selection...');
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Mods (Jar)', extensions: ['jar'] }]
        });
        if (result.canceled) {
            log.info('[Mods] File selection cancelled by user.');
            return [];
        }
        log.info(`[Mods] User selected ${result.filePaths.length} files: ${JSON.stringify(result.filePaths)}`);
        return result.filePaths;
    });
}

module.exports = { setupLocalModHandlers };
