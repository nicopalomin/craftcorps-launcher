const { ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

function setupResourcePackHandlers() {
    /**
     * Get Instance Resource Packs
     * Scans the resourcepacks directory and options.txt
     */
    ipcMain.handle('get-instance-resource-packs', async (event, instancePath) => {
        if (!instancePath || !fs.existsSync(instancePath)) return [];

        const packsDir = path.join(instancePath, 'resourcepacks');
        if (!fs.existsSync(packsDir)) return [];

        // Check options.txt for enabled packs
        let enabledPacks = [];
        const optionsPath = path.join(instancePath, 'options.txt');
        if (fs.existsSync(optionsPath)) {
            try {
                const content = fs.readFileSync(optionsPath, 'utf8');
                // Format: resourcePacks:["file/Pack.zip", "vanilla"]
                const match = content.match(/resourcePacks:\[(.*?)\]/);
                if (match) {
                    try {
                        const raw = `[${match[1]}]`; // reconstructed json array
                        const parsed = JSON.parse(raw);
                        enabledPacks = parsed.map(p => p.startsWith('file/') ? p.substring(5) : p);
                    } catch (e) {
                        // Fallback parsing
                        enabledPacks = match[1].split(',').map(s => {
                            let clean = s.trim().replace(/"/g, '');
                            if (clean.startsWith('file/')) clean = clean.substring(5);
                            return clean;
                        });
                    }
                }
            } catch (e) {
                log.warn(`[ResourcePacks] Failed to parse options.txt: ${e.message}`);
            }
        }

        try {
            const entries = fs.readdirSync(packsDir, { withFileTypes: true });
            const packs = [];

            for (const entry of entries) {
                // Yield to event loop
                await new Promise(resolve => setImmediate(resolve));

                const fullPath = path.join(packsDir, entry.name);
                let description = '';
                let icon = null; // Base64

                try {
                    if (entry.isDirectory()) {
                        const mcmetaPath = path.join(fullPath, 'pack.mcmeta');
                        if (fs.existsSync(mcmetaPath)) {
                            const json = JSON.parse(fs.readFileSync(mcmetaPath, 'utf8'));
                            description = json.pack?.description || '';
                            if (typeof description !== 'string') description = JSON.stringify(description);
                        }
                        const iconPath = path.join(fullPath, 'pack.png');
                        if (fs.existsSync(iconPath)) {
                            icon = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;
                        }
                    } else if (entry.name.endsWith('.zip')) {
                        const zip = new AdmZip(fullPath);
                        const mcmetaEntry = zip.getEntry('pack.mcmeta');
                        if (mcmetaEntry) {
                            const json = JSON.parse(zip.readAsText(mcmetaEntry));
                            description = json.pack?.description || '';
                            if (typeof description !== 'string') description = JSON.stringify(description);
                        }
                        const iconEntry = zip.getEntry('pack.png');
                        if (iconEntry) {
                            const buff = zip.readFile(iconEntry);
                            if (buff) icon = `data:image/png;base64,${buff.toString('base64')}`;
                        }
                    } else {
                        continue;
                    }

                    packs.push({
                        name: entry.name,
                        path: fullPath,
                        description: description.substring(0, 100), // Limit length
                        icon,
                        enabled: enabledPacks.includes(entry.name)
                    });
                } catch (e) {
                    // Skip corrupt packs
                    log.warn(`[ResourcePacks] Failed to read ${entry.name}: ${e.message}`);
                    packs.push({
                        name: entry.name,
                        path: fullPath,
                        description: "Failed to read pack info",
                        enabled: enabledPacks.includes(entry.name)
                    });
                }
            }
            return packs;
        } catch (error) {
            log.error(`[ResourcePacks] Failed to scan: ${error.message}`);
            return [];
        }
    });
    /**
     * Select Resource Pack Files
     */
    ipcMain.handle('select-resource-pack-files', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Resource Packs (Zip)', extensions: ['zip'] }]
        });
        if (result.canceled) return [];
        return result.filePaths;
    });

    /**
     * Add Instance Resource Packs
     */
    ipcMain.handle('add-instance-resource-packs', async (event, { instancePath, filePaths }) => {
        if (!instancePath || !filePaths || filePaths.length === 0) return { success: false, error: 'Invalid arguments' };

        const packsDir = path.join(instancePath, 'resourcepacks');
        if (!fs.existsSync(packsDir)) {
            await fs.promises.mkdir(packsDir, { recursive: true });
        }

        let addedCount = 0;
        const addedPacks = [];
        const errors = [];

        for (const filePath of filePaths) {
            try {
                const fileName = path.basename(filePath);
                const destPath = path.join(packsDir, fileName);

                if (fs.existsSync(destPath)) {
                    errors.push(`Skipped ${fileName}: File already exists`);
                    continue;
                }

                // VALIDATION: Check for pack.mcmeta BEFORE copying
                try {
                    const zip = new AdmZip(filePath);
                    if (!zip.getEntry('pack.mcmeta')) {
                        errors.push(`Skipped ${fileName}: Not a valid resource pack (missing pack.mcmeta)`);
                        continue;
                    }
                } catch (e) {
                    errors.push(`Skipped ${fileName}: Invalid zip file`);
                    continue;
                }

                await fs.promises.copyFile(filePath, destPath);

                // Read metadata for return
                let description = '';
                let icon = null;
                try {
                    const zip = new AdmZip(destPath);
                    const mcmetaEntry = zip.getEntry('pack.mcmeta');
                    if (mcmetaEntry) {
                        const json = JSON.parse(zip.readAsText(mcmetaEntry));
                        description = json.pack?.description || '';
                        if (typeof description !== 'string') description = JSON.stringify(description);
                    }
                    const iconEntry = zip.getEntry('pack.png');
                    if (iconEntry) {
                        const buff = zip.readFile(iconEntry);
                        if (buff) icon = `data:image/png;base64,${buff.toString('base64')}`;
                    }
                } catch (e) {
                    log.warn(`[ResourcePacks] Failed to read metadata for ${fileName}: ${e.message}`);
                }

                addedPacks.push({
                    name: fileName,
                    path: destPath,
                    description,
                    icon,
                    enabled: false
                });
                addedCount++;
            } catch (e) {
                log.error(`[ResourcePacks] Failed to add ${filePath}: ${e.message}`);
                errors.push(`Failed ${path.basename(filePath)}: ${e.message}`);
            }
        }

        return { success: true, added: addedCount, addedPacks, errors };
    });

    /**
     * Delete Resource Pack
     */
    ipcMain.handle('delete-resource-pack', async (event, filePath) => {
        if (!filePath) return { success: false, error: 'No file path provided' };
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                log.info(`[ResourcePacks] Deleted: ${filePath}`);
                return { success: true };
            } else {
                return { success: false, error: 'File not found' };
            }
        } catch (e) {
            log.error(`[ResourcePacks] Failed to delete ${filePath}: ${e.message}`);
            return { success: false, error: e.message };
        }
    });
}

module.exports = { setupResourcePackHandlers };
