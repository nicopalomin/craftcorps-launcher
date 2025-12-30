const { ipcMain, app } = require('electron');
const { ModrinthV2Client } = require('@xmcl/modrinth');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { DownloaderHelper } = require('node-downloader-helper');
const AdmZip = require('adm-zip');

// Initialize Modrinth Client
// We can use a default user agent or one for this specific app
const client = new ModrinthV2Client({
    userAgent: 'CraftCorps/1.0.0 (contact@craftcorps.com)',
});

function setupModHandlers(getMainWindow) {

    // Track active installations for cancellation
    const activeInstalls = new Map();

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

    /**
     * Cancel Installation
     */
    ipcMain.handle('modrinth-cancel-install', async (event, { projectId }) => {
        if (activeInstalls.has(projectId)) {
            const task = activeInstalls.get(projectId);
            task.cancelled = true;
            if (task.downloader) {
                task.downloader.stop(); // This triggers 'end' or 'error' depending on implementation usually, or we handle it manually
            }
            log.info(`[Modrinth] Usage requested cancellation for project ${projectId}`);
            activeInstalls.delete(projectId);
            return { success: true };
        }
        return { success: false, error: 'No active installation found' };
    });

    /**
     * Search Modrinth
     * @param {string} query - Search query
     * @param {string} type - 'mod' or 'modpack'
     * @param {number} offset - Pagination offset
     * @param {string} limit - Results per page
     */
    ipcMain.handle('modrinth-search', async (event, { query, type, offset = 0, limit = 20 }) => {
        try {
            const facets = [];
            if (type) {
                facets.push([`project_type:${type}`]);
            }

            // You can add more facets like categories if needed in the future

            const results = await client.searchProjects({
                query: query,
                limit: limit,
                offset: offset,
                facets: facets.length > 0 ? JSON.stringify(facets) : undefined
            });

            return { success: true, data: results };
        } catch (error) {
            log.error(`[Modrinth] Search failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    /**
     * Install Mod
     * Downloads a mod to the specified instance folder (or default .minecraft/mods)
     */
    ipcMain.handle('modrinth-install-mod', async (event, { project, instancePath, gameVersion, loader, versionId }) => {
        const projectId = project.project_id;

        try {
            // Check if already installing
            if (activeInstalls.has(projectId)) {
                return { success: false, error: "Installation already in progress" };
            }

            // Register task
            const task = { cancelled: false, downloader: null };
            activeInstalls.set(projectId, task);

            // 1. Resolve Target Directory
            let targetDir = instancePath;
            if (!targetDir) {
                const os = process.platform;
                const home = process.env.HOME || process.env.USERPROFILE;
                if (os === 'win32') targetDir = path.join(process.env.APPDATA, '.minecraft');
                else if (os === 'darwin') targetDir = path.join(home, 'Library', 'Application Support', 'minecraft');
                else targetDir = path.join(home, '.minecraft');
            }
            const modsDir = path.join(targetDir, 'mods');
            if (!fs.existsSync(modsDir)) {
                fs.mkdirSync(modsDir, { recursive: true });
            }

            // 2. Get Version
            let bestVersion;

            if (versionId) {
                // Fetch specific version
                const versions = await client.getProjectVersionsById([versionId]);
                bestVersion = versions[0];
            } else {
                // Find compatible
                const versions = await client.getProjectVersions(projectId, {
                    loaders: [loader || 'fabric'],
                    gameVersions: [gameVersion]
                });

                if (!versions || versions.length === 0) {
                    throw new Error(`No compatible version found for ${gameVersion} (${loader})`);
                }
                bestVersion = versions[0];
            }

            const primaryFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0];

            if (!primaryFile) {
                throw new Error("No file found for this version");
            }

            // Check cancellation before download
            if (task.cancelled) throw new Error("Cancelled by user");

            // 3. Download
            log.info(`[Modrinth] Downloading ${primaryFile.filename} to ${modsDir}`);

            const dl = new DownloaderHelper(primaryFile.url, modsDir, {
                fileName: primaryFile.filename,
                override: true
            });

            task.downloader = dl;

            await new Promise((resolve, reject) => {
                dl.on('end', () => resolve({ success: true, file: primaryFile.filename }));
                dl.on('error', (err) => reject(new Error(`Download failed: ${err.message}`)));
                dl.on('stop', () => reject(new Error("Cancelled by user"))); // Handle explicit stop
                dl.on('progress', (stats) => {
                    if (task.cancelled) {
                        dl.stop();
                        return;
                    }
                    event.sender.send('install-progress', {
                        projectId,
                        step: 'Downloading Mod',
                        progress: stats.progress,
                        downloaded: stats.downloaded,
                        total: stats.total,
                        speed: stats.speed,
                        remaining: stats.remaining
                    });
                });
                dl.start();
            });

            activeInstalls.delete(projectId);
            return { success: true, file: primaryFile.filename };

        } catch (error) {
            activeInstalls.delete(projectId);
            log.error(`[Modrinth] Install failed: ${error.message}`);
            // If cancelled, we might want to return a specific "cancelled" flag if UI needs it, 
            // but error message usually suffices.
            if (error.message.includes("Cancelled")) {
                return { success: false, error: "Installation cancelled" };
            }
            return { success: false, error: error.message };
        }
    });

    /**
     * Install Modpack
     * Downloads an mrpack, extracts it (TODO: Resolve dependencies), and sets up an instance.
     */
    ipcMain.handle('modrinth-install-modpack', async (event, { project, instanceName, versionId }) => {
        const projectId = project.project_id;

        try {
            // Check if already installing
            if (activeInstalls.has(projectId)) {
                return { success: false, error: "Installation already in progress" };
            }

            const task = { cancelled: false, downloader: null };
            activeInstalls.set(projectId, task);

            // 1. Resolve Instances Directory
            const userData = app.getPath('userData');
            const instancesDir = path.join(userData, 'instances');

            if (!fs.existsSync(instancesDir)) fs.mkdirSync(instancesDir, { recursive: true });

            // Sanitize name
            let safeName = (instanceName || project.title).replace(/[^a-zA-Z0-9 -]/g, "").trim();
            let finalName = safeName;
            let instanceDir = path.join(instancesDir, safeName);

            let counter = 1;
            while (fs.existsSync(instanceDir)) {
                finalName = `${safeName} (${counter})`;
                instanceDir = path.join(instancesDir, finalName);
                counter++;
            }
            // Create dir tentatively - we might want to clean it up if cancelled?
            fs.mkdirSync(instanceDir);

            // 2. Get Version
            let bestVersion;

            if (task.cancelled) throw new Error("Cancelled by user");

            if (versionId) {
                // Fetch specific version
                const versions = await client.getProjectVersionsById([versionId]);
                bestVersion = versions[0];
            } else {
                const versions = await client.getProjectVersions(projectId, {
                    loaders: [], // Any loader
                    gameVersions: []
                });
                bestVersion = versions[0];
            }

            const primaryFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0];

            if (task.cancelled) throw new Error("Cancelled by user");

            // 3. Download mrpack
            log.info(`[Modrinth] Downloading Modpack ${primaryFile.filename}`);
            const mrpackPath = path.join(instanceDir, primaryFile.filename);

            const dl = new DownloaderHelper(primaryFile.url, instanceDir, {
                fileName: primaryFile.filename,
                override: true
            });
            task.downloader = dl;

            await new Promise((resolve, reject) => {
                dl.on('end', () => resolve());
                dl.on('error', reject);
                dl.on('stop', () => reject(new Error("Cancelled by user")));
                dl.on('progress', (stats) => {
                    if (task.cancelled) { dl.stop(); return; }
                    event.sender.send('install-progress', {
                        projectId,
                        step: 'Downloading Modpack',
                        progress: stats.progress,
                        downloaded: stats.downloaded,
                        total: stats.total,
                        speed: stats.speed,
                        remaining: stats.remaining
                    });
                });
                dl.start();
            });

            if (task.cancelled) throw new Error("Cancelled by user");

            // 4. Extract
            log.info(`[Modrinth] Extracting ${mrpackPath}`);
            event.sender.send('install-progress', { projectId, step: 'Extracting...', progress: 100 });

            const zip = new AdmZip(mrpackPath);
            zip.extractAllTo(instanceDir, true);

            // HANDLE OVERRIDES (Move files from overrides/ to root)
            // Function to recursive copy if fs.cpSync not available (older node) or ensuring merge behavior
            const copyRecursiveSync = (src, dest) => {
                const exists = fs.existsSync(src);
                const stats = exists && fs.statSync(src);
                const isDirectory = exists && stats.isDirectory();
                if (isDirectory) {
                    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
                    fs.readdirSync(src).forEach((childItemName) => {
                        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
                    });
                } else {
                    fs.copyFileSync(src, dest);
                }
            };

            const overridesDir = path.join(instanceDir, 'overrides');
            if (fs.existsSync(overridesDir)) {
                log.info('[Modrinth] Flattening overrides directory...');
                try {
                    // Use cpSync if available (Node 16.7+), else fallback
                    if (fs.cpSync) {
                        fs.cpSync(overridesDir, instanceDir, { recursive: true, force: true });
                    } else {
                        copyRecursiveSync(overridesDir, instanceDir);
                    }
                    // Remove overrides folder
                    fs.rmSync(overridesDir, { recursive: true, force: true });
                } catch (e) {
                    log.error(`[Modrinth] Failed to flatten overrides: ${e.message}`);
                }
            }

            // Clean up mrpack
            fs.unlinkSync(mrpackPath);

            if (task.cancelled) throw new Error("Cancelled by user");

            // 5. Process modrinth.index.json
            const indexPath = path.join(instanceDir, 'modrinth.index.json');
            if (fs.existsSync(indexPath)) {
                const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

                // Download all files
                if (indexData.files && indexData.files.length > 0) {
                    log.info(`[Modrinth] Downloading ${indexData.files.length} dependencies...`);
                    const totalFiles = indexData.files.length;
                    let processed = 0;

                    for (const file of indexData.files) {
                        if (task.cancelled) throw new Error("Cancelled by user");

                        const fileUrl = file.downloads[0];
                        const filePath = path.join(instanceDir, file.path); // e.g. mods/fabric-api.jar
                        const fileDir = path.dirname(filePath);

                        if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

                        try {
                            const dld = new DownloaderHelper(fileUrl, fileDir, {
                                fileName: path.basename(filePath),
                                override: true
                            });
                            task.downloader = dld;

                            await new Promise((res, rej) => {
                                dld.on('end', res);
                                dld.on('error', rej);
                                dld.on('stop', () => rej(new Error("Cancelled by user")));
                                dld.start();
                            });
                        } catch (e) {
                            if (e.message === "Cancelled by user") throw e;
                            log.error(`Failed to download ${path.basename(filePath)}: ${e.message}`);
                        }

                        processed++;
                        event.sender.send('install-progress', {
                            projectId,
                            step: `Downloading Files (${processed}/${totalFiles})`,
                            progress: (processed / totalFiles) * 100,
                            // Speed/Total is harder to aggregate here without tracking all DLs,
                            // so we omit or just send null.
                        });
                    }
                }
            }

            // Sanitize Version (Fix common typos or Bedrock artifacts like 1.21.11 -> 1.21.1)
            let gVersion = bestVersion.game_versions[0];
            if (gVersion === '1.21.11') {
                log.warn(`[Modrinth] Correcting suspicious version ${gVersion} to 1.21.1`);
                gVersion = '1.21.1';
            }

            activeInstalls.delete(projectId);
            return {
                success: true,
                instancePath: instanceDir,
                instanceName: finalName,
                version: gVersion,
                loader: bestVersion.loaders[0]
            };
        } catch (error) {
            activeInstalls.delete(projectId);
            log.error(`[Modrinth] Modpack Install failed: ${error.message}`);
            if (error.message.includes("Cancelled")) {
                return { success: false, error: "Installation cancelled" };
            }
            return { success: false, error: error.message };
        }
    });

    /**
     * Get Project Details
     */
    ipcMain.handle('modrinth-get-project', async (event, { projectId }) => {
        try {
            const project = await client.getProject(projectId);
            return { success: true, data: project };
        } catch (error) {
            log.error(`[Modrinth] Get project failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    /**
     * Get Multiple Projects (Batch)
     */
    ipcMain.handle('modrinth-get-projects', async (event, { projectIds }) => {
        try {
            const projects = await client.getProjects(projectIds);
            return { success: true, data: projects };
        } catch (error) {
            log.error(`[Modrinth] Get projects batch failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    /**
     * Get Project Versions
     * Useful for letting the user pick a specific version (e.g. for their MC version)
     */
    ipcMain.handle('modrinth-get-versions', async (event, { projectId, loaders, gameVersions }) => {
        try {
            const versions = await client.getProjectVersions(projectId, {
                loaders: loaders && loaders.length > 0 ? loaders : undefined,
                gameVersions: gameVersions && gameVersions.length > 0 ? gameVersions : undefined
            });
            return { success: true, data: versions };
        } catch (error) {
            log.error(`[Modrinth] Get versions failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });
    /**
     * Get Installed Mods
     * Scans the mods directory of an instance and returns list of mods
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
     * Add Instance Mods
     * Copies external files to the mods directory
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
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Mods (Jar)', extensions: ['jar'] }]
        });
        if (result.canceled) return [];
        return result.filePaths;
    });
}

module.exports = { setupModHandlers };
