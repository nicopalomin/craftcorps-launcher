const { ipcMain, app } = require('electron');
const { ModrinthV2Client } = require('@xmcl/modrinth');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { DownloaderHelper } = require('node-downloader-helper');
const AdmZip = require('adm-zip');

// Initialize Modrinth Client
const client = new ModrinthV2Client({
    userAgent: 'CraftCorps/1.0.0 (contact@craftcorps.com)',
});

function setupModrinthHandlers() {
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
                task.downloader.stop();
            }
            log.info(`[Modrinth] Usage requested cancellation for project ${projectId}`);
            activeInstalls.delete(projectId);
            return { success: true };
        }
        return { success: false, error: 'No active installation found' };
    });

    /**
     * Search Modrinth
     */
    ipcMain.handle('modrinth-search', async (event, { query, type, version, category, offset = 0, limit = 20 }) => {
        try {
            const facets = [];
            if (type) {
                facets.push([`project_type:${type}`]);
            }
            if (version) {
                facets.push([`versions:${version}`]);
            }
            if (category) {
                facets.push([`categories:${category}`]);
            }

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
     * Get Modrinth Tags (Categories, Versions, Loaders)
     */
    ipcMain.handle('modrinth-get-tags', async (event, { type }) => {
        try {
            // type can be 'category', 'game_version', 'loader'
            // Endpoint: /v2/tag/{type}
            // The client library might not expose direct 'getTags', lets use raw HTTP or check client methods. 
            // Checking xmcl docs or types... client has request method?
            // Actually, just using built-in fetch or axios if the client doesn't support it directly
            // is safer. But wait, we can just use the provided fetch from electron? No, use node-fetch or native fetch in 18+

            // Let's rely on native fetch since Electron uses Node 18+
            const baseUrl = 'https://api.modrinth.com/v2';
            const res = await fetch(`${baseUrl}/tag/${type}`);
            if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
            const data = await res.json();
            return { success: true, data };
        } catch (error) {
            log.error(`[Modrinth] Get Tags ${type} failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    /**
     * Install Mod
     */
    ipcMain.handle('modrinth-install-mod', async (event, { project, instancePath, gameVersion, loader, versionId }) => {
        const projectId = project.project_id;

        try {
            if (activeInstalls.has(projectId)) {
                return { success: false, error: "Installation already in progress" };
            }

            const task = { cancelled: false, downloader: null };
            activeInstalls.set(projectId, task);

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

            let bestVersion;

            if (versionId) {
                const versions = await client.getProjectVersionsById([versionId]);
                bestVersion = versions[0];
            } else {
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

            if (task.cancelled) throw new Error("Cancelled by user");

            log.info(`[Modrinth] Downloading ${primaryFile.filename} to ${modsDir}`);

            const dl = new DownloaderHelper(primaryFile.url, modsDir, {
                fileName: primaryFile.filename,
                override: true
            });

            task.downloader = dl;

            await new Promise((resolve, reject) => {
                dl.on('end', () => resolve({ success: true, file: primaryFile.filename }));
                dl.on('error', (err) => reject(new Error(`Download failed: ${err.message}`)));
                dl.on('stop', () => reject(new Error("Cancelled by user")));
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
            if (error.message.includes("Cancelled")) {
                return { success: false, error: "Installation cancelled" };
            }
            return { success: false, error: error.message };
        }
    });

    /**
     * Install Modpack
     */
    ipcMain.handle('modrinth-install-modpack', async (event, { project, instanceName, versionId }) => {
        const projectId = project.project_id;

        try {
            if (activeInstalls.has(projectId)) {
                return { success: false, error: "Installation already in progress" };
            }

            const task = { cancelled: false, downloader: null };
            activeInstalls.set(projectId, task);

            const userData = app.getPath('userData');
            const instancesDir = path.join(userData, 'instances');

            if (!fs.existsSync(instancesDir)) fs.mkdirSync(instancesDir, { recursive: true });

            let safeName = (instanceName || project.title).replace(/[^a-zA-Z0-9 -]/g, "").trim();
            let finalName = safeName;
            let instanceDir = path.join(instancesDir, safeName);

            let counter = 1;
            while (fs.existsSync(instanceDir)) {
                finalName = `${safeName} (${counter})`;
                instanceDir = path.join(instancesDir, finalName);
                counter++;
            }
            fs.mkdirSync(instanceDir);

            let bestVersion;

            if (task.cancelled) throw new Error("Cancelled by user");

            if (versionId) {
                const versions = await client.getProjectVersionsById([versionId]);
                bestVersion = versions[0];
            } else {
                const versions = await client.getProjectVersions(projectId, {
                    loaders: [],
                    gameVersions: []
                });
                bestVersion = versions[0];
            }

            const primaryFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0];

            if (task.cancelled) throw new Error("Cancelled by user");

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

            log.info(`[Modrinth] Extracting ${mrpackPath}`);
            event.sender.send('install-progress', { projectId, step: 'Extracting...', progress: 100 });

            const zip = new AdmZip(mrpackPath);
            zip.extractAllTo(instanceDir, true);

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
                    if (fs.cpSync) {
                        fs.cpSync(overridesDir, instanceDir, { recursive: true, force: true });
                    } else {
                        copyRecursiveSync(overridesDir, instanceDir);
                    }
                    fs.rmSync(overridesDir, { recursive: true, force: true });
                } catch (e) {
                    log.error(`[Modrinth] Failed to flatten overrides: ${e.message}`);
                }
            }

            fs.unlinkSync(mrpackPath);

            if (task.cancelled) throw new Error("Cancelled by user");

            let gVersion = bestVersion.game_versions[0];
            let loaderVersion = bestVersion.loaders[0];

            const indexPath = path.join(instanceDir, 'modrinth.index.json');
            if (fs.existsSync(indexPath)) {
                const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

                // FIX: Trust local index dependencies over API metadata for game/loader versions
                if (indexData.dependencies) {
                    if (indexData.dependencies.minecraft) {
                        gVersion = indexData.dependencies.minecraft;
                        log.info(`[Modrinth] Detected Minecraft version from index: ${gVersion}`);
                    }

                    // Also try to detect specific loader version
                    if (indexData.dependencies['fabric-loader']) {
                        loaderVersion = indexData.dependencies['fabric-loader'];
                        log.info(`[Modrinth] Detected Fabric Loader version from index: ${loaderVersion}`);
                    } else if (indexData.dependencies['forge']) {
                        // Handle forge
                        loaderVersion = indexData.dependencies['forge'];
                    }
                }

                if (indexData.files && indexData.files.length > 0) {
                    log.info(`[Modrinth] Downloading ${indexData.files.length} dependencies...`);
                    const totalFiles = indexData.files.length;
                    let processed = 0;

                    for (const file of indexData.files) {
                        if (task.cancelled) throw new Error("Cancelled by user");

                        const fileUrl = file.downloads[0];
                        const filePath = path.join(instanceDir, file.path);
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
                        });
                    }
                }
            }

            // Persist Instance Metadata (instance.json)
            const instanceId = `inst_${Date.now()}`;
            // Pick rand color/gradient defaults for backend-created instance? 
            // Should match frontend defaults or stay neutral.
            // But frontend will likely overwrite this via save-instance soon. 
            // This is a safety measure.
            const instanceData = {
                id: instanceId,
                name: finalName,
                version: gVersion, // Now using trust-source from index
                loader: bestVersion.loaders[0] || 'Fabric', // Loader Type (Fabric/Forge)
                loaderVersion: loaderVersion, // Explicit loader version if found
                path: instanceDir,
                status: 'Ready',
                lastPlayed: null,
                iconColor: 'bg-emerald-500', // Default
                bgGradient: 'from-emerald-900/40 to-slate-900', // Default
                autoConnect: false,
                modpackProjectId: projectId,
                modpackVersionId: versionId || bestVersion.id
            };

            try {
                fs.writeFileSync(path.join(instanceDir, 'instance.json'), JSON.stringify(instanceData, null, 4));
            } catch (e) {
                log.error(`[Modrinth] Failed to write instance.json: ${e.message}`);
            }

            activeInstalls.delete(projectId);
            return {
                success: true,
                instancePath: instanceDir,
                instanceName: finalName,
                version: gVersion,
                loader: bestVersion.loaders[0],
                id: instanceId, // Return ID so frontend can use it if it wants
                ...instanceData
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

module.exports = { setupModrinthHandlers };
