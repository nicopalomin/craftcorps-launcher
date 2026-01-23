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
        result[key] = groups[key] || [];
        delete groups[key];
    });

    Object.keys(groups).sort().forEach(key => {
        result[key] = groups[key];
    });

    return result;
};
