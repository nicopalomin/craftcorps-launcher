const path = require('path');
const fs = require('fs');
const LauncherNetwork = require('./LauncherNetwork.cjs');

class VersionManager {
    static async bootstrapManifest(root, emit, targetVersion) {
        const cacheDir = path.join(root, 'cache', 'json');
        const manifestPath = path.join(cacheDir, 'version_manifest.json');

        let shouldDownload = !fs.existsSync(manifestPath);

        if (!shouldDownload && targetVersion) {
            try {
                const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                // Simple check: Look for the version ID
                const found = manifestData.versions && manifestData.versions.some(v => v.id === targetVersion);
                if (!found) {
                    emit('log', { type: 'INFO', message: `Version ${targetVersion} not found in local cache. Refreshing manifest...` });
                    shouldDownload = true;
                }
            } catch (e) {
                emit('log', { type: 'WARN', message: `Localized manifest check failed: ${e.message}. Will re-download.` });
                shouldDownload = true;
            }
        }

        if (shouldDownload) {
            try {
                emit('log', { type: 'INFO', message: 'Bootstrapping launcher cache...' });
                fs.mkdirSync(cacheDir, { recursive: true });
                await LauncherNetwork.downloadFile('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', manifestPath);
                emit('log', { type: 'INFO', message: 'Version manifest bootstrapped successfully.' });
            } catch (e) {
                emit('log', { type: 'ERROR', message: `Bootstrap Failed: Could not download version manifest: ${e.message}` });
                throw {
                    summary: "Network Error: Unable to download game metadata.",
                    advice: "Please check your internet connection. We cannot launch the game without the version manifest."
                };
            }
        }
        return manifestPath;
    }

    static validateVersion(version, manifestPath, emit) {
        try {
            if (version) {
                // Check if manifest exists (it should, as we bootstrapped it)
                if (!fs.existsSync(manifestPath)) return version; // Should not happen

                const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const validVersions = new Set(manifestData.versions.map(v => v.id));

                if (!validVersions.has(version)) {
                    emit('log', { type: 'WARN', message: `Requested version '${version}' is NOT in the official manifest.` });
                    emit('log', { type: 'WARN', message: "Proceeding with unknown version. Launch may fail." });
                } else {
                    emit('log', { type: 'DEBUG', message: `Version '${version}' validated against manifest.` });
                }
            }
        } catch (e) {
            emit('log', { type: 'WARN', message: `Version validation skipped due to error: ${e.message}` });
        }
        return version;
    }
}

module.exports = VersionManager;
