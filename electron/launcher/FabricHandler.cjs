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
                    }

                    // Check if we already merged vanilla libs by checking for a known vanilla lib (e.g. valid vanilla lib like 'oshi-core' or similar, not asm)
                    // Or just filter and merge unique ones.
                    const vanillaAsmLibs = vanillaData.libraries.filter(l => l.name.includes('org.ow2.asm'));

                    // Sanitize Fabric libs if they contain vanilla ASM conflicts
                    if (vanillaAsmLibs.length > 0) {
                        const preCount = fabricData.libraries.length;
                        fabricData.libraries = fabricData.libraries.filter(fl => {
                            const isBis = vanillaAsmLibs.some(vl => vl.name === fl.name);
                            return !isBis;
                        });
                        if (fabricData.libraries.length !== preCount) {
                            emit('log', { type: 'INFO', message: 'Sanitized Fabric JSON: Removed conflicting Vanilla ASM libraries.' });
                            changed = true;
                        }
                    }

                    // Identify libraries to add
                    const libsToAdd = vanillaData.libraries.filter(vLib => {
                        // Skip ASM
                        if (vLib.name.includes('org.ow2.asm')) return false;
                        // Skip if already exists
                        return !fabricData.libraries.some(fLib => fLib.name === vLib.name);
                    });

                    if (libsToAdd.length > 0) {
                        emit('log', { type: 'INFO', message: `Patching Fabric JSON with ${libsToAdd.length} Vanilla libraries...` });
                        fabricData.libraries = [...fabricData.libraries, ...libsToAdd];
                        changed = true;
                    }
                }

                // PATCH 4: Merge Arguments
                if (vanillaData.arguments) {
                    if (!fabricData.arguments) {
                        // Inherit all if missing
                        emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla arguments (full)...' });
                        fabricData.arguments = JSON.parse(JSON.stringify(vanillaData.arguments));
                        changed = true;
                    } else {
                        // Merge Game Args
                        if (vanillaData.arguments.game) {
                            if (!fabricData.arguments.game) fabricData.arguments.game = [];

                            // Dedup arguments?? 
                            // It's hard to dedup arguments like "--version".
                            // Strategy: If Fabric args seems "custom only", append Vanilla.
                            // Heuristic: If "--version" is missing in Fabric args, assume we need to merge Vanilla args.
                            const hasVersionArg = fabricData.arguments.game.some(arg => arg === '--version');

                            if (!hasVersionArg) {
                                emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla game arguments...' });
                                fabricData.arguments.game = [...fabricData.arguments.game, ...vanillaData.arguments.game];
                                changed = true;
                            }
                        }
                        // Merge JVM Args
                        if (vanillaData.arguments.jvm) {
                            if (!fabricData.arguments.jvm) fabricData.arguments.jvm = [];
                            const hasCpArg = fabricData.arguments.jvm.some(arg => arg === '-cp' || arg === '-classpath');

                            if (!hasCpArg) { // Weak check, but safer than duping
                                // Actually JVM args usually handled by MCLC fine without this, but let's include if empty
                                if (fabricData.arguments.jvm.length === 0) {
                                    fabricData.arguments.jvm = [...vanillaData.arguments.jvm];
                                    changed = true;
                                }
                            }
                        }
                    }
                } else if (vanillaData.minecraftArguments) {
                    // Legacy handling
                    if (!fabricData.minecraftArguments && !fabricData.arguments) {
                        emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla minecraftArguments...' });
                        fabricData.minecraftArguments = vanillaData.minecraftArguments;
                        changed = true;
                    }
                }

                // FINAL CHECK: Ensure --gameDir exists (Always run this)
                if (fabricData.arguments && fabricData.arguments.game) {
                    const hasGameDir = fabricData.arguments.game.some(arg => typeof arg === 'string' && arg === '--gameDir');
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
