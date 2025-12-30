const { Client, Authenticator } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class GameLauncher extends EventEmitter {
    constructor() {
        super();
        this.isCancelled = false;
        this.lastError = null;
    }

    downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to download: ${response.statusCode}`));
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        });
    }

    getJson(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode !== 200) return reject(new Error(`Failed to fetch JSON: ${res.statusCode}`));
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
    }

    async launch(options) {
        // Resolve paths

        // 1. Determine Standard "Common" Root (for assets, libs, and versions)
        // We use the standard .minecraft folder to share assets/libs with other launchers or previous installs.
        // This prevents re-downloading 500MB+ of assets for every modpack instance.
        let commonRoot;
        const os = process.platform;
        const home = process.env.HOME || process.env.USERPROFILE;
        if (os === 'win32') {
            commonRoot = path.join(process.env.APPDATA, '.minecraft');
        } else if (os === 'darwin') {
            commonRoot = path.join(home, 'Library', 'Application Support', 'minecraft');
        } else {
            commonRoot = path.join(home, '.minecraft');
        }

        // --- Bootstrap: Ensure version_manifest exists EARLY ---
        // We need this for dynamic version validation and MCLC health.
        const cacheDir = path.join(commonRoot, 'cache', 'json');
        const manifestPath = path.join(cacheDir, 'version_manifest.json');

        if (!fs.existsSync(manifestPath)) {
            try {
                this.emit('log', { type: 'INFO', message: 'Bootstrapping launcher cache...' });
                fs.mkdirSync(cacheDir, { recursive: true });
                await this.downloadFile('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', manifestPath);
                this.emit('log', { type: 'INFO', message: 'Version manifest bootstrapped successfully.' });
            } catch (e) {
                this.emit('log', { type: 'ERROR', message: `Bootstrap Failed: Could not download version manifest: ${e.message}` });
                const friendlyError = {
                    summary: "Network Error: Unable to download game metadata.",
                    advice: "Please check your internet connection. We cannot launch the game without the version manifest."
                };
                this.emit('launch-error', friendlyError);
                this.emit('exit', 1);
                return; // ABORT LAUNCH
            }
        }

        // --- Dynamic Version Validation ---
        try {
            if (options.version) {
                const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                // Create a Set of valid version IDs for O(1) lookup
                const validVersions = new Set(manifestData.versions.map(v => v.id));

                if (!validVersions.has(options.version)) {
                    this.emit('log', { type: 'WARN', message: `Requested version '${options.version}' is NOT in the official manifest.` });

                    // HEURISTIC: Check for Bedrock/Typo "1.21.11" -> "1.21.1"
                    if (options.version.includes('1.21.11')) {
                        this.emit('log', { type: 'WARN', message: `Heuristic: '${options.version}' looks like a Bedrock version. Auto-correcting to '1.21.1'.` });
                        options.version = '1.21.1';
                    } else {
                        // Heuristic: Fuzzy match? Or just warn?
                        // (No change, just verifying).
                        this.emit('log', { type: 'WARN', message: "Proceeding with unknown version. Launch may fail." });
                    }
                } else {
                    if (options.version === '1.21.11') {
                        this.emit('log', { type: 'WARN', message: `Version 1.21.11 detected in manifest but is known to be problematic. Correcting to 1.21.1.` });
                        options.version = '1.21.1';
                    } else {
                        this.emit('log', { type: 'DEBUG', message: `Version '${options.version}' validated against manifest.` });
                    }
                }
            }
        } catch (e) {
            this.emit('log', { type: 'WARN', message: `Version validation skipped due to error: ${e.message}` });
        }


        // 2. Determine Instance Root (for mods, config, saves)
        let gameRoot = commonRoot;
        if (options.instancePath) {
            gameRoot = options.instancePath;
        } else if (options.gameDir) {
            gameRoot = options.gameDir;
        }

        const launchOptions = {
            clientPackage: null, // Let MCLC handle version manifest
            authorization: {
                access_token: options.accessToken || '',
                client_token: options.clientToken || '',
                uuid: options.uuid || '00000000-0000-0000-0000-000000000000',
                name: options.username || 'Player',
                user_properties: '{}',
                meta: { type: options.userType === 'Microsoft' ? 'msa' : 'mojang' }
            },
            root: commonRoot, // Shared assets/versions/libs
            version: {
                number: options.version || '1.16.5', // "1.20.4"
                type: 'release'
            },
            memory: {
                max: options.maxMem ? options.maxMem + "M" : "4G",
                min: options.minMem ? options.minMem + "M" : "1G"
            },
            javaPath: options.javaPath || 'java',
            customArgs: process.platform === 'darwin' ? [
                '-Xdock:name=CraftCorps',
                '-Xdock:icon=' + path.join(__dirname, '..', 'public', 'icon.png')
            ] : [],
            overrides: {
                detached: false,
                gameDirectory: gameRoot // Isolated instance folder
            }
        };

        this.emit('log', { type: 'INFO', message: `Launch configured with Game Directory: ${gameRoot}` });
        this.emit('log', { type: 'INFO', message: `Launch configured with Common Root: ${commonRoot}` });

        // --- Mod Loader Support ---
        if (options.loader && options.loader.toLowerCase().includes('forge')) {
            try {
                this.emit('log', { type: 'INFO', message: 'Resolving Forge Loader...' });
                const gameVersion = launchOptions.version.number;
                let forgeVersion = options.loaderVersion;

                // 1. Resolve Forge Version if missing
                if (!forgeVersion) {
                    this.emit('log', { type: 'INFO', message: `Fetching latest Forge version for ${gameVersion}...` });
                    const promos = await this.getJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
                    const recommendedKey = `${gameVersion}-recommended`;
                    const latestKey = `${gameVersion}-latest`;

                    if (promos.promos[recommendedKey]) {
                        forgeVersion = promos.promos[recommendedKey];
                    } else if (promos.promos[latestKey]) {
                        forgeVersion = promos.promos[latestKey];
                    } else {
                        // Fallback: check keys?
                        throw new Error(`No Forge version found for ${gameVersion}`);
                    }
                }

                // Forge version string format varies. Newer: "1.20.1-47.1.0", Older: "14.23.5.2859"
                // The version ID in .minecraft/versions usually follows:
                // 1.12.2-forge-14.23.5.2859 or 1.20.1-forge-47.1.0
                // Let's standardise the ID we look for.
                // It usually is `${gameVersion}-forge-${forgeVersion}`.

                const forgeVersionId = `${gameVersion}-forge-${forgeVersion}`;
                const versionsDir = path.join(launchOptions.root, 'versions');
                const specificVersionDir = path.join(versionsDir, forgeVersionId);
                const versionJson = path.join(specificVersionDir, `${forgeVersionId}.json`);

                this.emit('log', { type: 'INFO', message: `Targeting Forge: ${forgeVersionId}` });

                // 2. Bootstrap: Ensure Vanilla Parent Exists
                // Forge installer needs the vanilla version to be present/valid often, or at least MCLC does.
                const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
                const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);
                if (!fs.existsSync(vanillaJson)) {
                    this.emit('log', { type: 'INFO', message: `Bootstrap: Missing Vanilla ${gameVersion}. Downloading...` });
                    try {
                        const manifestPath = path.join(launchOptions.root, 'cache', 'json', 'version_manifest.json');
                        // We ensured manifest exists earlier in launch()
                        if (fs.existsSync(manifestPath)) {
                            const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                            const vData = manifestData.versions.find(v => v.id === gameVersion);
                            if (vData) {
                                fs.mkdirSync(vanillaDir, { recursive: true });
                                await this.downloadFile(vData.url, vanillaJson);

                                // Also download the client JAR right away? 
                                // Some Forge installers might need it.
                                const vMeta = await this.getJson(vData.url); // The version json itself
                                if (vMeta.downloads && vMeta.downloads.client) {
                                    const clientJar = path.join(vanillaDir, `${gameVersion}.jar`);
                                    if (!fs.existsSync(clientJar)) {
                                        this.emit('log', { type: 'INFO', message: `Downloading Vanilla Client JAR...` });
                                        await this.downloadFile(vMeta.downloads.client.url, clientJar);
                                    }
                                }

                                this.emit('log', { type: 'INFO', message: `Vanilla ${gameVersion} bootstrapped.` });
                            }
                        }
                    } catch (e) {
                        this.emit('log', { type: 'WARN', message: `Vanilla Bootstrap failed: ${e.message}` });
                    }
                }

                // 3. Check if installed
                let needsInstall = !fs.existsSync(versionJson);

                if (needsInstall) {
                    this.emit('log', { type: 'INFO', message: `Forge ${forgeVersionId} not found. Preparing installer...` });

                    // 4. Download Installer
                    // URL Format: https://maven.minecraftforge.net/net/minecraftforge/forge/{gameVersion}-{forgeVersion}/forge-{gameVersion}-{forgeVersion}-installer.jar
                    // Note: Some older versions might slightly differ, but this covers 1.12+ 
                    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${gameVersion}-${forgeVersion}/forge-${gameVersion}-${forgeVersion}-installer.jar`;
                    const cacheDir = path.join(launchOptions.root, 'cache', 'installers');
                    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

                    const installerPath = path.join(cacheDir, `forge-${gameVersion}-${forgeVersion}-installer.jar`);

                    this.emit('log', { type: 'INFO', message: `Downloading Installer from ${installerUrl}` });
                    try {
                        await this.downloadFile(installerUrl, installerPath);
                    } catch (e) {
                        // Try fallback without gameVersion prefix in filename segment if strictly following maven? 
                        // Check: net/minecraftforge/forge/1.20.1-47.1.0/forge-1.20.1-47.1.0-installer.jar
                        // Seems correct.
                        throw new Error(`Failed to download Forge installer: ${e.message}`);
                    }

                    // 5. Run Installer
                    this.emit('log', { type: 'INFO', message: 'Running Forge Installer (this may take a moment)...' });

                    await new Promise((resolve, reject) => {
                        // java -jar installer.jar --installClient <path>
                        const child = spawn(launchOptions.javaPath, [
                            '-jar',
                            installerPath,
                            '--installClient',
                            launchOptions.root
                        ], {
                            cwd: cacheDir,
                            stdio: 'pipe' // Capture output
                        });

                        child.stdout.on('data', (data) => {
                            const line = data.toString();
                            if (line.includes('Progress:')) {
                                // optional: parse progress
                            }
                            // this.emit('log', { type: 'DEBUG', message: `[Installer] ${line.trim()}` });
                        });

                        child.stderr.on('data', (data) => {
                            this.emit('log', { type: 'DEBUG', message: `[Installer ERR] ${data.toString().trim()}` });
                        });

                        child.on('close', (code) => {
                            if (code === 0) {
                                this.emit('log', { type: 'INFO', message: 'Forge Installer completed successfully.' });
                                resolve();
                            } else {
                                reject(new Error(`Forge installer failed with exit code ${code}`));
                            }
                        });

                        child.on('error', (err) => reject(err));
                    });

                    // Cleanup installer? Optional. Maybe keep properly in cache.
                } else {
                    this.emit('log', { type: 'DEBUG', message: 'Forge version already installed.' });
                }

                // Add debug arguments for Forge/Game if user asked for "more errors"
                if (!launchOptions.customArgs) launchOptions.customArgs = [];

                // Forge specific logging
                if (options.loader && options.loader.toLowerCase().includes('forge')) {
                    launchOptions.customArgs.push('-Dforge.logging.console.level=debug');

                    // Define library directory for Forge Bootstrapper
                    const libDir = path.join(launchOptions.root, 'libraries');
                    launchOptions.customArgs.push(`-DlibraryDirectory=${libDir}`);

                    // FIX: Java 16+ JPMS Access for Forge
                    // These flags are required for Forge to access internal Java APIs.
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
                    this.emit('log', { type: 'INFO', message: 'Added Java Access Flags & Library Path for Forge.' });
                }

                // Standard java verbose (might be too spammy, but useful for crash debugging)
                // launchOptions.customArgs.push('-verbose:class'); // uncomment if desperate

                // Ensure detached is false to capture output
                if (!launchOptions.overrides) launchOptions.overrides = {};
                launchOptions.overrides.detached = false;

                // 5. Update Launch Options
                launchOptions.version.number = forgeVersionId;
                // launchOptions.version.custom = forgeVersionId; // Removing to prevent potential duplicate argument processing by MCLC

                // --- PATCH: MCLC Missing Client Jar Fix ---
                // Similar to Fabric, MCLC might fail to inherit 'downloads' from the parent.
                // We manually patch the Forge JSON to include the vanilla client.
                try {
                    const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
                    const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);

                    if (fs.existsSync(vanillaJson) && fs.existsSync(versionJson)) {
                        const vanillaData = JSON.parse(fs.readFileSync(vanillaJson, 'utf-8'));
                        const forgeData = JSON.parse(fs.readFileSync(versionJson, 'utf-8'));

                        let changed = false;

                        // Patch 1: Downloads
                        if (vanillaData.downloads && vanillaData.downloads.client) {
                            if (!forgeData.downloads) forgeData.downloads = {};
                            if (!forgeData.downloads.client) {
                                forgeData.downloads.client = vanillaData.downloads.client;
                                changed = true;
                                this.emit('log', { type: 'DEBUG', message: 'Patched Forge JSON with client download info.' });
                            }
                        }

                        // Patch 2: Assets
                        if (vanillaData.assetIndex && (!forgeData.assetIndex || !forgeData.assetIndex.url)) {
                            forgeData.assetIndex = vanillaData.assetIndex;
                            if (vanillaData.assets) forgeData.assets = vanillaData.assets;
                            changed = true;
                            this.emit('log', { type: 'DEBUG', message: 'Patched Forge JSON with asset index.' });
                        }

                        // Patch 3: Libraries (Fix Missing Dependencies if inheritance fails)
                        if (vanillaData.libraries) {
                            if (!forgeData.libraries) forgeData.libraries = [];

                            // Simple check: do we have LWJGL?
                            const hasLwjgl = forgeData.libraries.some(l => l.name && l.name.includes('org.lwjgl'));
                            if (!hasLwjgl) {
                                this.emit('log', { type: 'INFO', message: 'Patching Forge JSON with Vanilla libraries...' });
                                // Merge all vanilla libs. MCLC should handle duplicates or we can let them be.
                                // Better to prepend or append? Forge libs usually come first?
                                // Let's append vanilla libs to ensure they are available.
                                forgeData.libraries = [...forgeData.libraries, ...vanillaData.libraries];
                                changed = true;
                            }
                        }

                        // Patch 4: Generalized Aggressive Deduplication of Game Arguments
                        if (forgeData.arguments && forgeData.arguments.game) {
                            const originalCount = forgeData.arguments.game.length;
                            const cleanArgs = [];
                            const processedFlags = new Set();

                            for (let i = 0; i < forgeData.arguments.game.length; i++) {
                                const arg = forgeData.arguments.game[i];

                                // Preserve non-string args (rules)
                                if (typeof arg !== 'string') {
                                    cleanArgs.push(arg);
                                    continue;
                                }

                                if (arg.startsWith('--')) {
                                    if (processedFlags.has(arg)) {
                                        // Duplicate flag found! Skip it.
                                        // Heuristic: If next arg is a value (no dashes), skip it too.
                                        // This assumes standard "--key value" or "--flag" structure.
                                        const nextIndex = i + 1;
                                        if (nextIndex < forgeData.arguments.game.length) {
                                            const nextArg = forgeData.arguments.game[nextIndex];
                                            if (typeof nextArg === 'string' && !nextArg.startsWith('-')) {
                                                i++; // Skip the value
                                            }
                                        }
                                        this.emit('log', { type: 'WARN', message: `Removed duplicate arg: ${arg}` });
                                    } else {
                                        // New flag
                                        processedFlags.add(arg);
                                        cleanArgs.push(arg);

                                        // Consume value if present
                                        const nextIndex = i + 1;
                                        if (nextIndex < forgeData.arguments.game.length) {
                                            const nextArg = forgeData.arguments.game[nextIndex];
                                            if (typeof nextArg === 'string' && !nextArg.startsWith('-')) {
                                                cleanArgs.push(nextArg);
                                                i++; // Advance loop past value
                                            }
                                        }
                                    }
                                } else {
                                    // Standalone value or positional arg not captured above?
                                    // Just keep it.
                                    cleanArgs.push(arg);
                                }
                            }

                            if (cleanArgs.length !== originalCount) {
                                forgeData.arguments.game = cleanArgs;
                                changed = true;
                                this.emit('log', { type: 'INFO', message: `Cleaned Forge arguments. ${originalCount} -> ${cleanArgs.length}` });
                            }
                        }

                        if (changed) {
                            fs.writeFileSync(versionJson, JSON.stringify(forgeData, null, 2));
                        }

                        // MANUAL ARGUMENT PROCESSING FOR FORGE
                        // MCLC might skip 'arguments.jvm' parsing or fail variables.
                        if (forgeData.arguments && forgeData.arguments.jvm) {
                            const libPath = path.join(launchOptions.root, 'libraries');
                            const processedArgs = [];

                            forgeData.arguments.jvm.forEach(arg => {
                                // Handle simple strings or rule-objects
                                let vals = [];
                                if (typeof arg === 'string') {
                                    vals.push(arg);
                                } else if (typeof arg === 'object' && arg.value) {
                                    // Simple rule check: assuming we are on Windows and match
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
                            this.emit('log', { type: 'INFO', message: 'Injected Forge JVM Arguments from JSON.' });
                        }
                    }
                } catch (e) {
                    this.emit('log', { type: 'WARN', message: `Forge JSON Patching failed: ${e.message}` });
                }

                // Explicit fallback mechanism (DISABLED)
                // We trust the JSON patch. If we force clientPackage, MCLC might treat it as custom and redownload/re-extract.
                /*
                if (!launchOptions.clientPackage) {
                    const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
                    const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);
                    if (fs.existsSync(vanillaJson)) {
                        try {
                            const vData = JSON.parse(fs.readFileSync(vanillaJson, 'utf-8'));
                            if (vData.downloads && vData.downloads.client) {
                                // launchOptions.clientPackage = vData.downloads.client.url; 
                            }
                        } catch(e) {}
                    }
                }
                */

                // MCLC 1.20+ Forge fix: ensure we don't accidentally strict-check non-existent vanilla jar if forge handles it?
                // MCLC typically handles it fine if the version JSON is valid in the versions folder.

            } catch (e) {
                this.emit('log', { type: 'ERROR', message: `Forge setup failed: ${e.message}` });
                this.emit('launch-error', {
                    summary: "Forge Installation Failed",
                    advice: "Could not install Forge Loader. Check network or Java version."
                });
                this.emit('exit', 1);
                return;
            }
        }
        // --- NeoForge Support ---
        else if (options.loader && options.loader.toLowerCase().includes('neoforge')) {
            this.emit('log', { type: 'WARN', message: `NeoForge support is simpler but requires specific metadata impl I haven't finished yet.` });
            this.emit('launch-error', {
                summary: "NeoForge Not Fully Implemented",
                advice: "I am working on it. Switch to Fabric for now."
            });
            this.emit('exit', 1);
            return;
        }

        // --- Fabric Support ---
        else if (options.loader && options.loader.toLowerCase().includes('fabric')) {
            try {
                this.emit('log', { type: 'INFO', message: 'Resolving Fabric Loader...' });
                const gameVersion = launchOptions.version.number;

                // Ensure Vanilla Parent Exists!
                // MCLC might fail to download the parent (1.21.1) if we just point straight to Fabric.
                const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
                const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);

                this.emit('log', { type: 'DEBUG', message: `Checking Vanilla JSON at: ${vanillaJson}` });

                if (!fs.existsSync(vanillaJson)) {
                    this.emit('log', { type: 'INFO', message: `Bootstrap: Missing Vanilla ${gameVersion}. Downloading...` });
                    try {
                        // We already loaded manifest earlier, but let's re-read or use cache if we stored it?
                        // Simpler to just re-read or rely on the file we know exists now.
                        const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                        const vData = manifestData.versions.find(v => v.id === gameVersion);
                        if (vData) {
                            fs.mkdirSync(vanillaDir, { recursive: true });
                            await this.downloadFile(vData.url, vanillaJson);
                            this.emit('log', { type: 'INFO', message: `Vanilla ${gameVersion} manifest downloaded.` });
                        } else {
                            // This should have been caught by validation, but double check
                            throw new Error(`Version ${gameVersion} not found in manifest!`);
                        }
                    } catch (e) {
                        this.emit('log', { type: 'WARN', message: `Bootstrap Error: ${e.message}` });
                    }
                } else {
                    this.emit('log', { type: 'DEBUG', message: `Vanilla JSON exists. Size: ${fs.statSync(vanillaJson).size} bytes` });
                }

                let loaderVersion = options.loaderVersion;

                if (!loaderVersion) {
                    this.emit('log', { type: 'INFO', message: `Fetching latest Fabric loader for ${gameVersion}...` });
                    const meta = await this.getJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`);
                    if (meta && meta.length > 0) {
                        loaderVersion = meta[0].loader.version; // First is usually stable/latest
                    } else {
                        throw new Error(`No Fabric loader found for ${gameVersion}`);
                    }
                }

                const fabricVersionId = `fabric-loader-${loaderVersion}-${gameVersion}`;
                this.emit('log', { type: 'INFO', message: `Targeting Fabric: ${fabricVersionId}` });

                // Check version JSON
                const versionsDir = path.join(launchOptions.root, 'versions', fabricVersionId);
                const versionJsonPath = path.join(versionsDir, `${fabricVersionId}.json`);

                this.emit('log', { type: 'DEBUG', message: `Checking Fabric JSON at: ${versionJsonPath}` });

                if (!fs.existsSync(versionJsonPath)) {
                    this.emit('log', { type: 'INFO', message: 'Downloading Fabric profile...' });
                    fs.mkdirSync(versionsDir, { recursive: true });
                    const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/profile/json`;
                    await this.downloadFile(profileUrl, versionJsonPath);
                    this.emit('log', { type: 'INFO', message: 'Fabric profile installed.' });
                } else {
                    this.emit('log', { type: 'DEBUG', message: `Fabric JSON exists. Size: ${fs.statSync(versionJsonPath).size} bytes` });
                }

                // WORKAROUND: MCLC Crash "Cannot read properties of undefined (reading 'client')"
                // This happens because MCLC fails to merge 'downloads' from the parent vanilla JSON into the Fabric JSON object.
                // We manually read the Vanilla JSON and provide the client jar URL explicitly.
                try {
                    const vanillaData = JSON.parse(fs.readFileSync(vanillaJson, 'utf-8'));

                    if (vanillaData.downloads && vanillaData.downloads.client) {
                        // PATCH method: modify the fabric JSON to include the downloads section directly
                        // This bypasses inheritance issues in MCLC
                        let fabricData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));

                        // Check if downloads.client is missing
                        if (!fabricData.downloads || !fabricData.downloads.client) {
                            this.emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla downloads...' });

                            // Ensure downloads object exists
                            if (!fabricData.downloads) fabricData.downloads = {};

                            // Copy client download
                            fabricData.downloads.client = vanillaData.downloads.client;

                            // Also copy server if missing, why not
                            if (!fabricData.downloads.server && vanillaData.downloads.server) {
                                fabricData.downloads.server = vanillaData.downloads.server;
                            }

                            fs.writeFileSync(versionJsonPath, JSON.stringify(fabricData, null, 2));
                            this.emit('log', { type: 'DEBUG', message: 'Fabric JSON patched successfully.' });
                        } else {
                            // It already has it, so we are good?
                            this.emit('log', { type: 'DEBUG', message: 'Fabric JSON already has client download info.' });
                        }

                        // PATCH 2: Ensure Asset Index exists (Fixes "reading 'url'" error during asset check)
                        if (!fabricData.assetIndex || !fabricData.assetIndex.url) {
                            if (vanillaData.assetIndex) {
                                this.emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla assetIndex...' });
                                fabricData.assetIndex = vanillaData.assetIndex;
                                if (vanillaData.assets) fabricData.assets = vanillaData.assets; // Copy "assets": "1.21" string
                                fs.writeFileSync(versionJsonPath, JSON.stringify(fabricData, null, 2));
                            }
                        }

                        // PATCH 3: Merge Libraries (Fixes ClassNotFoundException / Missing Dependencies)
                        // Fabric JSON usually only has fabric libs. MCLC isn't inheriting vanilla libs (jopt-simple, lwjgl, etc).
                        if (vanillaData.libraries) {
                            let libsChanged = false;
                            if (!fabricData.libraries) {
                                fabricData.libraries = [];
                                libsChanged = true;
                            }

                            // We want to add vanilla libs that aren't already there.
                            // Simple approach: Just append all vanilla libs. MCLC usually deduplicates or handles it fine.
                            // But let's check if we've already patched them in to avoid infinite growth if run multiple times.
                            // We can check if the first vanilla lib exists in fabric list.
                            const firstVanillaLib = vanillaData.libraries[0];
                            const alreadyHasVanilla = firstVanillaLib && fabricData.libraries.some(l => l.name === firstVanillaLib.name);

                            if (!alreadyHasVanilla) {
                                this.emit('log', { type: 'INFO', message: 'Patching Fabric JSON with Vanilla libraries...' });
                                fabricData.libraries = [...fabricData.libraries, ...vanillaData.libraries];
                                fs.writeFileSync(versionJsonPath, JSON.stringify(fabricData, null, 2));
                                this.emit('log', { type: 'DEBUG', message: 'Fabric libraries patched.' });
                            }
                        }

                        // We used to force launchOptions.clientPackage here.
                        // But now that we patched the JSON, MCLC should handle it natively with caching.
                        // Only set it if patching presumably failed or we are paranoid, but setting it forces "custom" behavior often.
                        // launchOptions.clientPackage = vanillaData.downloads.client.url; 
                    } else {
                        this.emit('log', { type: 'WARN', message: 'Vanilla JSON missing client download info!' });
                    }
                } catch (e) {
                    this.emit('log', { type: 'WARN', message: `Failed to patch client jar info: ${e.message}` });
                    // Fallback: If patching failed, we might need to force it, but let's try to let MCLC fail gracefully or use what it has.
                }

                launchOptions.version.number = fabricVersionId;
                launchOptions.version.custom = fabricVersionId; // MCLC often uses this for non-vanilla

            } catch (e) {
                this.emit('log', { type: 'ERROR', message: `Fabric setup failed: ${e.message}` });
                this.emit('launch-error', {
                    summary: "Fabric Installation Failed",
                    advice: "Could not install Fabric Loader. Check your internet connection."
                });
                this.emit('exit', 1);
                return;
            }
        }

        // Add server auto-connect if specified using quickPlay
        if (options.server) {
            launchOptions.quickPlay = {
                type: 'multiplayer',
                identifier: options.server
            };

            this.emit('log', { type: 'INFO', message: `Auto-connecting to server: ${options.server}` });
        }

        // Pre-launch check: Corruption in assets/indexes
        // MCLC crashes if the index file is empty (0 bytes), which happens if a previous download failed.
        // We proactively check and delete it to force redownload.
        try {
            const versionId = launchOptions.version.number;
            // The assets index generally matches the version ID for modern versions (1.7.10+)
            const indexFile = path.join(launchOptions.root, 'assets', 'indexes', `${versionId}.json`);
            if (fs.existsSync(indexFile)) {
                const stats = fs.statSync(indexFile);
                if (stats.size === 0) {
                    this.emit('log', { type: 'WARN', message: `Detected corrupt (empty) asset index for ${versionId}. Deleting to allow redownload.` });
                    fs.unlinkSync(indexFile);
                }
            }
        } catch (e) {
            this.emit('log', { type: 'WARN', message: `Failed to check asset index: ${e}` });
        }

        this.isCancelled = false; // Reset cancel flag
        this.lastError = null; // Reset last error

        // Instantiate a new MCLC Client for this launch to ensure clean state
        this.client = new Client();

        // --- Attach Listeners to new Client ---
        this.client.on('data', (e) => this.emit('log', { type: 'INFO', message: `[Game Output] ${e.toString().trim()}` }));
        this.client.on('close', (e) => this.emit('log', { type: 'INFO', message: `[Game Exit] Code: ${e}` }));
        this.client.on('error', (e) => this.emit('log', { type: 'ERROR', message: `[MCLC Error] ${e}` }));

        this.client.on('debug', (e) => {
            const raw = e.toString();
            this.emit('log', { type: 'DEBUG', message: `[MCLC-Debug] ${raw}` });

            // Analyze for specific errors and emit user-friendly warnings
            if (raw.includes('SyntaxError') && raw.includes('JSON')) {
                this.lastError = {
                    summary: 'Asset index corruption detected.',
                    advice: 'We are attempting to clean up the corrupt file. Please try clicking Play again.'
                };
                this.emit('log', { type: 'ERROR', message: this.lastError.summary });
                this.emit('log', { type: 'WARN', message: this.lastError.advice });
            }

            if (raw.includes('ENOTFOUND') && raw.includes('mojang')) {
                this.lastError = {
                    summary: 'Network Error: Cannot reach Minecraft servers.',
                    advice: 'You seem to be offline or your DNS is blocked. Assets cannot be downloaded.'
                };
                this.emit('log', { type: 'ERROR', message: this.lastError.summary });
                this.emit('log', { type: 'WARN', message: this.lastError.advice });
            }

            if (raw.includes('EPERM') || raw.includes('EACCES')) {
                this.lastError = {
                    summary: 'Permission Error: Cannot write to game folder.',
                    advice: 'Close any open Minecraft instances, specific folder windows, or run the launcher as Administrator.'
                };
                this.emit('log', { type: 'ERROR', message: this.lastError.summary });
                this.emit('log', { type: 'WARN', message: this.lastError.advice });
            }

            // Forward debug output to UI console
            this.emit('game-output', raw);
        });

        this.client.on('data', (e) => this.emit('game-output', e.toString()));

        // MCLC 'close' event is redundant if we listen to child process 'close', but good as backup
        this.client.on('close', (e) => {
            // If we already handled exit via process.on('close'), ignore?
            // Usually MCLC emits this when the game process ends.
            // We'll let the process.on('close') handle the authoritative exit to avoid double events if possible,
            // but keeping this doesn't hurt much if logic allows idempotent exit.
            // For now, let's rely on process object returned by promise.
        });

        this.client.on('progress', (e) => {
            if (e.total === 0) return;
            let percent = Math.round((e.task / e.total) * 100);
            // Safety clamp still useful for bad upstream data, but new Client instance prevents accumulation bugs
            if (percent > 100) percent = 100;

            this.emit('progress', {
                type: e.type,
                task: e.task,
                total: e.total,
                percent: percent
            });
        });

        this.emit('log', { type: 'INFO', message: `Starting MCLC for version ${launchOptions.version.number}` });
        this.emit('log', { type: 'INFO', message: `Loader: ${options.loader || 'None'} / ${options.loaderVersion || 'Latest'}` });
        this.emit('log', { type: 'INFO', message: `Assets Root: ${launchOptions.root}` });
        this.emit('log', { type: 'INFO', message: `Instance Directory: ${launchOptions.overrides.gameDirectory}` });
        this.emit('log', { type: 'INFO', message: `Java: ${launchOptions.javaPath}` });

        if (launchOptions.overrides.gameDirectory === launchOptions.root) {
            this.emit('log', { type: 'WARN', message: `Instance is NOT isolated. Using shared .minecraft folder.` });
        } else {
            this.emit('log', { type: 'INFO', message: `Instance IS isolated.` });
        }

        // Debug: Log actual args if possible (MCLC doesn't expose them easily before launch, but we can trust logs)
        // launchOptions is confirmed.

        this.client.launch(launchOptions).then((process) => {
            if (this.isCancelled) {
                // User cancelled during download/prepare phase
                this.emit('log', { type: 'WARN', message: "Launch was cancelled by user. Killing spawned process immediately." });
                if (process) {
                    process.kill();
                }
                return;
            }

            if (!process) {
                const errorInfo = this.lastError || {
                    summary: "Game process failed to start.",
                    advice: `Please verify your Java path: ${launchOptions.javaPath}`
                };

                this.emit('launch-error', errorInfo);
                this.emit('log', { type: 'ERROR', message: `Game launch failed: ${errorInfo.summary}` });
                this.emit('exit', 1);
                return;
            }

            // MCLC returns the child process object on success
            this.process = process;
            this.emit('log', { type: 'INFO', message: "Game process started!" });

            this.process.on('close', (code) => {
                this.process = null;
                this.emit('exit', code);
            });

        }).catch((e) => {
            if (this.isCancelled) {
                this.emit('log', { type: 'INFO', message: "Launch aborted." });
            } else {
                const rawError = e.message || e.toString();
                const friendly = this.getFriendlyErrorMessage(rawError);

                this.emit('launch-error', friendly);
                this.emit('log', { type: 'ERROR', message: `Launch Error: ${friendly.summary}` });
                if (friendly.advice) {
                    this.emit('log', { type: 'WARN', message: `Advice: ${friendly.advice}` });
                }

                // Detailed technical log
                this.emit('log', { type: 'DEBUG', message: `Raw Trace: ${rawError}` });
            }
        });
    }

    getFriendlyErrorMessage(errorMsg) {
        const msg = errorMsg.toLowerCase();

        if (msg.includes('enoent') && msg.includes('java')) {
            return {
                summary: "Java executable not found.",
                advice: "Go to Settings and ensure the correct Java path is selected. Try 'Auto-Detect'."
            };
        }
        if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
            return {
                summary: "Network error: Could not reach Minecraft servers.",
                advice: "Check your internet connection. Mojang's servers might be blocked or down."
            };
        }
        if (msg.includes('eperm') || msg.includes('eacces') || msg.includes('operation not permitted')) {
            return {
                summary: "File Permission Error.",
                advice: "The launcher cannot write to the game folder. Try running as Administrator, or check if an Antivirus is blocking the file."
            };
        }
        if (msg.includes('syntaxerror') && msg.includes('json')) {
            return {
                summary: "Corrupted Game Assets.",
                advice: "A game configuration file is corrupt. We attempted to fix it, please try clicking Play again."
            };
        }
        if (msg.includes('401') || msg.includes('unauthorized')) {
            return {
                summary: "Authentication Failed.",
                advice: "Your session may have expired. Please log out and log back in."
            };
        }

        return {
            summary: "An unexpected error occurred during launch.",
            advice: "Check the console logs for more details. You may need to update Java or reinstall the game instance."
        };
    }

    kill() {
        if (this.process) {
            const pid = this.process.pid;
            try {
                require('tree-kill')(pid, 'SIGKILL', (err) => {
                    if (err) {
                        this.emit('log', { type: 'ERROR', message: `Failed to kill process: ${err.message}` });
                    } else {
                        this.emit('log', { type: 'INFO', message: 'Process killed by user (tree-kill).' });
                        this.process = null;
                        this.emit('exit', -1);
                    }
                });
            } catch (e) {
                this.emit('log', { type: 'ERROR', message: `Kill error: ${e}` });
            }
        } else {
            // Stopping during download/prep phase
            this.emit('log', { type: 'WARN', message: 'Aborting launch sequence...' });

            // MCLC doesn't have a public cancel(), but we can try to destroy the instance 
            // or at least signal the UI that we are done. 
            // The actual download might continue in background node process until completed
            // but we won't launch the game.

            // To "cancel", we basically ignore the upcoming launch promise resolution
            // and we set a flag 'isCancelled' if we were to implement robust cancellation.
            // But MCLC is a black box once started.
            // Best we can do: logic to prevent Process start if user cancelled.
            this.isCancelled = true;
            this.emit('exit', -1);
        }
    }
}

module.exports = GameLauncher;
