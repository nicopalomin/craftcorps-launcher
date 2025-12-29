const { ipcMain } = require('electron');
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
            const os = process.platform;
            const home = process.env.HOME || process.env.USERPROFILE;
            let baseDir;
            if (os === 'win32') baseDir = path.join(process.env.APPDATA, 'CraftCorps'); // Use our own folder for instances
            else baseDir = path.join(home, 'Library', 'Application Support', 'CraftCorps');

            if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

            const instancesDir = path.join(baseDir, 'instances');
            if (!fs.existsSync(instancesDir)) fs.mkdirSync(instancesDir);

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

            // Clean up
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

            activeInstalls.delete(projectId);
            return {
                success: true,
                instancePath: instanceDir,
                instanceName: finalName,
                version: bestVersion.game_versions[0],
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
}

module.exports = { setupModHandlers };
