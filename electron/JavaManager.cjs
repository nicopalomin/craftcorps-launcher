const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { DownloaderHelper } = require('node-downloader-helper');
const AdmZip = require('adm-zip');
const log = require('electron-log');
const { execSync } = require('child_process');

class JavaManager {
    constructor() {
        this.baseRuntimeDir = path.join(app.getPath('userData'), 'runtime', 'java');
        this.platform = process.platform; // 'win32', 'darwin', 'linux'
        this.arch = process.arch; // 'x64', 'arm64'
        this.dl = null;

        this.execName = this.platform === 'win32' ? 'javaw.exe' : 'java';

        // URL Generators based on OS/Arch
        this.getDownloadUrl = (version) => {
            let osType = 'windows';
            let archType = 'x64';
            let ext = 'zip';

            // OS Mapping
            if (this.platform === 'darwin') {
                osType = 'mac';
                ext = 'tar.gz'; // Adoptium usually provides tar.gz for mac/linux
            } else if (this.platform === 'linux') {
                osType = 'linux';
                ext = 'tar.gz';
            }

            // Architecture Mapping
            if (this.arch === 'arm64') {
                archType = 'aarch64';
            }

            // e.g. https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse
            return `https://api.adoptium.net/v3/binary/latest/${version}/ga/${osType}/${archType}/jdk/hotspot/normal/eclipse`;
        };
    }

    getInstallDir(version) {
        return path.join(this.baseRuntimeDir, `java-${version}`);
    }

    async checkJava(version = 17) {
        const targetDir = this.getInstallDir(version);

        // 1. Check our managed directory
        const managed = this.findJavaBinary(targetDir);
        if (managed) return managed;

        // 2. Check system paths
        const systemJava = await this.checkSystemJava(version);
        if (systemJava) {
            log.info(`[JavaManager] Found system Java ${version} at: ${systemJava}`);
            return systemJava;
        }

        return null;
    }

    findJavaBinary(dir) {
        if (!fs.existsSync(dir)) return null;

        try {
            // BFS/DFS to find bin/java or bin/javaw.exe
            // Since extraction structure varies (jdk-17.0.1/bin/java), we scan recursively but limit depth
            const queue = [dir];
            let depth = 0;
            const maxDepth = 4; // Don't go too deep

            while (queue.length > 0) {
                const current = queue.shift();
                if (!current) continue;

                // Check dependencies (Contents/Home/bin for macOS .app bundles if extracted that way, 
                // but usually binary download is a simple folder structure)

                // Directly check if bin/java exists here
                const binCandidate = path.join(current, 'bin', this.execName);
                if (fs.existsSync(binCandidate)) {
                    // On macOS, sometimes it's Contents/Home/bin/java inside the extracted folder
                    return binCandidate;
                }

                // macOS specific: valid JDK root might be inside Contents/Home
                const macHomeCandidate = path.join(current, 'Contents', 'Home', 'bin', this.execName);
                if (fs.existsSync(macHomeCandidate)) {
                    return macHomeCandidate;
                }

                try {
                    const children = fs.readdirSync(current);
                    for (const child of children) {
                        const childPath = path.join(current, child);
                        if (fs.statSync(childPath).isDirectory()) {
                            // Heuristic: only dive if name looks like a java folder or 'bin' isn't here
                            // Avoid scanning massive node_modules or similar if user pointed incorrectly
                            // But this is our managed dir, so it should be clean.
                            // Prevent loops?
                            if (!childPath.includes('jre') && !childPath.includes('lib') && queue.length < 50) {
                                queue.push(childPath);
                            }
                            // Actually, simple structure:
                            // extracted/jdk-17.0.2+8/bin/java
                            // So we just need to see if child is the JDK root
                        }
                    }
                } catch (e) { }
            }
        } catch (e) { }
        return null;
    }

