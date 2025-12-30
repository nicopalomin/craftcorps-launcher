const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const LauncherNetwork = require('./LauncherNetwork.cjs');

class ForgeHandler {
    static async prepare(options, launchOptions, emit) {
        emit('log', { type: 'INFO', message: 'Resolving Forge Loader...' });
        const gameVersion = launchOptions.version.number;
        let forgeVersion = options.loaderVersion;

        // 1. Resolve Forge Version if missing
        if (!forgeVersion) {
            emit('log', { type: 'INFO', message: `Fetching latest Forge version for ${gameVersion}...` });
            const promos = await LauncherNetwork.getJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
            const recommendedKey = `${gameVersion}-recommended`;
            const latestKey = `${gameVersion}-latest`;

            if (promos.promos[recommendedKey]) {
                forgeVersion = promos.promos[recommendedKey];
            } else if (promos.promos[latestKey]) {
                forgeVersion = promos.promos[latestKey];
            } else {
                throw new Error(`No Forge version found for ${gameVersion}`);
            }
        }

        const forgeVersionId = `${gameVersion}-forge-${forgeVersion}`;
        const versionsDir = path.join(launchOptions.root, 'versions');
        const specificVersionDir = path.join(versionsDir, forgeVersionId);
        const versionJson = path.join(specificVersionDir, `${forgeVersionId}.json`);

        emit('log', { type: 'INFO', message: `Targeting Forge: ${forgeVersionId}` });

        // 2. Bootstrap: Ensure Vanilla Parent Exists
        const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
        const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);
        if (!fs.existsSync(vanillaJson)) {
            emit('log', { type: 'INFO', message: `Bootstrap: Missing Vanilla ${gameVersion}. Downloading...` });
            try {
                const manifestPath = path.join(launchOptions.root, 'cache', 'json', 'version_manifest.json');
                if (fs.existsSync(manifestPath)) {
                    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    const vData = manifestData.versions.find(v => v.id === gameVersion);
                    if (vData) {
                        fs.mkdirSync(vanillaDir, { recursive: true });
                        await LauncherNetwork.downloadFile(vData.url, vanillaJson);

                        const vMeta = await LauncherNetwork.getJson(vData.url);
                        if (vMeta.downloads && vMeta.downloads.client) {
                            const clientJar = path.join(vanillaDir, `${gameVersion}.jar`);
                            if (!fs.existsSync(clientJar)) {
                                emit('log', { type: 'INFO', message: `Downloading Vanilla Client JAR...` });
                                await LauncherNetwork.downloadFile(vMeta.downloads.client.url, clientJar);
                            }
                        }
                        emit('log', { type: 'INFO', message: `Vanilla ${gameVersion} bootstrapped.` });
                    }
                }
            } catch (e) {
                emit('log', { type: 'WARN', message: `Vanilla Bootstrap failed: ${e.message}` });
            }
        }

        // FIX: Corrupt Main JAR Check
        // If the Forge version jar exists but is empty (0 bytes), delete it to force installer run
        const versionJarPath = path.join(specificVersionDir, `${forgeVersionId}.jar`);
        if (fs.existsSync(versionJarPath)) {
            try {
                const stats = fs.statSync(versionJarPath);
                if (stats.size === 0) {
                    emit('log', { type: 'WARN', message: `Detected empty/corrupt Forge JAR: ${versionJarPath}` });
                    emit('log', { type: 'INFO', message: 'Deleting corrupt JAR to allow re-installation.' });
                    fs.unlinkSync(versionJarPath);
                    // Force re-run of installer by ensuring json is also gone or just ignoring it?
                    // If json exists, we might skip installer.
                    // Let's ensure strict check later.
                    if (fs.existsSync(versionJson)) fs.unlinkSync(versionJson);
                }
            } catch (e) {
                // ignore
            }
        }

        // 3. Check if installed
        let needsInstall = !fs.existsSync(versionJson);

