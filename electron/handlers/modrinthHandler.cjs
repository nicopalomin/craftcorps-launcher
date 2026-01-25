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

// Track active installations at module level
const activeInstalls = new Map();

/**
 * Cancel Installation
 */
const cancelInstall = async (event, { projectId }) => {
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
};

/**
 * Search Modrinth
 */
const searchModrinth = async (event, { query, type, version, category, loader, offset = 0, limit = 20 }) => {
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
        if (loader) {
            facets.push([`categories:${loader}`]);
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
};

/**
 * Get Modrinth Tags (Categories, Versions, Loaders)
 */
const getTags = async (event, { type }) => {
    try {
        // type can be 'category', 'game_version', 'loader'
        // Endpoint: /v2/tag/{type}
        const baseUrl = 'https://api.modrinth.com/v2';
        const res = await fetch(`${baseUrl}/tag/${type}`);
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        const data = await res.json();
        return { success: true, data };
    } catch (error) {
        log.error(`[Modrinth] Get Tags ${type} failed: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Helper: Download File with Progress
 */
const downloadModFile = async (url, dir, filename, task, onProgress) => {
    if (task.cancelled) throw new Error("Cancelled by user");

    const dl = new DownloaderHelper(url, dir, {
        fileName: filename,
        override: true
    });

    task.downloader = dl;

    return new Promise((resolve, reject) => {
        dl.on('end', () => resolve({ success: true, file: filename }));
        dl.on('error', (err) => reject(new Error(`Download failed: ${err.message}`)));
        dl.on('stop', () => reject(new Error("Cancelled by user")));
        dl.on('progress', (stats) => {
            if (task.cancelled) {
                dl.stop();
                return;
            }
            if (onProgress) onProgress(stats);
        });
        dl.start();
    });
};

/**
 * Helper: Recursive Dependency Installer
 */
const installDependencies = async (event, dependencies, installDir, gameVersion, loader, task, visitedProjects, rootProjectId) => {
    for (const dep of dependencies) {
        if (task.cancelled) return;

        const depProjectId = dep.project_id;
        if (!depProjectId) continue;
        if (visitedProjects.has(depProjectId)) continue; // Already visited

        visitedProjects.add(depProjectId);

        try {
            // Resolve Dependency Version
            let depVersion = null;
            if (dep.version_id) {
                const versions = await client.getProjectVersionsById([dep.version_id]);
                depVersion = versions[0];
            } else {
                const versions = await client.getProjectVersions(depProjectId, {
                    loaders: [loader || 'fabric'],
                    gameVersions: [gameVersion]
                });
                depVersion = versions[0];
            }

            if (!depVersion) {
                log.warn(`[Modrinth] Dependency ${depProjectId} has no compatible version for ${gameVersion} (${loader}). Skipping.`);
                continue;
            }

            const depFile = depVersion.files.find(f => f.primary) || depVersion.files[0];
            if (!depFile) continue;

            const filePath = path.join(installDir, depFile.filename);
            if (fs.existsSync(filePath)) {
                // Determine if we should skip? Maybe check hash?
                // For now, assume existence means installed.
                log.info(`[Modrinth] Dependency ${depFile.filename} already exists. Skipping.`);
            } else {
                log.info(`[Modrinth] Downloading dependency ${depFile.filename}...`);

                // Notify UI
                event.sender.send('install-progress', {
                    projectId: rootProjectId,
                    step: `Installing dependency: ${depFile.filename}`,
                    progress: 0,
                    downloaded: 0,
                    total: 0
                });

                await downloadModFile(depFile.url, installDir, depFile.filename, task, (stats) => {
                    event.sender.send('install-progress', {
                        projectId: rootProjectId,
                        step: `Downloading dependency: ${depFile.filename}`,
                        progress: stats.progress,
                        downloaded: stats.downloaded,
                        total: stats.total,
                        speed: stats.speed,
                        remaining: stats.remaining
                    });
                });
            }

            // Recurse for sub-dependencies
            if (depVersion.dependencies && depVersion.dependencies.length > 0) {
                const subDeps = depVersion.dependencies.filter(d => d.dependency_type === "required");
                if (subDeps.length > 0) {
                    await installDependencies(event, subDeps, installDir, gameVersion, loader, task, visitedProjects, rootProjectId);
                }
            }

        } catch (e) {
            log.error(`[Modrinth] Failed to install dependency ${depProjectId}: ${e.message}`);
            // Continue with other dependencies even if one fails
        }
    }
};

/**
 * Install Mod
 */
const installMod = async (event, { project, instancePath, gameVersion, loader, versionId }) => {
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

        const isShader = project.project_type === 'shader';
        const installDir = path.join(targetDir, isShader ? 'shaderpacks' : 'mods');

        if (!fs.existsSync(installDir)) {
            fs.mkdirSync(installDir, { recursive: true });
        }

        let bestVersion;

        if (versionId) {
            const versions = await client.getProjectVersionsById([versionId]);
            bestVersion = versions[0];
        } else {
            // detailed version query
            const searchOptions = {
                gameVersions: [gameVersion]
            };

            if (!isShader) {
                searchOptions.loaders = [loader || 'fabric'];
            }

            const versions = await client.getProjectVersions(projectId, searchOptions);

            if (!versions || versions.length === 0) {
                const loaderMsg = isShader ? "any" : (loader || 'fabric');
                throw new Error(`No compatible version found for ${gameVersion} (${loaderMsg})`);
            }
            bestVersion = versions[0];
        }

        const primaryFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0];

        if (!primaryFile) {
            throw new Error("No file found for this version");
        }

        log.info(`[Modrinth] Downloading ${primaryFile.filename} to ${installDir}`);

        await downloadModFile(primaryFile.url, installDir, primaryFile.filename, task, (stats) => {
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

        // --- DEPENDENCY RESOLUTION ---
        if (!isShader && bestVersion.dependencies && bestVersion.dependencies.length > 0) {
            const requiredDeps = bestVersion.dependencies.filter(d => d.dependency_type === "required");
            if (requiredDeps.length > 0) {
                log.info(`[Modrinth] Resolving ${requiredDeps.length} dependencies for ${projectId}...`);
                event.sender.send('install-progress', { projectId, step: 'Resolving Dependencies...', progress: 100 });

                const visited = new Set([projectId]); // Don't reinstall self
                await installDependencies(event, requiredDeps, installDir, gameVersion, loader, task, visited, projectId);
            }
        }

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
};

/**
 * Install Modpack
 */
const installModpack = async (event, { project, instanceName, versionId }) => {
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
                } else if (indexData.dependencies['neoforge']) {
                    loaderVersion = indexData.dependencies['neoforge'];
                    // If we found neoforge, explicit that we want NeoForge
                    // This helps if bestVersion.loaders lists both or is ambiguous
                    if (bestVersion.loaders.includes('neoforge')) {
                        // Re-sort or force detection later?
                        // We can just rely on loaderVersion being set? 
                        // No, we need to save 'NeoForge' as the loader string in instance.json
                    }
                    log.info(`[Modrinth] Detected NeoForge version from index: ${loaderVersion}`);
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

        // Download Icon if available
        let base64Icon = null;
        if (project.icon_url && !task.cancelled) {
            try {
                log.info(`[Modrinth] Downloading modpack icon...`);
                const iconUrl = project.icon_url;
                const iconPath = path.join(instanceDir, 'icon.png');
                const res = await fetch(iconUrl);
                if (res.ok) {
                    const buffer = await res.arrayBuffer();
                    const nodeBuffer = Buffer.from(buffer);
                    fs.writeFileSync(iconPath, nodeBuffer);
                    base64Icon = `data:image/png;base64,${nodeBuffer.toString('base64')}`;
                }
            } catch (e) {
                log.warn(`[Modrinth] Failed to download pack icon: ${e.message}`);
            }
        }

        // Persist Instance Metadata (instance.json)
        const instanceId = `inst_${Date.now()}`;
        // Determines explicit loader type (fix for ambiguity)
        let detectedLoader = bestVersion.loaders[0];
        const availableLoaders = bestVersion.loaders.map(l => l.toLowerCase());

        if (availableLoaders.includes('neoforge')) detectedLoader = 'NeoForge';
        else if (availableLoaders.includes('fabric')) detectedLoader = 'Fabric';
        else if (availableLoaders.includes('forge')) detectedLoader = 'Forge';
        else if (bestVersion.loaders.length > 0) detectedLoader = bestVersion.loaders[0];

        // Capitalize properly
        if (detectedLoader && detectedLoader.toLowerCase() === 'neoforge') detectedLoader = 'NeoForge';
        if (detectedLoader && detectedLoader.toLowerCase() === 'fabric') detectedLoader = 'Fabric';
        if (detectedLoader && detectedLoader.toLowerCase() === 'forge') detectedLoader = 'Forge';

        const instanceData = {
            id: instanceId,
            name: finalName,
            version: gVersion,
            loader: detectedLoader || 'Fabric', // Loader Type (Fabric/Forge)
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
            icon: base64Icon, // Return base64 icon
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
};

/**
 * Get Project Details
 */
const getProject = async (event, { projectId }) => {
    try {
        const project = await client.getProject(projectId);
        return { success: true, data: project };
    } catch (error) {
        log.error(`[Modrinth] Get project failed: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Get Multiple Projects (Batch)
 */
const getProjects = async (event, { projectIds }) => {
    try {
        const projects = await client.getProjects(projectIds);
        return { success: true, data: projects };
    } catch (error) {
        log.error(`[Modrinth] Get projects batch failed: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Get Project Versions
 */
const getVersions = async (event, { projectId, loaders, gameVersions }) => {
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
};

function setupModrinthHandlers() {
    ipcMain.removeHandler('modrinth-cancel-install');
    ipcMain.removeHandler('modrinth-search');
    ipcMain.removeHandler('modrinth-get-tags');
    ipcMain.removeHandler('modrinth-install-mod');
    ipcMain.removeHandler('modrinth-install-modpack');
    ipcMain.removeHandler('modrinth-get-project');
    ipcMain.removeHandler('modrinth-get-projects');
    ipcMain.removeHandler('modrinth-get-versions');

    ipcMain.handle('modrinth-cancel-install', cancelInstall);
    ipcMain.handle('modrinth-search', searchModrinth);
    ipcMain.handle('modrinth-get-tags', getTags);
    ipcMain.handle('modrinth-install-mod', installMod);
    ipcMain.handle('modrinth-install-modpack', installModpack);
    ipcMain.handle('modrinth-get-project', getProject);
    ipcMain.handle('modrinth-get-projects', getProjects);
    ipcMain.handle('modrinth-get-versions', getVersions);

    return {
        'modrinth-cancel-install': cancelInstall,
        'modrinth-search': searchModrinth,
        'modrinth-get-tags': getTags,
        'modrinth-install-mod': installMod,
        'modrinth-install-modpack': installModpack,
        'modrinth-get-project': getProject,
        'modrinth-get-projects': getProjects,
        'modrinth-get-versions': getVersions
    };
}

module.exports = { setupModrinthHandlers };
