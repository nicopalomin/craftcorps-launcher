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

        // FIX: Corrupt Main JAR Check (ZipException: zip file is empty)
        // MCLC sometimes creates an empty jar file if download fails or is interrupted.
        // We check if the jar exists and is invalid (size 0), then delete it.
        const versionJarPath = path.join(versionsDir, `${fabricVersionId}.jar`);
        if (fs.existsSync(versionJarPath)) {
            const stats = fs.statSync(versionJarPath);
            if (stats.size === 0) {
                emit('log', { type: 'WARN', message: `Detected empty/corrupt version JAR: ${versionJarPath}` });
                emit('log', { type: 'INFO', message: 'Deleting corrupt JAR to allow redownload.' });
                fs.unlinkSync(versionJarPath);
            }
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

                    // SANITIZATION: Remove conflicting Vanilla ASM libs (Fixes duplicate ASM crash)
                    // Even if we already merged libraries, we must check for conflicts (e.g. from previous broken runs)
                    const vanillaAsmLibs = vanillaData.libraries.filter(l => l.name.includes('org.ow2.asm'));
                    if (vanillaAsmLibs.length > 0) {
                        const preCount = fabricData.libraries.length;
                        fabricData.libraries = fabricData.libraries.filter(fl => {
                            // If this lib is one of the Vanilla ASM libs, remove it (Fabric provides its own compatible version)
                            const isBis = vanillaAsmLibs.some(vl => vl.name === fl.name);
                            if (isBis) return false;
                            return true;
                        });

                        if (fabricData.libraries.length !== preCount) {
                            emit('log', { type: 'INFO', message: 'Sanitized Fabric JSON: Removed conflicting Vanilla ASM libraries.' });
                            changed = true;
                        }
                    }

                    const firstVanillaLib = vanillaData.libraries[0];
                    const alreadyHasVanilla = firstVanillaLib && fabricData.libraries.some(l => l.name === firstVanillaLib.name);

                    if (!alreadyHasVanilla) {
                        emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla libraries...' });

                        // MERGE: Add all vanilla libs EXCEPT ASM ones
                        const filteredVanillaLibs = vanillaData.libraries.filter(lib => {
                            if (lib.name.includes('org.ow2.asm')) {
                                // emit('log', { type: 'DEBUG', message: `Skipping Vanilla lib: ${lib.name}` });
                                return false;
                            }
                            return true;
                        });

                        fabricData.libraries = [...fabricData.libraries, ...filteredVanillaLibs];
                        changed = true;
                    }

                    // PATCH 4: Merge Arguments (Fixes missing --assetsDir, duplicates, etc)
                    if (vanillaData.arguments) {
                        if (!fabricData.arguments) {
                            // If Fabric has no args, just take Vanilla's
                            fabricData.arguments = JSON.parse(JSON.stringify(vanillaData.arguments));
                        } else {
                            // Merge Game Args
                            if (vanillaData.arguments.game) {
                                if (!fabricData.arguments.game) fabricData.arguments.game = [];
                                // Combine: Fabric args + Vanilla args
                                fabricData.arguments.game = [...fabricData.arguments.game, ...vanillaData.arguments.game];
                            }
                            // Merge JVM Args
                            if (vanillaData.arguments.jvm) {
                                if (!fabricData.arguments.jvm) fabricData.arguments.jvm = [];
                                fabricData.arguments.jvm = [...fabricData.arguments.jvm, ...vanillaData.arguments.jvm];
                            }
                        }
                        changed = true;
                    } else if (vanillaData.minecraftArguments) {
                        // Legacy handling (1.12 and older)
                        if (!fabricData.minecraftArguments && !fabricData.arguments) {
                            fabricData.minecraftArguments = vanillaData.minecraftArguments;
                            changed = true;
                        }
                    }

                    // FINAL CHECK: Ensure --gameDir exists
                    // Vanilla usually provides it, but just in case:
                    if (fabricData.arguments && fabricData.arguments.game) {
                        // Note: args can be strings or objects. We look for the string flag.
                        const hasGameDir = fabricData.arguments.game.some(arg => typeof arg === 'string' && arg === '--gameDir');
                        if (!hasGameDir) {
                            emit('log', { type: 'INFO', message: 'Patching Fabric JSON with --gameDir argument...' });
                            fabricData.arguments.game.push('--gameDir', '${game_directory}');
                            changed = true;
                        }
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