        if (needsInstall) {
            emit('log', { type: 'INFO', message: `Forge ${forgeVersionId} not found. Preparing installer...` });

            // 4. Download Installer
            const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${gameVersion}-${forgeVersion}/forge-${gameVersion}-${forgeVersion}-installer.jar`;
            const cacheDir = path.join(launchOptions.root, 'cache', 'installers');
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

            const installerPath = path.join(cacheDir, `forge-${gameVersion}-${forgeVersion}-installer.jar`);

            emit('log', { type: 'INFO', message: `Downloading Installer from ${installerUrl}` });
            try {
                await LauncherNetwork.downloadFile(installerUrl, installerPath);
            } catch (e) {
                throw new Error(`Failed to download Forge installer: ${e.message}`);
            }

            // 5. Run Installer
            emit('log', { type: 'INFO', message: 'Running Forge Installer (this may take a moment)...' });

            await new Promise((resolve, reject) => {
                const child = spawn(launchOptions.javaPath, [
                    '-jar',
                    installerPath,
                    '--installClient',
                    launchOptions.root
                ], {
                    cwd: cacheDir,
                    stdio: 'pipe'
                });

                child.stdout.on('data', (data) => {
                    // emit('log', { type: 'DEBUG', message: `[Installer] ${data.toString().trim()}` });
                });

                child.stderr.on('data', (data) => {
                    emit('log', { type: 'DEBUG', message: `[Installer ERR] ${data.toString().trim()}` });
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        emit('log', { type: 'INFO', message: 'Forge Installer completed successfully.' });
                        resolve();
                    } else {
                        reject(new Error(`Forge installer failed with exit code ${code}`));
                    }
                });

                child.on('error', (err) => reject(err));
            });
        } else {
            emit('log', { type: 'DEBUG', message: 'Forge version already installed.' });
        }

        // Add debug arguments for Forge/Game
        if (!launchOptions.customArgs) launchOptions.customArgs = [];

        launchOptions.customArgs.push('-Dforge.logging.console.level=debug');

        const libDir = path.join(launchOptions.root, 'libraries');
        launchOptions.customArgs.push(`-DlibraryDirectory=${libDir}`);

        // Java 16+ JPMS Access for Forge
        const javaAccessFlags = [
            "--add-opens", "java.base/java.util.jar=ALL-UNNAMED",
            "--add-opens", "java.base/java.lang.invoke=ALL-UNNAMED",
            "--add-opens", "java.base/java.lang=ALL-UNNAMED",
            "--add-opens", "java.base/java.util=ALL-UNNAMED",
            "--add-opens", "java.base/java.net=ALL-UNNAMED",
            "--add-opens", "java.base/java.nio=ALL-UNNAMED",
            "--add-exports", "java.base/sun.security.action=ALL-UNNAMED",
            "--add-opens", "java.base/sun.security.util=ALL-UNNAMED"
        ];
        launchOptions.customArgs.push(...javaAccessFlags);
        emit('log', { type: 'INFO', message: 'Added Java Access Flags & Library Path for Forge.' });

        if (!launchOptions.overrides) launchOptions.overrides = {};
        launchOptions.overrides.detached = false;

        // 5. Update Launch Options
        launchOptions.version.number = forgeVersionId;

        // --- PATCH: MCLC Missing Client Jar Fix ---
        try {
            const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
            const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);

            const forgeJsonContent = fs.readFileSync(versionJson, 'utf-8');
            const forgeData = JSON.parse(forgeJsonContent);
            let vanillaData = {};

            if (fs.existsSync(vanillaJson)) {
                vanillaData = JSON.parse(fs.readFileSync(vanillaJson, 'utf-8'));
            }

            let changed = false;

            // Patch 1: Downloads
            if (vanillaData.downloads && vanillaData.downloads.client) {
                if (!forgeData.downloads) forgeData.downloads = {};
                if (!forgeData.downloads.client) {
                    forgeData.downloads.client = vanillaData.downloads.client;
                    changed = true;
                }
            }

            // Patch 2: Assets
            if (vanillaData.assetIndex && (!forgeData.assetIndex || !forgeData.assetIndex.url)) {
                forgeData.assetIndex = vanillaData.assetIndex;
                if (vanillaData.assets) forgeData.assets = vanillaData.assets;
                changed = true;
            }

            // Patch 3: Libraries
            if (vanillaData.libraries) {
                if (!forgeData.libraries) forgeData.libraries = [];
                const hasLwjgl = forgeData.libraries.some(l => l.name && l.name.includes('org.lwjgl'));
                if (!hasLwjgl) {
                    emit('log', { type: 'INFO', message: 'Patching Forge JSON with Vanilla libraries...' });
                    forgeData.libraries = [...forgeData.libraries, ...vanillaData.libraries];
                    changed = true;
                }
            }

            // Patch 4: Arguments (Deduplication + Isolation)
            if (forgeData.arguments && forgeData.arguments.game) {
                const originalCount = forgeData.arguments.game.length;
                const cleanArgs = [];
                const processedFlags = new Set();

                for (let i = 0; i < forgeData.arguments.game.length; i++) {
                    const arg = forgeData.arguments.game[i];
                    if (typeof arg !== 'string') {
                        cleanArgs.push(arg);
                        continue;
                    }

                    if (arg.startsWith('--')) {
                        if (processedFlags.has(arg)) {
                            const nextIndex = i + 1;
                            if (nextIndex < forgeData.arguments.game.length) {
                                const nextArg = forgeData.arguments.game[nextIndex];
                                if (typeof nextArg === 'string' && !nextArg.startsWith('-')) {
                                    i++;
                                }
                            }
                            emit('log', { type: 'WARN', message: `Removed duplicate arg: ${arg}` });
                        } else {
                            processedFlags.add(arg);
                            cleanArgs.push(arg);
                            const nextIndex = i + 1;
                            if (nextIndex < forgeData.arguments.game.length) {
                                const nextArg = forgeData.arguments.game[nextIndex];
                                if (typeof nextArg === 'string' && !nextArg.startsWith('-')) {
                                    cleanArgs.push(nextArg);
                                    i++;
                                }
                            }
                        }
                    } else {
                        cleanArgs.push(arg);
                    }
                }

                // ensure --gameDir exists for isolation!
                const hasGameDir = cleanArgs.includes('--gameDir');
                if (!hasGameDir) {
                    emit('log', { type: 'INFO', message: 'Patching Forge JSON with --gameDir argument...' });
                    cleanArgs.push('--gameDir', '${game_directory}');
                    changed = true;
                }

                if (cleanArgs.length !== originalCount || !hasGameDir) {
                    forgeData.arguments.game = cleanArgs;
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(versionJson, JSON.stringify(forgeData, null, 2));
            }

            // JVM Args Injection logic
            if (forgeData.arguments && forgeData.arguments.jvm) {
                const libPath = path.join(launchOptions.root, 'libraries');
                const processedArgs = [];

                forgeData.arguments.jvm.forEach(arg => {
                    let vals = [];
                    if (typeof arg === 'string') {
                        vals.push(arg);
                    } else if (typeof arg === 'object' && arg.value) {
                        // Simple rule check assumed passed
                        if (Array.isArray(arg.value)) vals.push(...arg.value);
                        else vals.push(arg.value);
                    }

                    vals.forEach(v => {
                        let replaced = v.replace(/\$\{library_directory\}/g, libPath)
                            .replace(/\$\{classpath_separator\}/g, ';')
                            .replace(/\$\{version_name\}/g, forgeVersionId);
                        processedArgs.push(replaced);
                    });
                });

                launchOptions.customArgs.push(...processedArgs);
                emit('log', { type: 'INFO', message: 'Injected Forge JVM Arguments from JSON.' });
            }

        } catch (e) {
            emit('log', { type: 'WARN', message: `Forge JSON Patching failed: ${e.message}` });
        }
    }
}

module.exports = ForgeHandler;
