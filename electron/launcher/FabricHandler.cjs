const path = require('path');
const fs = require('fs');
const LauncherNetwork = require('./LauncherNetwork.cjs');

class FabricHandler {
    static async prepare(options, launchOptions, emit) {
        emit('log', { type: 'INFO', message: 'Resolving Fabric Loader...' });
        const gameVersion = launchOptions.version.number;
        const manifestPath = path.join(launchOptions.root, 'cache', 'json', 'version_manifest.json');

        // Ensure Vanilla Parent Exists
        const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
        const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);

        emit('log', { type: 'DEBUG', message: `Checking Vanilla JSON at: ${vanillaJson}` });

        if (!fs.existsSync(vanillaJson)) {
            emit('log', { type: 'INFO', message: `Bootstrap: Missing Vanilla ${gameVersion}. Downloading...` });
            try {
                const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const vData = manifestData.versions.find(v => v.id === gameVersion);
                if (vData) {
                    fs.mkdirSync(vanillaDir, { recursive: true });
                    await LauncherNetwork.downloadFile(vData.url, vanillaJson);
                    emit('log', { type: 'INFO', message: `Vanilla ${gameVersion} manifest downloaded.` });
                } else {
                    throw new Error(`Version ${gameVersion} not found in manifest!`);
                }
            } catch (e) {
                emit('log', { type: 'WARN', message: `Bootstrap Error: ${e.message}` });
            }
        } else {
            emit('log', { type: 'DEBUG', message: `Vanilla JSON exists. Size: ${fs.statSync(vanillaJson).size} bytes` });
        }

        let loaderVersion = options.loaderVersion;

        if (!loaderVersion) {
            emit('log', { type: 'INFO', message: `Fetching latest Fabric loader for ${gameVersion}...` });
            const meta = await LauncherNetwork.getJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`);
            if (meta && meta.length > 0) {
                loaderVersion = meta[0].loader.version;
            } else {
                throw new Error(`No Fabric loader found for ${gameVersion}`);
            }
        }

        const fabricVersionId = `fabric-loader-${loaderVersion}-${gameVersion}`;
        emit('log', { type: 'INFO', message: `Targeting Fabric: ${fabricVersionId}` });

        // Check version JSON
        const versionsDir = path.join(launchOptions.root, 'versions', fabricVersionId);
        const versionJsonPath = path.join(versionsDir, `${fabricVersionId}.json`);

        emit('log', { type: 'DEBUG', message: `Checking Fabric JSON at: ${versionJsonPath}` });

        if (!fs.existsSync(versionJsonPath)) {
            emit('log', { type: 'INFO', message: 'Downloading Fabric profile...' });
            fs.mkdirSync(versionsDir, { recursive: true });
            const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/profile/json`;
            await LauncherNetwork.downloadFile(profileUrl, versionJsonPath);
            emit('log', { type: 'INFO', message: 'Fabric profile installed.' });
        } else {
            emit('log', { type: 'DEBUG', message: `Fabric JSON exists. Size: ${fs.statSync(versionJsonPath).size} bytes` });
        }

        // WORKAROUND: MCLC Crash "Cannot read properties of undefined (reading 'client')"
        try {
            const vanillaData = JSON.parse(fs.readFileSync(vanillaJson, 'utf-8'));
            let fabricData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
            let changed = false;

            if (vanillaData.downloads && vanillaData.downloads.client) {
                // Check if downloads.client is missing
                if (!fabricData.downloads || !fabricData.downloads.client) {
                    emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla downloads...' });

                    if (!fabricData.downloads) fabricData.downloads = {};
                    fabricData.downloads.client = vanillaData.downloads.client;

                    if (!fabricData.downloads.server && vanillaData.downloads.server) {
                        fabricData.downloads.server = vanillaData.downloads.server;
                    }
                    changed = true;
                    emit('log', { type: 'DEBUG', message: 'Fabric JSON patched successfully.' });
                } else {
                    emit('log', { type: 'DEBUG', message: 'Fabric JSON already has client download info.' });
                }

                // PATCH 2: Ensure Asset Index exists
                if (!fabricData.assetIndex || !fabricData.assetIndex.url) {
                    if (vanillaData.assetIndex) {
                        emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla assetIndex...' });
                        fabricData.assetIndex = vanillaData.assetIndex;
                        if (vanillaData.assets) fabricData.assets = vanillaData.assets;
                        changed = true;
                    }
                }

                // PATCH 3: Merge Libraries
                if (vanillaData.libraries) {
                    if (!fabricData.libraries) {
                        fabricData.libraries = [];
                        changed = true;
                    }

                    const firstVanillaLib = vanillaData.libraries[0];
                    const alreadyHasVanilla = firstVanillaLib && fabricData.libraries.some(l => l.name === firstVanillaLib.name);

                    if (!alreadyHasVanilla) {
                        emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla libraries...' });

                        // FIX: Duplicate ASM classes crash (java.lang.ExceptionInInitializerError)
                        // Fabric Loader bundles ASM, but vanilla (1.18+) often includes newer 'org.ow2.asm' libs.
                        // Sometimes older asm-commons/asm-util libs conflict.
                        // We filter out vanilla ASM libs that might conflict.
                        const filteredVanillaLibs = vanillaData.libraries.filter(lib => {
                            // Filter out explicit 'org.ow2.asm:asm-all' or similar if problematic
                            // But usually the issue is duplicate versions of asm/asm-commons/asm-util

                            // Let's filter out older asm versions if we suspect conflict, 
                            // OR just trust the user report: "duplicate ASM classes found... asm-9.9.jar ... asm-9.6.jar"

                            if (lib.name.includes('org.ow2.asm') || lib.name.includes('asm-all')) {
                                // If Fabric already provides ASM (which it does indirectly or via boot), we might be double adding.
                                // However, we need vanilla libs for Realms/etc usually.

                                // Specific Fix: The crash shows conflict between ASM 9.9 and ASM 9.6.
                                // If vanilla has 9.9 and we (or fabric) added 9.6, that's bad.
                                // Fabric usually adds its own dependencies.

                                // Improved approach: Don't add Vanilla's ASM libs if Fabric has its own ASM libs
                                const hasFabricAsm = fabricData.libraries.some(fl => fl.name && fl.name.includes('org.ow2.asm') && fl.name.split(':')[1] === lib.name.split(':')[1]);
                                return !hasFabricAsm;
                            }
                            return true;
                        });

                        fabricData.libraries = [...fabricData.libraries, ...filteredVanillaLibs];
                        changed = true;
                    }

                    // PATCH 4: Ensure --gameDir argument exists
                    if (!fabricData.arguments) fabricData.arguments = {};
                    if (!fabricData.arguments.game) fabricData.arguments.game = [];

                    const hasGameDir = fabricData.arguments.game.includes('--gameDir');
                    if (!hasGameDir) {
                        emit('log', { type: 'INFO', message: 'Patching Fabric JSON with --gameDir argument...' });
                        fabricData.arguments.game.push('--gameDir', '${game_directory}');
                        changed = true;
                    }
                }

                if (changed) {
                    fs.writeFileSync(versionJsonPath, JSON.stringify(fabricData, null, 2));
                    emit('log', { type: 'DEBUG', message: 'Fabric libraries/args patched.' });
                }
            } else {
                emit('log', { type: 'WARN', message: 'Vanilla JSON missing client download info!' });
            }
        } catch (e) {
            emit('log', { type: 'WARN', message: `Failed to patch client jar info: ${e.message}` });
        }

        launchOptions.version.number = fabricVersionId;
        launchOptions.version.custom = fabricVersionId;
    }
}

module.exports = FabricHandler;
