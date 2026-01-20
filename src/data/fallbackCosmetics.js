// Temporary local fallback data for testing cape rendering
// This will be ignored once the API is deployed

export const FALLBACK_COSMETICS = [
    {
        cosmeticId: 'cape_developer',
        name: 'Test Cape',
        type: 'CAPE',
        description: 'A test cape for development',
        // Use the API endpoint which returns 302 redirect to actual texture
        textureUrl: 'https://api.craftcorps.net/cosmetics/cape_developer/texture'
    },
    {
        cosmeticId: 'cape_founder',
        name: "Founder's Cape",
        type: 'CAPE',
        description: 'Exclusive cape for founding members',
        // Use the API endpoint which returns 302 redirect to actual texture
        textureUrl: 'https://api.craftcorps.net/cosmetics/cape_founder/texture'
    }
];

