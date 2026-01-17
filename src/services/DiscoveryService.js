const STORE_KEY = 'cached_discover_servers';

class DiscoveryService {
    constructor() {
        this.store = null;
        this.memoryCache = null; // Instant tab switching cache
    }

    init(store) {
        this.store = store;
    }

    getMemoryCache() {
        return this.memoryCache;
    }

    // Disk cache (deprecated for initial load, kept for backup fallback?)
    // User wants: First load = shimmer. Tab switch = cache.
    // So distinct from 'legacy disk cache' which persists across app restarts.
    async getCachedServers() {
        if (!this.store) return [];
        return (await this.store.get(STORE_KEY)) || [];
    }

    async getCategories() {
        // Deprecated: use getMetadata for full set
        return this.getMetadata().then(res => ({ categories: res.categories || [] }));
    }

    async getMetadata() {
        if (window.electronAPI && window.electronAPI.getDiscoverMetadata) {
            try {
                return await window.electronAPI.getDiscoverMetadata();
            } catch (e) {
                console.error('[Discovery] Failed to fetch metadata', e);
            }
        }
        return { categories: [], versions: [], languages: [] };
    }

    async joinServer(payload) {
        if (window.electronAPI && window.electronAPI.joinServer) {
            try {
                return await window.electronAPI.joinServer(payload);
            } catch (e) {
                console.error('[Discovery] Failed to join server', e);
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'IPC Unavailable' };
    }

    async fetchServers(offset = 0, limit = 9, category = 'all', version = null, language = null, query = null) {
        if (window.electronAPI && window.electronAPI.getDiscoverServers) {
            try {
                const res = await window.electronAPI.getDiscoverServers({ offset, limit, category, version, language, query });

                // If clean fetch (first page, no filters), update memory cache
                if (res && (res.servers || Array.isArray(res)) && offset === 0 && !query && category === 'all' && !version && !language) {
                    this.memoryCache = res.servers || res;
                }

                return res;
            } catch (e) {
                console.error('[Discovery] Failed to fetch servers via IPC', e);
            }
        }
        return { servers: [], hasMore: false };
    }
}

export const discovery = new DiscoveryService();
