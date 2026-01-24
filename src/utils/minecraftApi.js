// Fetch Minecraft versions from Mojang's official API

export const fetchMinecraftVersions = async (includeSnapshots = false) => {
    try {
        const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        if (!response.ok) {
            throw new Error('Failed to fetch versions');
        }

        const data = await response.json();

        // Filter versions
        const filteredVersions = data.versions
            .filter(v => v.type === 'release' || (includeSnapshots && v.type === 'snapshot'))
            .map(v => v.id);

        // Get versions until 1.0
        // We'll try to find the 1.0 release as a pivot.
        const cutoffIndex = filteredVersions.indexOf('1.0');

        // If 1.0 is found, slice until there.
        const finalVersions = cutoffIndex !== -1 ? filteredVersions.slice(0, cutoffIndex + 1) : filteredVersions;

        return finalVersions;
    } catch (error) {
        console.error('Error fetching Minecraft versions:', error);
        // Fallback to hardcoded versions if API fails
        return [
            '1.21.4', '1.21.3', '1.21.1', '1.21',
            '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
            '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
            '1.18.2', '1.18.1', '1.18',
            '1.17.1', '1.17',
            '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
            '1.15.2', '1.14.4', '1.13.2', '1.12.2', '1.8.9'
        ];
    }
};

// Get latest Minecraft version
export const getLatestVersion = async () => {
    try {
        const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        if (!response.ok) {
            throw new Error('Failed to fetch latest version');
        }

        const data = await response.json();
        return data.latest.release;
    } catch (error) {
        console.error('Error fetching latest version:', error);
        return '1.21.4'; // Fallback
    }
};
