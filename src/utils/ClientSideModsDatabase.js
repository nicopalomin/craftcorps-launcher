/**
 * Database of client-side only mods that are compatible with vanilla servers
 * These mods only affect the client and don't require server-side installation
 * 
 * Used for compatibility checking when users try to join servers
 */

export class ClientSideModsDatabase {
    /**
     * List of mod IDs/slugs/jar names that are client-side only
     * Organized by category for maintainability
     */
    static CLIENT_SIDE_MODS = {
        // ===== PERFORMANCE & OPTIMIZATION =====
        performance: [
            // Fabric Performance
            'sodium',
            'lithium',
            'phosphor',
            'starlight',
            'ferritecore',
            'lazydfu',
            'krypton',
            'entityculling',
            'memoryleakfix',
            'smoothboot',
            'fastload',
            'lazystronghold',
            'immediatelyfast',
            'modernfix',
            'exordium',
            'enhanced-block-entities',
            'dashloader',
            'c2me-fabric',
            'vmp-fabric',

            // Forge Performance
            'optifine',
            'rubidium',
            'magnesium',
            'oculus',
            'embeddium',
            'roadrunner',
            'canary',
            'radium',
            'smoothfocus',
            'ai-improvements',
            'clumps',
            'entitycullling-forge',
            'fastfurnace',
            'fastsuite',
            'fastworkbench',
            'fpsreducer',
            'betterbiomeblend',
            'betterfpsdist',
        ],

        // ===== RENDERING & SHADERS =====
        rendering: [
            'iris',
            'oculus',
            'continuity',
            'indium',
            'reeses-sodium-options',
            'sodium-extra',
            'cull-leaves',
            'cull-less-leaves',
            'dynamic-fps',
            'entity-texture-features',
            'entity-model-features',
            'fabricskyboxes',
            'lamb-dynamic-lights',
            'lambdabettergrass',
            'not-enough-animations',
            'physics-mod',
            'enhanced-block-entities',
            'spark',
            'particle-rain',
        ],

        // ===== UI & HUD =====
        ui: [
            'modmenu',
            'cloth-config',
            'configured',
            'catalogue',
            'controlling',
            'malilib',
            'shulkerboxtooltip',
            'appleskin',
            'torohealth',
            'roughly-enough-items',
            'rei',
            'jei',
            'just-enough-items',
            'emi',
            'itemzoom',
            'inventory-profiles-next',
            'inventoryhud',
            'mouse-tweaks',
            'mousewheelie',
            'inventorytweaks',
            'neat',
            'overloaded-armor-bar',
            'xaeros-minimap',
            'xaeros-world-map',
            'journeymap',
            'antique-atlas',
            'voxelmap',
            'betteradvancements',
            'advancement-plaques',
            'chat-heads',
            'status-effect-bars',
            'durability-viewer',
            'light-overlay',
        ],

        // ===== INPUT & CONTROLS =====
        controls: [
            'amecs',
            'controlling',
            'mouse-wheelie',
            'better-third-person',
            'camera-utils',
            'antighost',
            'presence-footsteps',
            'cameraoverhaul',
            'freecam',
            'shoulder-surfing-reloaded',
        ],

        // ===== AUDIO =====
        audio: [
            'sound-physics-remastered',
            'extreme-sound-muffler',
            'dynamic-sound-filters',
            'auditory',
            'sound-reloader',
            'custom-music-discs',
        ],

        // ===== LIBRARY & API (Client-side) =====
        library: [
            'fabric-api',
            'fabric-language-kotlin',
            'architectury-api',
            'balm',
            'cloth-config',
            'malilib',
            'cloth-config-forge',
            'collective',
            'framework',
            'iceberg',
            'puzzles-lib',
            'geckolib',
            'mixinextras',
            'forgeconfigapiport',
        ],

        // ===== COSMETIC & VISUAL =====
        cosmetic: [
            'iris',
            'effective',
            'visuality',
            'falling-leaves',
            'eating-animation',
            'not-enough-animations',
            'first-person-model',
            ' 3dskinlayers',
            'blur',
            'borderless-mining',
            'clear-skies',
            'fancy-menu',
            'loading-screen-tips',
            'custom-stars',
            'nostalgic-tweaks',
        ],

        // ===== DEBUGGING & DEV TOOLS =====
        debug: [
            'wthit',
            'hwyla',
            'jade',
            'the-one-probe',
            'top',
            'schematica',
            'litematica',
            'tweakeroo',
            'minihud',
            'worldedit-cui',
            'voxelsniper',
        ],

        // ===== SCREENSHOT & RECORDING =====
        media: [
            'replaymod',
            'screenshot-to-clipboard',
            'screencopy',
        ],

        // ===== QUALITY OF LIFE =====
        qol: [
            'betterf3',
            'gamma-utils',
            'lambdynamiclights',
            'no-chat-reports',
            'no-telemetry',
            'zoomify',
            'logical-zoom',
            'ok-zoomer',
            'chunks-fade-in',
            'better-ping-display',
            'custom-fog',
            'dark-loading-screen',
            'inspecio',
            'tooltip-scroll',
            'better-mount-hud',
            'equipment-compare',
            'inventory-sorting',
            'curios',
            'cosmetic-armor-reworked',
        ],
    };

