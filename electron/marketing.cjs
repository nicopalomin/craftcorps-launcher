const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function parseArgs() {
    const args = process.argv;
    const getArg = (name) => {
        const prefix = `--${name}=`;
        const arg = args.find(a => a.startsWith(prefix));
        return arg ? arg.substring(prefix.length) : null;
    };

    return {
        isMarketing: args.includes('--marketing-shot'),
        outPath: getArg('output') || path.join(process.cwd(), 'screenshot.png'),
        route: getArg('route') || '/',
        width: parseInt(getArg('width') || '1280'),
        height: parseInt(getArg('height') || '720'),
        delay: parseInt(getArg('delay') || '2000') // Wait time in ms
    };
}

async function runMarketingShot(app) {
    const { outPath, route, width, height, delay } = parseArgs();
    console.log(`[MARKETING] Starting capture for route: ${route}`);
    console.log(`[MARKETING] Dimensions: ${width}x${height} (Logical) -> ${width * 2}x${height * 2} (Physical via 2x scale)`);
    console.log(`[MARKETING] Output: ${outPath}`);

    const preloadPath = path.join(__dirname, 'preload.cjs');

    const win = new BrowserWindow({
        width: width,
        height: height,
        useContentSize: true,
        show: false,
        frame: false,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            offscreen: true, // As requested "offscreen: true if needed"
        },
    });

    // Handle load
    const startUrl = process.env.ELECTRON_START_URL
        ? process.env.ELECTRON_START_URL
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    // Construct full URL with hash if needed
    // Assuming HashRouter for Electron apps often
    const fullUrl = startUrl.includes('file://')
        ? `${startUrl}#${route}`
        : `${startUrl}${route}`;

    console.log(`[MARKETING] Loading URL: ${fullUrl}`);

    try {
        await win.loadURL(fullUrl);

        console.log(`[MARKETING] Waiting ${delay}ms for render/animations...`);
        // Wait for connection/animations
        await new Promise(r => setTimeout(r, delay));

        console.log('[MARKETING] Capturing page...');
        const image = await win.webContents.capturePage();

        const pngBuffer = image.toPNG();

        console.log(`[MARKETING] Writing ${pngBuffer.length} bytes to ${outPath}`);
        fs.writeFileSync(outPath, pngBuffer);

        console.log('[MARKETING] Done.');
        app.quit();
        process.exit(0);

    } catch (err) {
        console.error('[MARKETING] Error:', err);
        app.quit();
        process.exit(1);
    }
}

module.exports = { runMarketingShot };
