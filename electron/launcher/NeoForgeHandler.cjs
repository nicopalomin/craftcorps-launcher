const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');
const LauncherNetwork = require('./LauncherNetwork.cjs');

class NeoForgeHandler {
    static async prepare(options, launchOptions, emit) {
        emit('log', { type: 'INFO', message: 'Resolving NeoForge Loader...' });
        const gameVersion = launchOptions.version.number;
        let neoforgeVersion = options.loaderVersion;

        // 1. Resolve NeoForge Version
        if (neoforgeVersion) {
            emit('log', { type: 'INFO', message: `Using explicit NeoForge Version: ${neoforgeVersion}` });
        } else {
            emit('log', { type: 'INFO', message: `Fetching latest NeoForge version for ${gameVersion}...` });
            try {
                const metadataUrl = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';
                const xmlData = await new Promise((resolve, reject) => {
                    https.get(metadataUrl, (res) => {
                        if (res.statusCode !== 200) return reject(new Error(`Failed to fetch metadata: ${res.statusCode}`));
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => resolve(data));
                    }).on('error', reject);
                });

                // Simple Regex parsing for <version>20.4.80-beta</version>
                const versionMatches = [...xmlData.matchAll(/<version>(.*?)<\/version>/g)].map(m => m[1]);

                // NeoForge Versioning: usually matches MC version short form.
                // 1.20.1 -> 20.1.x
                // 1.20.2 -> 20.2.x
                // 1.20.4 -> 20.4.x
                // 1.21   -> 21.0.x (?)

                // Helper to map MC version to expected NeoForge prefix
                const getPrefix = (mcVer) => {
                    // Remove "1." for 1.x versions
                    if (mcVer.startsWith('1.')) {
                        const minor = mcVer.split('.')[1]; // 20
                        const patch = mcVer.split('.')[2] || '0'; // 1
                        return `${minor}.${patch}`;
                    }
                    return mcVer; // Fallback
                };

                const prefix = getPrefix(gameVersion);
                // Filter versions starting with prefix
                // And sort descending to get latest
                // Version format is usually Major.Minor.Build[-beta]
                // We want the latest build.

                const candidates = versionMatches.filter(v => v.startsWith(prefix + '.'));

                if (candidates.length === 0) {
                    // Try stricter or looser?
                    // Maybe the map is just "starts with 20.1" for 1.20.1
                    // Let's try to just find versions that Contain the version string? No.
                    // Let's dump all versions if fail? No.
                    throw new Error(`No NeoForge version found for ${gameVersion}`);
                }

                // Sort semantic versions descending
                const sorted = candidates.sort((a, b) => {
                    const splitVer = (v) => v.split(/[-.]/).map(n => {
                        const num = Number(n);
                        return isNaN(num) ? n : num;
                    });

                    const pa = splitVer(a);
                    const pb = splitVer(b);

                    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                        const na = pa[i];
                        const nb = pb[i];

                        // Handle length mismatches (e.g. 1.0 vs 1.0.1)
                        // In descending order, 1.0.1 (longer) comes first effectively?
                        // 1.0 vs 1.0.1 -> at index 2, undefined vs 1. 1 is greater.
                        if (na === undefined && nb !== undefined) return 1; // a is shorter, so a < b. we want desc, so return 1 (put b first)
                        if (nb === undefined && na !== undefined) return -1;

                        if (typeof na === 'number' && typeof nb === 'number') {
                            if (na > nb) return -1;
                            if (na < nb) return 1;
                        } else {
                            // String comparison (beta, alpha, rc)
                            // Lexicographical: alpha < beta < rc
                            // We want newest first. rc > beta.
                            // So if a > b, return -1.
                            if (String(na) > String(nb)) return -1;
                            if (String(na) < String(nb)) return 1;
                        }
                    }
                    return 0;
                });

                neoforgeVersion = sorted[0];
                emit('log', { type: 'INFO', message: `Resolved NeoForge Version: ${neoforgeVersion}` });

            } catch (e) {
                throw new Error(`Failed to resolve NeoForge version: ${e.message}`);
            }
        }

        const neoforgeVersionId = `neoforge-${neoforgeVersion}`;
        const versionsDir = path.join(launchOptions.root, 'versions');
        const specificVersionDir = path.join(versionsDir, neoforgeVersionId);
        const versionJson = path.join(specificVersionDir, `${neoforgeVersionId}.json`);

        emit('log', { type: 'INFO', message: `Targeting NeoForge: ${neoforgeVersionId}` });

        // 2. Bootstrap: Ensure Vanilla Parent Exists (Same as Forge)
        const vanillaDir = path.join(launchOptions.root, 'versions', gameVersion);
        const vanillaJson = path.join(vanillaDir, `${gameVersion}.json`);
        if (!fs.existsSync(vanillaJson)) {
            emit('log', { type: 'INFO', message: `Bootstrap: Missing Vanilla ${gameVersion}. Downloading...` });
            // Reuse Forge logic or duplicate it here. Duplicating for safety/independence.
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
                    }
                }
            } catch (e) {
                emit('log', { type: 'WARN', message: `Vanilla Bootstrap failed: ${e.message}` });
            }
        }

        // 3. Check if installed
        // NeoForge installer creates a json with the version name.
        // It might be named differently depending on installer, but we expect it to be identifiable.
        // Usually it installs into strict version folder.
        // We might need to handle the fact that we don't know the exact folder name until we run it?
        // No, standard is `versions/neoforge-<ver>`.

        let needsInstall = !fs.existsSync(versionJson);

        // Check for corrupt jar (0 bytes) just like Forge
        const versionJarPath = path.join(specificVersionDir, `${neoforgeVersionId}.jar`);
        if (fs.existsSync(versionJarPath)) {
            const stats = fs.statSync(versionJarPath);
            if (stats.size === 0) {
                fs.unlinkSync(versionJarPath);
                if (fs.existsSync(versionJson)) fs.unlinkSync(versionJson);
                needsInstall = true;
            }
        }

        if (needsInstall) {
            emit('log', { type: 'INFO', message: `NeoForge ${neoforgeVersion} not found. Preparing installer...` });

            // 4. Download Installer
            // Url: https://maven.neoforged.net/releases/net/neoforged/neoforge/<ver>/neoforge-<ver>-installer.jar
            const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`;
            const cacheDir = path.join(launchOptions.root, 'cache', 'installers');
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

            const installerPath = path.join(cacheDir, `neoforge-${neoforgeVersion}-installer.jar`);

            emit('log', { type: 'INFO', message: `Downloading Installer from ${installerUrl}` });
            try {
                await LauncherNetwork.downloadFile(installerUrl, installerPath);
            } catch (e) {
                throw new Error(`Failed to download NeoForge installer: ${e.message}`);
            }

            // 5. Run Installer
            emit('log', { type: 'INFO', message: 'Running NeoForge Installer...' });
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

                child.stderr.on('data', (d) => emit('log', { type: 'DEBUG', message: `[Installer] ${d}` }));
                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Installer exited with code ${code}`));
                });
                child.on('error', reject);
            });
            emit('log', { type: 'INFO', message: 'NeoForge Installer completed.' });
        } else {
            emit('log', { type: 'DEBUG', message: 'NeoForge already installed.' });
        }

        // 6. Config Patching
        // MCLC needs some help with arguments and environment setup for Forge/NeoForge
        if (!launchOptions.customArgs) launchOptions.customArgs = [];

        // Basic args
        const libDir = path.join(launchOptions.root, 'libraries');
        launchOptions.customArgs.push(`-DlibraryDirectory=${libDir}`);
        launchOptions.customArgs.push('-Dneoforge.enabled=true'); // Just in case

        // Java Access Flags (Required for all NeoForge versions as they are all modern)
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

        // Update Version ID
        launchOptions.version.number = neoforgeVersionId;

        // Patch JSON (MCLC compat) - Similar to Forge
        // We check if the json exists and ensure it has proper client download / asset index from vanilla
        try {
            // Re-resolve paths just in case
            // NeoForge installer might name the folder just "neoforge-<ver>"

            // Check if the file we expect actually exists, or if it's named something else?
            // Usually installer uses the version name inside the installer's install_profile.json
            // But standard is neoforge-<ver>.

            if (fs.existsSync(versionJson)) {
                const forgeData = JSON.parse(fs.readFileSync(versionJson, 'utf-8'));
                let changed = false;

                // Inherit from Vanilla
                const vanillaData = fs.existsSync(vanillaJson) ? JSON.parse(fs.readFileSync(vanillaJson, 'utf-8')) : {};

                if (vanillaData.downloads && vanillaData.downloads.client && (!forgeData.downloads || !forgeData.downloads.client)) {
                    if (!forgeData.downloads) forgeData.downloads = {};
                    forgeData.downloads.client = vanillaData.downloads.client;
                    changed = true;
                }

                if (vanillaData.assetIndex && (!forgeData.assetIndex || !forgeData.assetIndex.url)) {
                    forgeData.assetIndex = vanillaData.assetIndex;
                    forgeData.assets = vanillaData.assets;
                    changed = true;
                }

                // Ensure Libraries
                if (vanillaData.libraries) {
                    if (!forgeData.libraries) forgeData.libraries = [];
                    // Simple check: if missing lwjgl, add all vanilla libs
                    const hasLwjgl = forgeData.libraries.some(l => l.name && l.name.includes('org.lwjgl'));
                    if (!hasLwjgl) {
                        forgeData.libraries = [...forgeData.libraries, ...vanillaData.libraries];
                        changed = true;
                    }
                }

                // Ensure Arguments
                if (forgeData.arguments && forgeData.arguments.game) {
                    const cleanArgs = [];
                    forgeData.arguments.game.forEach(arg => {
                        if (typeof arg === 'string') cleanArgs.push(arg);
                    });

                    if (!cleanArgs.includes('--gameDir')) {
                        cleanArgs.push('--gameDir', '${game_directory}');
                        changed = true;
                    }

                    // Add auth args explicitly to ensure MCLC replaces them
                    if (!cleanArgs.includes('--accessToken')) {
                        cleanArgs.push('--accessToken', '${auth_access_token}');
                        changed = true;
                    }
                    if (!cleanArgs.includes('--username')) {
                        cleanArgs.push('--username', '${auth_player_name}');
                        changed = true;
                    }
                    if (!cleanArgs.includes('--uuid')) {
                        cleanArgs.push('--uuid', '${auth_uuid}');
                        changed = true;
                    }

                    if (!cleanArgs.includes('--version')) { cleanArgs.push('--version', '${version_name}'); changed = true; }

                    if (changed) forgeData.arguments.game = cleanArgs;
                }

                if (changed) {
                    fs.writeFileSync(versionJson, JSON.stringify(forgeData, null, 2));
                }
            }
        } catch (e) {
            emit('log', { type: 'WARN', message: `NeoForge JSON Patching failed: ${e.message}` });
        }
    }
}

module.exports = NeoForgeHandler;
