const path = require('path');
const fs = require('fs');
const LauncherNetwork = require('./LauncherNetwork.cjs');

class VersionManager {
    static async bootstrapManifest(root, emit) {
        const cacheDir = path.join(root, 'cache', 'json');
        const manifestPath = path.join(cacheDir, 'version_manifest.json');

        if (!fs.existsSync(manifestPath)) {
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

                    if (version.includes('1.21.11')) {
                        emit('log', { type: 'WARN', message: `Heuristic: '${version}' looks like a Bedrock version. Auto-correcting to '1.21.1'.` });
                        return '1.21.1';
                    } else {
                        emit('log', { type: 'WARN', message: "Proceeding with unknown version. Launch may fail." });
                    }
                } else {
                    if (version === '1.21.11') {
                        emit('log', { type: 'WARN', message: `Version 1.21.11 detected in manifest but is known to be problematic. Correcting to 1.21.1.` });
                        return '1.21.1';
                    }
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
