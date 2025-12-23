// Fetch Minecraft versions from Mojang's official API
export const fetchMinecraftVersions = async () => {
    try {
        const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        if (!response.ok) {
            throw new Error('Failed to fetch versions');
        }

        const data = await response.json();

        // Filter to only release versions (not snapshots)
        const releases = data.versions
            .filter(v => v.type === 'release')
            .map(v => v.id)
            .slice(0, 30); // Get latest 30 releases

        return releases;
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
