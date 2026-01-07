const path = require('path');
const fs = require('fs');
const LauncherNetwork = require('./LauncherNetwork.cjs');

class QuiltHandler {
    static async prepare(options, launchOptions, emit) {
        emit('log', { type: 'INFO', message: 'Resolving Quilt Loader...' });
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
            emit('log', { type: 'INFO', message: `Fetching latest Quilt loader for ${gameVersion}...` });
            // Quilt Meta API v3
            const meta = await LauncherNetwork.getJson(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}`);
            if (meta && meta.length > 0) {
                loaderVersion = meta[0].loader.version;
            } else {
                throw new Error(`No Quilt loader found for ${gameVersion}`);
            }
        }

        const quiltVersionId = `quilt-loader-${loaderVersion}-${gameVersion}`;
        emit('log', { type: 'INFO', message: `Targeting Quilt: ${quiltVersionId}` });

        // Check version JSON
        const versionsDir = path.join(launchOptions.root, 'versions', quiltVersionId);
        const versionJsonPath = path.join(versionsDir, `${quiltVersionId}.json`);

        emit('log', { type: 'DEBUG', message: `Checking Quilt JSON at: ${versionJsonPath}` });

        if (!fs.existsSync(versionJsonPath)) {
            emit('log', { type: 'INFO', message: 'Downloading Quilt profile...' });
            fs.mkdirSync(versionsDir, { recursive: true });
            const profileUrl = `https://meta.quiltmc.org/v3/versions/loader/${gameVersion}/${loaderVersion}/profile/json`;
            await LauncherNetwork.downloadFile(profileUrl, versionJsonPath);
            emit('log', { type: 'INFO', message: 'Quilt profile installed.' });
        } else {
            emit('log', { type: 'DEBUG', message: `Quilt JSON exists. Size: ${fs.statSync(versionJsonPath).size} bytes` });
        }

        // FIX: Corrupt Main JAR Check (ZipException: zip file is empty)
        // MCLC sometimes creates an empty jar file if download fails or is interrupted.
        // We check if the jar exists and is invalid (size 0), then delete it.
        const versionJarPath = path.join(versionsDir, `${quiltVersionId}.jar`);
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
            let quiltData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
            let changed = false;

