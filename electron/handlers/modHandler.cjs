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
    ipcMain.handle('modrinth-install-mod', async (event, { project, instancePath, gameVersion, loader }) => {
        try {
            const projectId = project.project_id;

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
            // We need to find the version compatible with the game version and loader
            const versions = await client.getProjectVersions(projectId, {
                loaders: [loader || 'fabric'], // Default to fabric if not specified? Or maybe vanilla (which implies specific mods)
                gameVersions: [gameVersion]
            });

            if (!versions || versions.length === 0) {
                throw new Error(`No compatible version found for ${gameVersion} (${loader})`);
            }

            const bestVersion = versions[0]; // First one is usually latest
            const primaryFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0];

            if (!primaryFile) {
                throw new Error("No file found for this version");
            }

            // 3. Download
            log.info(`[Modrinth] Downloading ${primaryFile.filename} to ${modsDir}`);

            const dl = new DownloaderHelper(primaryFile.url, modsDir, {
                fileName: primaryFile.filename,
                override: true
            });

            return new Promise((resolve, reject) => {
                dl.on('end', () => resolve({ success: true, file: primaryFile.filename }));
                dl.on('error', (err) => reject(new Error(`Download failed: ${err.message}`)));
                // dl.on('progress', (stats) => ... send progress via event if needed ... );
                dl.start();
            });

        } catch (error) {
            log.error(`[Modrinth] Install failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    /**
     * Install Modpack
     * Downloads an mrpack, extracts it (TODO: Resolve dependencies), and sets up an instance.
     */
    ipcMain.handle('modrinth-install-modpack', async (event, { project, instanceName }) => {
        try {
            const projectId = project.project_id;

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
            const safeName = (instanceName || project.title).replace(/[^a-zA-Z0-9 -]/g, "").trim();
            const instanceDir = path.join(instancesDir, safeName);

            if (fs.existsSync(instanceDir)) {
                throw new Error(`Instance '${safeName}' already exists.`);
            }
            fs.mkdirSync(instanceDir);

            // 2. Get Version (Get latest stable)
            const versions = await client.getProjectVersions(projectId, {
                loaders: [], // Any loader
                gameVersions: []
            });
            const bestVersion = versions[0];
            const primaryFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0];

            // 3. Download mrpack
            log.info(`[Modrinth] Downloading Modpack ${primaryFile.filename}`);
            const mrpackPath = path.join(instanceDir, primaryFile.filename);

            const dl = new DownloaderHelper(primaryFile.url, instanceDir, {
                fileName: primaryFile.filename,
                override: true
            });

            await new Promise((resolve, reject) => {
                dl.on('end', () => resolve());
                dl.on('error', reject);
                dl.start();
            });

            // 4. Extract (Simple Unzip for now - full mrpack parsing is complex)
            // mrpack is just a zip. Inside is "modrinth.index.json" and "overrides".
            // For a REAL implementation, we must parse index.json and download each file.
            // For MVP: We just unzip and hope (this won't work for mods, only overrides).
            // ACTUALLY: We MUST parse index.json to get the mods.

            log.info(`[Modrinth] Extracting ${mrpackPath}`);
            const zip = new AdmZip(mrpackPath);
            zip.extractAllTo(instanceDir, true);

            // Clean up
            fs.unlinkSync(mrpackPath);

            // 5. Process modrinth.index.json
            const indexPath = path.join(instanceDir, 'modrinth.index.json');
            if (fs.existsSync(indexPath)) {
                const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

                // Download all files
                if (indexData.files && indexData.files.length > 0) {
                    log.info(`[Modrinth] Downloading ${indexData.files.length} dependencies...`);

                    // We'll download sequentially to avoid overwhelmed net/fs, or small batches
                    for (const file of indexData.files) {
                        const fileUrl = file.downloads[0];
                        const filePath = path.join(instanceDir, file.path); // e.g. mods/fabric-api.jar
                        const fileDir = path.dirname(filePath);

                        if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });

                        log.info(`[Modrinth] Downloading dependency: ${path.basename(filePath)}`);
                        // Simple download (ignoring env like client/server specific for now)
                        try {
                            const dl = new DownloaderHelper(fileUrl, fileDir, {
                                fileName: path.basename(filePath),
                                override: true
                            });
                            await new Promise((res, rej) => {
                                dl.on('end', res);
                                dl.on('error', rej);
                                dl.start();
                            });
                        } catch (e) {
                            log.error(`Failed to download ${path.basename(filePath)}: ${e.message}`);
                            // Continue? Or fail? Usually modpacks need all mods.
                        }
                    }
                }
            }

            return {
                success: true,
                instancePath: instanceDir,
                version: bestVersion.game_versions[0],
                loader: bestVersion.loaders[0]
            };

        } catch (error) {
            log.error(`[Modrinth] Modpack Install failed: ${error.message}`);
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
                loaders: loaders, // e.g. ['fabric', 'forge']
                gameVersions: gameVersions // e.g. ['1.20.1']
            });
            return { success: true, data: versions };
        } catch (error) {
            log.error(`[Modrinth] Get versions failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { setupModHandlers };
