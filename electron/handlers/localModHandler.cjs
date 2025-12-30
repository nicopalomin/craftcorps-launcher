const { ipcMain, dialog } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const getModMetadata = (fullPath) => {
    const file = path.basename(fullPath);
    const isEnabled = !file.endsWith('.disabled');
    let name = file;
    let version = '';

    try {
        const zip = new AdmZip(fullPath);
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
    /**
     * Get Installed Mods
     */
    ipcMain.handle('get-instance-mods', async (event, instancePath) => {
        if (!instancePath || !fs.existsSync(instancePath)) return [];

        const modsDir = path.join(instancePath, 'mods');
        if (!fs.existsSync(modsDir)) return [];

        try {
            const files = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

            const mods = [];
            for (const file of files) {
                // Yield to event loop to unblock UI/IPC
                await new Promise(resolve => setImmediate(resolve));
                mods.push(getModMetadata(path.join(modsDir, file)));
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
    ipcMain.handle('add-instance-mods', async (event, { instancePath, filePaths }) => {
        if (!instancePath || !filePaths || filePaths.length === 0) return { success: false, error: 'Invalid arguments' };

        const modsDir = path.join(instancePath, 'mods');
        if (!fs.existsSync(modsDir)) {
            try { fs.mkdirSync(modsDir, { recursive: true }); } catch (e) { return { success: false, error: 'Could not create mods directory' }; }
        }

        let addedCount = 0;
        const addedMods = [];
        const errors = [];

        for (const filePath of filePaths) {
            try {
                if (!fs.statSync(filePath).isFile()) continue;
                if (!filePath.toLowerCase().endsWith('.jar')) {
                    errors.push(`Skipped ${path.basename(filePath)}: Not a JAR file`);
                    continue;
                }
                const destPath = path.join(modsDir, path.basename(filePath));
                await fs.promises.copyFile(filePath, destPath);
                addedMods.push(getModMetadata(destPath));
                addedCount++;
            } catch (e) {
                errors.push(`Failed to copy ${path.basename(filePath)}: ${e.message}`);
            }
        }

        return { success: true, added: addedCount, errors, addedMods };
    });

    /**
     * Select Open Dialog for Mods
     */
    ipcMain.handle('select-mod-files', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Mods (Jar)', extensions: ['jar'] }]
        });
        if (result.canceled) return [];
        return result.filePaths;
    });
}

module.exports = { setupLocalModHandlers };