    async scanForJavas() {
        // Platform specific paths
        let searchPaths = [];

        if (this.platform === 'win32') {
            searchPaths = [
                `C:\\Program Files\\Java`,
                `C:\\Program Files (x86)\\Java`,
                path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Common', 'Eclipse', 'Adoptium'),
                path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Eclipse Adoptium'),
            ];
        } else if (this.platform === 'darwin') {
            searchPaths = [
                '/Library/Java/JavaVirtualMachines',
                path.join(os.homedir(), 'Library/Java/JavaVirtualMachines'),
                // Homebrew
                '/opt/homebrew/opt/openjdk/bin', // direct bin
                '/usr/local/opt/openjdk/bin'
            ];
        } else if (this.platform === 'linux') {
            searchPaths = [
                '/usr/lib/jvm',
                '/usr/java',
                '/opt/java'
            ];
        }

        // Always check managed store
        searchPaths.push(this.baseRuntimeDir);

        const found = [];

        for (const root of searchPaths) {
            if (!fs.existsSync(root)) continue;

            // macOS /Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home/bin/java
            if (this.platform === 'darwin' && root.includes('JavaVirtualMachines')) {
                try {
                    const entries = fs.readdirSync(root);
                    for (const entry of entries) {
                        // entry is likely "jdk-17.jdk"
                        const homePath = path.join(root, entry, 'Contents', 'Home');
                        const binJava = path.join(homePath, 'bin', 'java');
                        if (fs.existsSync(binJava)) {
                            found.push({
                                path: binJava,
                                version: this.guessVersionFromPath(entry),
                                name: entry
                            });
                        }
                    }
                } catch (e) { }
                continue;
            }

            // General Scan
            try {
                // If the root IS a bin folder (like homebrew)
                if (root.endsWith('bin')) {
                    const binJava = path.join(root, this.execName);
                    if (fs.existsSync(binJava)) {
                        found.push({ path: binJava, version: 17, name: 'OpenJDK' }); // Rough guess
                    }
                    continue;
                }

                // Normal directory scanning
                const subdirs = fs.readdirSync(root);
                for (const sub of subdirs) {
                    const fullPath = path.join(root, sub);
                    if (!fs.statSync(fullPath).isDirectory()) continue;

                    // Standard layout: folder/bin/java
                    const binJava = path.join(fullPath, 'bin', this.execName);
                    if (fs.existsSync(binJava)) {
                        found.push({
                            path: binJava,
                            version: this.guessVersionFromPath(sub),
                            name: sub
                        });
                        continue;
                    }

                    // Nested layout (managed dir): folder/jdk-something/bin/java
                    try {
                        const nested = fs.readdirSync(fullPath);
                        for (const n of nested) {
                            const nestedDir = path.join(fullPath, n);
                            if (fs.statSync(nestedDir).isDirectory()) {
                                const nestedBin = path.join(nestedDir, 'bin', this.execName);
                                if (fs.existsSync(nestedBin)) {
                                    found.push({
                                        path: nestedBin,
                                        version: this.guessVersionFromPath(n),
                                        name: n
                                    });
                                }
                                // macOS managed extraction: nestedDir might be Contents/Home ??
                                // Usually tar.gz extract preserves structure.
                                // If mac, check nestedDir/Contents/Home/bin/java
                                if (this.platform === 'darwin') {
                                    const macBin = path.join(nestedDir, 'Contents', 'Home', 'bin', 'java');
                                    if (fs.existsSync(macBin)) {
                                        found.push({
                                            path: macBin,
                                            version: this.guessVersionFromPath(n),
                                            name: n
                                        });
                                    }
                                }
                            }
                        }
                    } catch (e) { }
                }

            } catch (e) { }
        }

        // Deduplicate
        const unique = [];
        const seen = new Set();
        for (const j of found) {
            if (!seen.has(j.path)) {
                seen.add(j.path);
                unique.push(j);
            }
        }
        return unique;
    }

    guessVersionFromPath(pathName) {
        // Common patterns
        const patterns = [
            /jdk-?(\d+)/i,       // jdk-17
            /jre-?(\d+)/i,       // jre-17
            /^(\d+)\./,          // 17.0.1
            /1\.(\d+)\./,        // 1.8.0
            /java-(\d+)/i,       // java-8-openjdk
            /temurin-(\d+)/i,
        ];

        for (const p of patterns) {
            const match = pathName.match(p);
            if (match && match[1]) return parseInt(match[1]);
        }

        // Fallback names
        if (pathName.includes('java-8')) return 8;
        if (pathName.includes('java-17')) return 17;
        if (pathName.includes('java-21')) return 21;

        return 0;
    }

