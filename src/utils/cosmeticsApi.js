const BASE_URL = 'https://api.craftcorps.net';

/**
 * Fetch cosmetics owned by a player
 * @param {string} playerUuid - The Minecraft Player UUID
 * @returns {Promise<Array>} - List of cosmetic objects
 */
/**
 * Fetch cosmetics owned by a player
 * @param {string} playerUuid - The Minecraft Player UUID
 * @returns {Promise<Array>} - List of cosmetic IDs
 */
export const fetchPlayerCosmetics = async (playerUuid) => {
    try {
        const response = await fetch(`${BASE_URL}/cosmetics/capes?uuid=${playerUuid}`);
        if (!response.ok) {
            if (response.status === 404) return []; // User has no cosmetics
            throw new Error('Failed to fetch cosmetics');
        }
        const data = await response.json();
        // API returns: { "capes": ["cape_fire"], "activeCapeId": "..." }
        // For partial compatibility, we return just the array here, or we could return the object.
        // But the legacy code expects array.
        return data.capes || [];
    } catch (error) {
        console.error('Error fetching cosmetics:', error);
        return [];
    }
};

/**
 * Fetch Detailed User Cosmetics (Authenticated)
 * @param {string} token 
 * @param {string} uuid 
 */
export const fetchDetailedCosmetics = async (token, uuid) => {
    try {
        const response = await fetch(`${BASE_URL}/cosmetics/player?uuid=${uuid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.warn('[CosmeticsAPI] Detailed fetch failed:', response.status);
            return null;
        }

        const data = await response.json();
        // Returns: { playerUuid, cosmetics: [{ cosmeticId, isActive, name, textureUrl }] }
        return data;
    } catch (error) {
        console.error('Error fetching detailed cosmetics:', error);
        return null;
    }
};


/**
 * Fetch ALL available cosmetics (Catalog)
 * @returns {Promise<Array>}
 */
export const fetchAllCosmetics = async () => {
    try {
        // Try the catalog endpoint first, with fallbacks
        const endpoints = ['/cosmetics/catalog', '/cosmetics/list', '/cosmetics/all', '/store/cosmetics'];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${BASE_URL}${endpoint}`);
                if (response.ok) {
                    const data = await response.json();
                    // API returns array of: { cosmeticId, name, type, description, textureUrl }
                    return data;
                }
            } catch (e) {
                continue; // Try next endpoint
            }
        }

        console.warn('All catalog endpoints failed, catalog may not be deployed yet');
        return [];
    } catch (error) {
        console.error('Error fetching catalog:', error);
        return [];
    }
}

/**
 * Equip a cosmetic
 * @param {string} token - User Token (likely Minecraft Access Token or internal auth token)
 * @param {string} capeId - The ID of the cape to equip
 * @returns {Promise<boolean>} - Success status
 */
export const equipCosmetic = async (token, capeId) => {
    try {
        const response = await fetch(`${BASE_URL}/cosmetics/equip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Assuming Bearer token
            },
            body: JSON.stringify({ capeId })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to equip cosmetic');
        }

        return true;
    } catch (error) {
        console.error('Error equipping cosmetic:', error);
        throw error;
    }
};

/**
 * Register/Link User
 * @param {string} token - User Token
 * @param {string} userId - CraftCorps User ID
 * @param {Array<string>} playerUuids - List of Minecraft UUIDs
 */
export const registerUser = async (token, userId, playerUuids) => {
    try {
        const response = await fetch(`${BASE_URL}/cosmetics/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, playerUuids })
        });

        if (!response.ok) {
            throw new Error('Failed to register user');
        }
        return true;
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
};

/**
 * Get Texture URL
 * @param {string} cosmeticId 
 * @returns {string} - The full URL to the texture
 */
export const getCosmeticTextureUrl = (cosmeticId) => {
    return `${BASE_URL}/cosmetics/${cosmeticId}/texture`;
};