    /**
     * Get all client-side mod identifiers as a flat array
     * @returns {string[]} Array of mod identifiers
     */
    static getAllClientSideMods() {
        return Object.values(this.CLIENT_SIDE_MODS).flat();
    }

    /**
     * Check if a mod is client-side only
     * @param {string} modId - Mod identifier (slug, jar name, or mod ID)
     * @returns {boolean} True if mod is client-side only
     */
    static isClientSideOnly(modId) {
        if (!modId) return false;

        const normalizedId = modId.toLowerCase()
            .replace(/\.jar$/, '')
            .replace(/[-_\s]/g, '');

        const allMods = this.getAllClientSideMods();
        return allMods.some(clientMod => {
            const normalizedClientMod = clientMod.toLowerCase().replace(/[-_\s]/g, '');
            return normalizedId.includes(normalizedClientMod) || normalizedClientMod.includes(normalizedId);
        });
    }

    /**
     * Filter out client-side mods from a mod list
     * @param {string[]} modList - Array of mod identifiers
     * @returns {string[]} Array of mods that are NOT client-side only
     */
    static filterClientSideMods(modList) {
        if (!Array.isArray(modList)) return [];
        return modList.filter(mod => !this.isClientSideOnly(mod));
    }

    /**
     * Check if an instance is "vanilla compatible" (only has client-side mods)
     * @param {string[]} modList - Array of mod identifiers from an instance
     * @returns {boolean} True if instance can join vanilla servers
     */
    static isVanillaCompatible(modList) {
        if (!Array.isArray(modList) || modList.length === 0) return true;
        const serverRequiredMods = this.filterClientSideMods(modList);
        return serverRequiredMods.length === 0;
    }

    /**
     * Get detailed compatibility info for an instance
     * @param {string[]} modList - Array of mod identifiers
     * @returns {object} Compatibility information
     */
    static getCompatibilityInfo(modList) {
        if (!Array.isArray(modList)) {
            return {
                total: 0,
                clientSide: 0,
                serverRequired: 0,
                vanillaCompatible: true,
                serverRequiredMods: []
            };
        }

        const clientSideMods = modList.filter(mod => this.isClientSideOnly(mod));
        const serverRequiredMods = this.filterClientSideMods(modList);

        return {
            total: modList.length,
            clientSide: clientSideMods.length,
            serverRequired: serverRequiredMods.length,
            vanillaCompatible: serverRequiredMods.length === 0,
            serverRequiredMods: serverRequiredMods
        };
    }
}

export default ClientSideModsDatabase;