    async checkSystemJava(version) {
        // Quick verify: 'java -version'
        // If system default matches, use it.
        try {
            const output = execSync('java -version', { encoding: 'utf8', stdio: 'pipe' });
            // Output usually: "openjdk version "17.0.1" ..." (on stderr mostly for java)
        } catch (e) {
            // java not in path or failed, proceed to manual scan
            // Actually, java -version often writes to stderr
        }

        const all = await this.scanForJavas();
        // Filter for >= version
        // Sort by version desc
        const valid = all.filter(j => {
            if (version === 8) return j.version === 8;
            return j.version >= version;
        }).sort((a, b) => a.version - b.version); // get closest valid version

        return valid.length > 0 ? valid[0].path : null;
    }

    // ... downloadAndInstall logic updated for non-zip ... 
    async downloadAndInstall(version, onProgress) {
        const url = this.getDownloadUrl(version);
        const installDir = this.getInstallDir(version);

        log.info(`[JavaManager] Downloading Java ${version} for ${this.platform} (${this.arch}) from ${url}`);

        if (this.dl) throw new Error("Download in progress");

        if (fs.existsSync(installDir)) {
            try { fs.rmSync(installDir, { recursive: true, force: true }); } catch (e) { }
        }
        fs.mkdirSync(installDir, { recursive: true });

        // On macOS/Linux, we likely get a .tar.gz
        const isTar = url.endsWith('.tar.gz');
        const fileName = isTar ? 'java-runtime.tar.gz' : 'java-runtime.zip';

        this.dl = new DownloaderHelper(url, installDir, {
            fileName: fileName,
            override: true
        });

        return new Promise((resolve, reject) => {
            this.dl.on('progress', stats => { if (onProgress) onProgress(stats); });

            this.dl.on('end', async () => {
                log.info('[JavaManager] Download complete. Extracting...');
                this.dl = null;
                try {
                    const filePath = path.join(installDir, fileName);

                    if (isTar) {
                        // Use tar command for reliability on unix
                        if (this.platform !== 'win32') {
                            try {
                                execSync(`tar -xzf "${filePath}" -C "${installDir}"`);
                            } catch (e) {
                                // Fallback or error
                                return reject(new Error(`Tar extraction failed: ${e.message}`));
                            }
                        } else {
                            // Windows handling of tar.gz if needed (rare for this logic but possible)
                            // We can use 'tar' on Win10+ or a library
                            // For now assume logic chose zip for win32
                        }
                    } else {
                        const zip = new AdmZip(filePath);
                        zip.extractAllTo(installDir, true);
                    }

                    log.info('[JavaManager] Extraction complete.');
                    fs.unlinkSync(filePath);

                    // Re-scan finding the binary
                    const javaBin = this.findJavaBinary(installDir);

                    if (javaBin) {
                        // Make executable on unix
                        if (this.platform !== 'win32') {
                            fs.chmodSync(javaBin, '755');
                        }

                        // Also chmod the jspawnhelper if it exists (fix for some mac/linux spawn issues)
                        try {
                            // jspawnhelper is typically in lib/jspawnhelper relative to bin/java's parent? 
                            // Just chmod -R usually safest for bin?
                            execSync(`chmod -R +x "${installDir}"`);
                        } catch (e) { }

                        log.info(`[JavaManager] Java installed to: ${javaBin}`);
                        resolve(javaBin);
                    } else {
                        reject(new Error("Java executable not found after extraction."));
                    }
                } catch (e) {
                    reject(e);
                }
            });

            this.dl.on('error', err => { this.dl = null; reject(err); });
            this.dl.start().catch(err => reject(err));
        });
    }

    // ... pause/resume/cancel (Keep as is) ...
    pauseDownload() { if (this.dl) { this.dl.pause(); return true; } return false; }
    resumeDownload() { if (this.dl) { this.dl.resume(); return true; } return false; }
    cancelDownload() { if (this.dl) { this.dl.stop(); this.dl = null; return true; } return false; }
}

module.exports = new JavaManager();
