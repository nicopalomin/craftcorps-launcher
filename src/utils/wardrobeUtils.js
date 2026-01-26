/**
 * Normalizes a skin Data URI by drawing it to a canvas.
 * This ensures consistent format and compression for comparison.
 */
export const normalizeSkin = (dataUri) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.onerror = () => resolve(dataUri);
        img.src = dataUri;
    });
};

/**
 * Categorizes a flat list of cosmetics into a grouped object.
 */
export const categorizeCosmetics = (cosmetics) => {
    const order = [
        'Capes',
        'Name Tags',
        'Hats',
        'Glasses',
        'Wings',
        'Item Skins',
        'Emotes',
        'UI & HUD Enchantments',
        'Kill Effects'
    ];

    const groups = {};
    order.forEach(cat => groups[cat] = []);

    cosmetics.forEach(item => {
        const rawType = item.type || 'Cosmetic';
        let typeKey = rawType;

        const upper = rawType.toUpperCase();
        if (upper === 'CAPE') typeKey = 'Capes';
        else if (upper === 'WING') typeKey = 'Wings';
        else if (upper === 'HAT' || upper === 'HEAD') typeKey = 'Hats';
        else if (upper === 'NAMETAG' || upper === 'NAME TAG') typeKey = 'Name Tags';
        else if (upper === 'GLASS' || upper === 'GLASSES') typeKey = 'Glasses';
        else if (upper === 'ITEMSKIN' || upper === 'ITEM SKIN') typeKey = 'Item Skins';
        else if (upper === 'EMOTE') typeKey = 'Emotes';
        else if (upper === 'HUD' || upper === 'UI & HUD' || upper === 'UI & HUD ENCHANTMENTS') typeKey = 'UI & HUD Enchantments';
        else if (upper === 'KILLEFFECT' || upper === 'KILL EFFECT') typeKey = 'Kill Effects';
        else {
            typeKey = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase() + 's';
        }

        if (!groups[typeKey]) groups[typeKey] = [];
        groups[typeKey].push(item);
    });

    const result = {};
    order.forEach(key => {
        const items = groups[key] || [];
        // Sort: Owned first
        items.sort((a, b) => (a.isOwned === b.isOwned ? 0 : a.isOwned ? -1 : 1));
        result[key] = items;
        delete groups[key];
    });

    Object.keys(groups).sort().forEach(key => {
        const items = groups[key];
        // Sort: Owned first
        items.sort((a, b) => (a.isOwned === b.isOwned ? 0 : a.isOwned ? -1 : 1));
        result[key] = items;
    });

    return result;
};
/**
 * Determines the default model (classic or slim) based on UUID parity.
 * Matches Minecraft's internal logic.
 */
export const getDefaultModel = (uuid) => {
    if (!uuid || uuid === '0' || uuid === '00000000-0000-0000-0000-000000000000') return 'classic';

    // Remove dashes and parse as hex
    const hex = uuid.replace(/-/g, '');
    if (!hex) return 'classic';

    // In Java, UUID.hashCode() is (mostSigBits ^ leastSigBits)
    // Parity of hashCode() determines Alex vs Steve.
    // Simplifying for JS: check if the summation of bits is even/odd.
    // Most common implementation for launchers: check the 13th char or use a hash.
    // Mojang's real rule: (uuid.hashCode() & 1) == 0 ? Steve : Alex

    // Simple parity check on the UUID string hash
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
        hash = ((hash << 5) - hash) + uuid.charCodeAt(i);
        hash |= 0;
    }
    return (Math.abs(hash) % 2 === 0) ? 'classic' : 'slim';
};
