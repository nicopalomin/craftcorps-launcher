const { net } = require('electron');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // Requires 'sharp' installed

/**
 * Fetches Minecraft skin data for a given username.
 * @param {string} username 
 * @returns {Promise<{skinUrl: string, model: string, capeUrl: string | null}>}
 */
async function getSkinFromUsername(username) {
    if (!username) throw new Error('Username is required');

    try {
        console.log(`[SkinHandler] Fetching UUID for ${username}...`);

        // 1. Get UUID from Username
        const uuidResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`, {
            cache: 'no-store'
        });

        if (uuidResponse.status === 204 || uuidResponse.status === 404) {
            console.warn(`[SkinHandler] Username ${username} not found.`);
            return null;
        }

        if (!uuidResponse.ok) {
            throw new Error(`Mojang API Error: ${uuidResponse.statusText}`);
        }

        const uuidData = await uuidResponse.json();
        const uuid = uuidData.id;
        console.log(`[SkinHandler] Got UUID: ${uuid}`);

        // 2. Get Profile from UUID
        // Add timestamp to force fresh request from Mojang's side if possible, and disable local cache
        const profileResponse = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}?unsigned=false&ts=${Date.now()}`, {
            cache: 'no-store'
        });

        if (!profileResponse.ok) {
            throw new Error(`Session Server Error: ${profileResponse.statusText}`);
        }

        const profileData = await profileResponse.json();

        // 3. Decode Textures
        const texturesProp = profileData.properties.find(p => p.name === 'textures');
        if (!texturesProp) {
            console.log('[SkinHandler] No textures property found on profile.');
            return null;
        }

        const decodedBuffer = Buffer.from(texturesProp.value, 'base64');
        const decodedString = decodedBuffer.toString('utf-8');
        const textures = JSON.parse(decodedString);

        if (!textures.textures || !textures.textures.SKIN) {
            console.log('[SkinHandler] No SKIN texture found.');
            return null;
        }

        const skinUrl = textures.textures.SKIN.url;
        const model = textures.textures.SKIN.metadata?.model === 'slim' ? 'slim' : 'classic';
        const capeUrl = textures.textures.CAPE?.url || null;

        console.log(`[SkinHandler] Found valid skin. Model: ${model}, Cape: ${!!capeUrl}`);

        return {
            skinUrl,
            model,
            capeUrl,
            uuid
        };

    } catch (error) {
        console.error('[SkinHandler] Error fetching skin:', error);
        throw error; // Re-throw to be caught by IPC handler
    }
}

/**
 * Uploads a skin to Minecraft Services.
 * @param {string} token - Minecraft Access Token
 * @param {string} filePath - Absolute path to the png file
 * @param {string} variant - 'classic' or 'slim'
 */
async function uploadSkin(token, filePath, variant) {
    console.log(`[SkinHandler] processing skin from ${filePath} (${variant})...`);

    // We can't easily use global FormData in Electron Main without some quirks (Node vs Browser).
    // However, Electron > 18 has global fetch.
    // Simplest way for multipart in Node without libraries is tricky.
    // Let's use the 'FormData' polyfill/class if available or construct body manually.
    // Actually, simpler approach: Use the JSON endpoint if we had a URL, but we need file upload.
    // Since we don't have 'form-data' package installed as a dependency (only possibly in tree),
    // let's try to fetch with a manual multipart construction OR check if FormData is available.
    // Node 18+ has native FormData. electron 25+ has Node 18+. We are on electron 39 (Node 20+).
    // Native FormData requires Blob.

    try {
        const fileBuffer = fs.readFileSync(filePath);

        // --- 1. Validate Image Dimensions ---
        const metadata = await sharp(fileBuffer).metadata();
        const { width, height, format } = metadata;

        console.log(`[SkinHandler] Image Info: ${width}x${height} (${format})`);

        if (format !== 'png') {
            throw new Error(`Invalid format: ${format}. Only PNG is allowed.`);
        }

        // Minecraft allows 64x64 (modern) and 64x32 (legacy)
        const isValid = (width === 64 && height === 64) || (width === 64 && height === 32);

        if (!isValid) {
            throw new Error(`Invalid skin dimensions: ${width}x${height}. Skin must be 64x64 or 64x32.`);
        }

        // --- 2. Upload to Mojang ---
        console.log('[SkinHandler] Validation passed. Uploading to Mojang...');

        const fileName = path.basename(filePath);

        // Create Blob from buffer (Node 20 supports this)
        const blob = new Blob([fileBuffer], { type: 'image/png' });

        const formData = new FormData();
        formData.append('variant', variant);
        formData.append('file', blob, fileName);

        const response = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Upload failed (${response.status}): ${errText}`);
        }

        console.log('[SkinHandler] Upload successful!');
        // Return verification status
        return { success: true, verified: true };

    } catch (error) {
        console.error('[SkinHandler] Upload Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * IPC Handler wrapper
 */
async function handleGetMinecraftSkin(event, username) {
    try {
        return await getSkinFromUsername(username);
    } catch (error) {
        return { error: error.message };
    }
}

async function handleUploadMinecraftSkin(event, { token, filePath, variant }) {
    if (!token) return { success: false, error: 'No access token provided' };
    if (!filePath) return { success: false, error: 'No file provided' };

    try {
        return await uploadSkin(token, filePath, variant || 'classic');
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Reads and validates a skin file, returning a Data URI.
 * @param {string} filePath 
 */
async function readSkin(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const metadata = await sharp(fileBuffer).metadata();
        const { width, height, format } = metadata;

        if (format !== 'png') throw new Error('Only PNG files are allowed.');
        const isValid = (width === 64 && height === 64) || (width === 64 && height === 32);
        if (!isValid) throw new Error(`Invalid dimensions: ${width}x${height}. Must be 64x64 or 64x32.`);

        const base64 = fileBuffer.toString('base64');
        return {
            success: true,
            dataUri: `data:image/png;base64,${base64}`,
            width,
            height
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function handleReadSkin(event, filePath) {
    return await readSkin(filePath);
}

module.exports = {
    handleGetMinecraftSkin,
    handleUploadMinecraftSkin,
    handleReadSkin
};