            if (vanillaData.downloads && vanillaData.downloads.client) {
                // Check if downloads.client is missing
                if (!quiltData.downloads || !quiltData.downloads.client) {
                    emit('log', { type: 'INFO', message: 'Patching Quilt JSON with Vanilla downloads...' });

                    if (!quiltData.downloads) quiltData.downloads = {};
                    quiltData.downloads.client = vanillaData.downloads.client;

                    if (!quiltData.downloads.server && vanillaData.downloads.server) {
                        quiltData.downloads.server = vanillaData.downloads.server;
                    }
                    changed = true;
                    emit('log', { type: 'DEBUG', message: 'Quilt JSON patched successfully.' });
                } else {
                    emit('log', { type: 'DEBUG', message: 'Quilt JSON already has client download info.' });
                }

                // PATCH 2: Ensure Asset Index exists
                if (!quiltData.assetIndex || !quiltData.assetIndex.url) {
                    if (vanillaData.assetIndex) {
                        emit('log', { type: 'INFO', message: 'Patching Quilt JSON with Vanilla assetIndex...' });
                        quiltData.assetIndex = vanillaData.assetIndex;
                        if (vanillaData.assets) quiltData.assets = vanillaData.assets;
                        changed = true;
                    }
                }

                // PATCH 3 & 4: Merge Libraries & Arguments
                if (vanillaData.libraries) {
                    if (!quiltData.libraries) {
                        quiltData.libraries = [];
                        changed = true;
                    }

                    // Check if we already patched this file to avoid duplication
                    const firstVanillaLib = vanillaData.libraries[0];
                    const alreadyHasVanilla = firstVanillaLib && quiltData.libraries.some(l => l.name === firstVanillaLib.name);

                    if (!alreadyHasVanilla) {
                        // SANITIZATION: Remove conflicting Vanilla ASM libs (Fixes duplicate ASM crash)
                        const vanillaAsmLibs = vanillaData.libraries.filter(l => l.name.includes('org.ow2.asm'));
                        if (vanillaAsmLibs.length > 0) {
                            const preCount = quiltData.libraries.length;
                            quiltData.libraries = quiltData.libraries.filter(fl => {
                                const isBis = vanillaAsmLibs.some(vl => vl.name === fl.name);
                                return !isBis;
                            });
                            if (quiltData.libraries.length !== preCount) {
                                emit('log', { type: 'INFO', message: 'Sanitized Quilt JSON: Removed conflicting Vanilla ASM libraries.' });
                                changed = true;
                            }
                        }

                        emit('log', { type: 'INFO', message: 'Patching Quilt JSON with Vanilla libraries...' });

                        // MERGE: Add all vanilla libs EXCEPT ASM ones
                        const filteredVanillaLibs = vanillaData.libraries.filter(lib => {
                            if (lib.name.includes('org.ow2.asm')) return false;
                            return true;
                        });

                        quiltData.libraries = [...quiltData.libraries, ...filteredVanillaLibs];
                        changed = true;

                        // PATCH 4: Merge Arguments (Only done if we just merged libraries to prevent dupes)
                        if (vanillaData.arguments) {
                            if (!quiltData.arguments) {
                                // If Quilt has no args, just take Vanilla's
                                quiltData.arguments = JSON.parse(JSON.stringify(vanillaData.arguments));
                            } else {
                                // Merge Game Args
                                if (vanillaData.arguments.game) {
                                    if (!quiltData.arguments.game) quiltData.arguments.game = [];
                                    // Combine: Quilt args + Vanilla args
                                    quiltData.arguments.game = [...quiltData.arguments.game, ...vanillaData.arguments.game];
                                }
                                // Merge JVM Args
                                if (vanillaData.arguments.jvm) {
                                    if (!quiltData.arguments.jvm) quiltData.arguments.jvm = [];
                                    quiltData.arguments.jvm = [...quiltData.arguments.jvm, ...vanillaData.arguments.jvm];
                                }
                            }
                            changed = true;
                        } else if (vanillaData.minecraftArguments) {
                            // Legacy handling (1.12 and older)
                            if (!quiltData.minecraftArguments && !quiltData.arguments) {
                                quiltData.minecraftArguments = vanillaData.minecraftArguments;
                                changed = true;
                            }
                        }

                        // FINAL CHECK: Ensure --gameDir exists
                        if (quiltData.arguments && quiltData.arguments.game) {
                            const hasGameDir = quiltData.arguments.game.some(arg => typeof arg === 'string' && arg === '--gameDir');
                            if (!hasGameDir) {
                                emit('log', { type: 'INFO', message: 'Patching Quilt JSON with --gameDir argument...' });
                                quiltData.arguments.game.push('--gameDir', '${game_directory}');
                                changed = true;
                            }
                        }
                    } else {
                        emit('log', { type: 'DEBUG', message: 'Quilt JSON already contains Vanilla libraries/args. Skipping merge.' });
                    }
                }

                if (changed) {
                    fs.writeFileSync(versionJsonPath, JSON.stringify(quiltData, null, 2));
                    emit('log', { type: 'DEBUG', message: 'Quilt libraries/args patched.' });
                }
            } else {
                emit('log', { type: 'WARN', message: 'Vanilla JSON missing client download info!' });
            }
        } catch (e) {
            emit('log', { type: 'WARN', message: `Failed to patch client jar info: ${e.message}` });
        }

        launchOptions.version.number = quiltVersionId;
        launchOptions.version.custom = quiltVersionId;
    }
}

module.exports = QuiltHandler;
