const { ipcMain } = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

/**
 * Get Instance Shaders
 * Scans the shaderpacks directory and optionsshaders.txt
 */
const getInstanceShaders = async (event, instancePath, force = false) => {
    if (!instancePath || !fs.existsSync(instancePath)) return [];

    const shadersDir = path.join(instancePath, 'shaderpacks');
    if (!fs.existsSync(shadersDir)) return [];

    // Check optionsshaders.txt for active shader
    let activeShader = null;
    const optionsPath = path.join(instancePath, 'optionsshaders.txt');
    if (fs.existsSync(optionsPath)) {
        try {
            const content = fs.readFileSync(optionsPath, 'utf8');
            // Format: shaderPack=buffer.zip
            const match = content.match(/shaderPack=(.+)/);
            if (match) {
                activeShader = match[1].trim();
            }
        } catch (e) {
            log.warn(`[Shaders] Failed to parse optionsshaders.txt: ${e.message}`);
        }
    }

    try {
        const entries = await fs.promises.readdir(shadersDir, { withFileTypes: true });
        const shaders = [];

        // Chunked processing
        const chunkSize = 20;
        for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = entries.slice(i, i + chunkSize);

            const chunkResults = await Promise.all(chunk.map(async (entry) => {
                const fullPath = path.join(shadersDir, entry.name);
                let description = ''; // Shaders don't usually have standard descriptions readable easily

                // Keep it simple for Shaders: Name only mostly.
                // Some might have shaders/shaders.properties?

                return {
                    name: entry.name,
                    path: fullPath,
                    active: activeShader === entry.name
                };
            }));

            chunkResults.forEach(p => { if (p) shaders.push(p); });
            if (entries.length > 50) await new Promise(r => setImmediate(r));
        }

        return shaders;
    } catch (error) {
        log.error(`[Shaders] Failed to scan: ${error.message}`);
        return [];
    }
};

/**
 * Select Shader Files
 */
const selectShaderFiles = async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Shaders (Zip)', extensions: ['zip'] }]
    });
    if (result.canceled) return [];
    return result.filePaths;
};

/**
 * Add Instance Shaders
 */
const addInstanceShaders = async (event, { instancePath, filePaths }) => {
    if (!instancePath || !filePaths || filePaths.length === 0) return { success: false, error: 'Invalid arguments' };

    const shadersDir = path.join(instancePath, 'shaderpacks');
    if (!fs.existsSync(shadersDir)) {
        await fs.promises.mkdir(shadersDir, { recursive: true });
    }

    let addedCount = 0;
    const addedShaders = [];
    const errors = [];

    for (const filePath of filePaths) {
        try {
            const fileName = path.basename(filePath);
            const destPath = path.join(shadersDir, fileName);

            if (fs.existsSync(destPath)) {
                errors.push(`Skipped ${fileName}: File already exists`);
                continue;
            }

            // Simple validation: Check if zip
            if (!fileName.toLowerCase().endsWith('.zip')) {
                errors.push(`Skipped ${fileName}: Not a zip file`);
                continue;
            }

            await fs.promises.copyFile(filePath, destPath);

            addedShaders.push({
                name: fileName,
                path: destPath,
                active: false
            });
            addedCount++;
        } catch (e) {
            log.error(`[Shaders] Failed to add ${filePath}: ${e.message}`);
            errors.push(`Failed ${path.basename(filePath)}: ${e.message}`);
        }
    }

    return { success: true, added: addedCount, addedShaders, errors };
};

/**
 * Delete Shader
 */
const deleteShader = async (event, filePath) => {
    if (!filePath) return { success: false, error: 'No file path provided' };
    try {
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            log.info(`[Shaders] Deleted: ${filePath}`);
            return { success: true };
        } else {
            return { success: false, error: 'File not found' };
        }
    } catch (e) {
        log.error(`[Shaders] Failed to delete ${filePath}: ${e.message}`);
        return { success: false, error: e.message };
    }
};

function setupShaderPackHandlers() {
    ipcMain.removeHandler('get-instance-shaders');
    ipcMain.removeHandler('select-shader-files');
    ipcMain.removeHandler('add-instance-shaders');
    ipcMain.removeHandler('delete-shader');

    ipcMain.handle('get-instance-shaders', getInstanceShaders);
    ipcMain.handle('select-shader-files', selectShaderFiles);
    ipcMain.handle('add-instance-shaders', addInstanceShaders);
    ipcMain.handle('delete-shader', deleteShader);

    return {
        'get-instance-shaders': getInstanceShaders,
        'select-shader-files': selectShaderFiles,
        'add-instance-shaders': addInstanceShaders,
        'delete-shader': deleteShader
    };
}

module.exports = { setupShaderPackHandlers, getInstanceShaders, selectShaderFiles, addInstanceShaders, deleteShader };
