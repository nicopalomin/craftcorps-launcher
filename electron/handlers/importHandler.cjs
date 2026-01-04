const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

/**
 * Handles importing instances from external sources (e.g. CurseForge folders)
 * 
 * Logic:
 * 1. User selects a folder.
 * 2. We analyze the folder for instance metadata (minecraftinstance.json or manifest.json).
 * 3. We create a new instance in CraftCorps 'instances' directory.
 * 4. We recursively copy contents (Async) to avoid freezing UI.
 * 5. We generate a CraftCorps instance.json.
 * 6. Return the new instance object.
 */
function setupImportHandlers() {

    ipcMain.handle('import-instance-dialog', async (event) => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select Instance Folder to Import',
                buttonLabel: 'Import'
            });

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, cancelled: true };
            }

            const sourceDir = result.filePaths[0];
            return { success: true, path: sourceDir };

        } catch (e) {
            log.error(`[Import] Dialog failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('perform-import-instance', async (event, sourcePath) => {
        try {
            log.info(`[Import] Starting import from: ${sourcePath}`);

            // 1. Analyze Source
            const cfJsonPath = path.join(sourcePath, 'minecraftinstance.json');
            const mmcJsonPath = path.join(sourcePath, 'instance.cfg'); // MultiMC
            const manifestPath = path.join(sourcePath, 'manifest.json'); // CurseForge Modpack Download (zip extracted)

            let meta = {
                name: path.basename(sourcePath),
                version: '1.20.1', // Default
                loader: 'Vanilla'
            };

            // Attempt to read CurseForge Metadata
            if (fs.existsSync(cfJsonPath)) {
                try {
                    const cfData = JSON.parse(fs.readFileSync(cfJsonPath, 'utf8'));
                    if (cfData.name) meta.name = cfData.name;
                    if (cfData.gameVersion) meta.version = cfData.gameVersion;
                    if (cfData.baseModLoader?.name) {
                        const l = cfData.baseModLoader.name.toLowerCase();
                        if (l.includes('forge')) meta.loader = 'Forge';
                        else if (l.includes('fabric')) meta.loader = 'Fabric';
                        else if (l.includes('quilt')) meta.loader = 'Quilt';
                        else if (l.includes('neoforge')) meta.loader = 'NeoForge';
                    }
                } catch (e) {
                    log.warn(`[Import] Failed to parse minecraftinstance.json: ${e.message}`);
                }
            } else if (fs.existsSync(manifestPath)) {
                // Determine if it's a modpack manifest
                try {
                    const mData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    if (mData.minecraft?.version) meta.version = mData.minecraft.version;
                    if (mData.name) meta.name = mData.name;
                    if (mData.minecraft?.modLoaders && mData.minecraft.modLoaders.length > 0) {
                        const l = mData.minecraft.modLoaders[0].id.toLowerCase();
                        if (l.includes('forge')) meta.loader = 'Forge';
                        else if (l.includes('fabric')) meta.loader = 'Fabric';
                        else if (l.includes('quilt')) meta.loader = 'Quilt';
                        else if (l.includes('neoforge')) meta.loader = 'NeoForge';
                    }
                } catch (e) { }
            }

            // 2. Prepare Destination
            const userData = app.getPath('userData');
            const instancesDir = path.join(userData, 'instances');
            if (!fs.existsSync(instancesDir)) fs.mkdirSync(instancesDir, { recursive: true });

            let finalName = meta.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
            // Ensure unique name
            let uniqueName = finalName;
            let counter = 1;
            while (fs.existsSync(path.join(instancesDir, uniqueName))) {
                uniqueName = `${finalName} (${counter})`;
                counter++;
            }

            const destDir = path.join(instancesDir, uniqueName);
            fs.mkdirSync(destDir, { recursive: true });

            // 3. Copy Files (Async)
            const ignoredItems = [
                'logs', 'crash-reports', 'webcache', 'cache',
                '.git', '.github', '.idea', '.vscode',
                'launcher_profiles.json', 'usercache.json',
                'temp', 'tmp', 'downloads', 'installer.jar', 'installer.log'
            ];

            // Helper for recursive copy (Async Fallback)
            const copyRecursiveAsync = async (src, dest) => {
                try {
                    const stats = await fs.promises.stat(src).catch(() => null);
                    if (!stats) return;

                    if (stats.isDirectory()) {
                        await fs.promises.mkdir(dest, { recursive: true });
                        const children = await fs.promises.readdir(src);
                        for (const child of children) {
                            await copyRecursiveAsync(path.join(src, child), path.join(dest, child));
                        }
                    } else {
                        await fs.promises.copyFile(src, dest);
                    }
                } catch (e) {
                    log.warn(`[Import] Recursive copy error: ${e.message}`);
                }
            };

            log.info(`[Import] Copying contents from ${sourcePath} to ${destDir}...`);

            const sourceItems = await fs.promises.readdir(sourcePath);

            for (const item of sourceItems) {
                // Skip basic ignored items
                if (ignoredItems.includes(item)) continue;
                // Skip dotfiles (except .minecraft)
                if (item.startsWith('.') && item !== '.minecraft') continue;
                // Skip metadata we handled
                if (item === 'minecraftinstance.json' || item === 'manifest.json' || item === 'instance.cfg') continue;

                const srcItem = path.join(sourcePath, item);
                const destItem = path.join(destDir, item);

                try {
                    // Log critical folders for debugging
                    if (item === 'scripts' || item === 'config' || item === 'resources' || item === 'kubejs' || item === 'fancymenu_data') {
                        log.info(`[Import] Copying critical folder: ${item}`);
                    }

                    // Use fs.promises.cp if available (Node 16.7.0+)
                    if (fs.promises.cp) {
                        await fs.promises.cp(srcItem, destItem, { recursive: true, preserveTimestamps: true, force: true });
                    } else {
                        await copyRecursiveAsync(srcItem, destItem);
                    }
                } catch (copyErr) {
                    log.warn(`[Import] Failed to copy ${item}: ${copyErr.message}`);
                }
            }

            // 4. Create Instance JSON
            const instanceData = {
                id: `inst_${Date.now()}`,
                name: uniqueName,
                version: meta.version,
                loader: meta.loader,
                path: destDir,
                status: 'Ready',
                lastPlayed: null,
                iconColor: 'bg-indigo-500', // Default
                bgGradient: 'from-indigo-900/40 to-slate-900',
                autoConnect: false,
                importedFrom: sourcePath
            };

            await fs.promises.writeFile(path.join(destDir, 'instance.json'), JSON.stringify(instanceData, null, 4));

            log.info(`[Import] Success: ${uniqueName}`);
            return { success: true, instance: instanceData };

        } catch (e) {
            log.error(`[Import] Failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    });
}

module.exports = { setupImportHandlers };
