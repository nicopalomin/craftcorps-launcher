const STORE_KEY = 'cached_discover_servers';

class DiscoveryService {
    constructor() {
        this.store = null;
        this.memoryCacheMap = new Map(); // Per-filter cache for instant tab switching
    }

    init(store) {
        this.store = store;
    }

    getMemoryCache() {
        // Return default cache (no filters)
        const cached = this.memoryCacheMap.get('all-all-all-empty');
        if (cached && (Date.now() - cached.timestamp < 300000)) {
            return cached.data;
        }
        return null;
    }

    clearCache() {
        this.memoryCacheMap.clear();
    }

    // Disk cache (deprecated for initial load, kept for backup fallback?)
    // User wants: First load = shimmer. Tab switch = cache.
    // So distinct from 'legacy disk cache' which persists across app restarts.
    async getCachedServers() {
        if (!this.store) return [];
        return (await this.store.get(STORE_KEY)) || [];
    }

    async getCategories() {
        if (window.electronAPI && window.electronAPI.getDiscoverCategories) {
            try {
                return await window.electronAPI.getDiscoverCategories();
            } catch (e) {
                console.error('[Discovery] Failed to fetch categories', e);
            }
        }
        return { categories: [] };
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

    async createServer(ip) {
        if (window.electronAPI && window.electronAPI.createServer) {
            try {
                return await window.electronAPI.createServer({ ip });
            } catch (e) {
                console.error('[Discovery] Failed to create server', e);
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'IPC Unavailable' };
    }

    async verifyServer(ownerUuid, verificationCode) {
        if (window.electronAPI && window.electronAPI.verifyServer) {
            try {
                return await window.electronAPI.verifyServer({ ownerUuid, verificationCode });
            } catch (e) {
                console.error('[Discovery] Failed to verify server', e);
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'IPC Unavailable' };
    }

    async voteServer(serverId, voterUuid, verificationString) {
        if (window.electronAPI && window.electronAPI.voteServer) {
            try {
                return await window.electronAPI.voteServer({ serverId, voterUuid, verificationString });
            } catch (e) {
                console.error('[Discovery] Failed to vote server', e);
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'IPC Unavailable' };
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

    async fetchServers(offset = 0, limit = 9, category = 'all', version = null, language = null, query = null, isOfflineAccount = false, signal = null) {
        // Create cache key based on filter combination
        const cacheKey = `${category}-${version || 'all'}-${language || 'all'}-${query || 'empty'}`;

        // Check cache (5 min TTL) for first page only
        if (offset === 0 && !isOfflineAccount) {
            const cached = this.memoryCacheMap.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < 300000)) {
                console.log('[DiscoveryService] Using cached servers for:', cacheKey);
                return cached.data;
            }
        }

        if (window.electronAPI && window.electronAPI.getDiscoverServers) {
            try {
                const res = await window.electronAPI.getDiscoverServers({ offset, limit, category, version, language, query, isOfflineAccount });
                console.log('[DiscoveryService] Raw IPC Response:', res);

                // Filter out junk/placeholder servers immediately
                const rawServers = res.servers || (Array.isArray(res) ? res : []);
                const validServers = rawServers.filter(s =>
                    s &&
                    s.name && s.name !== 'unknown' &&
                    s.ip && s.ip !== 'unknown'
                );

                const cleanedRes = Array.isArray(res) ? validServers : { ...res, servers: validServers };

                // Update cache for first page
                if (offset === 0 && cleanedRes && !isOfflineAccount) {
                    this.memoryCacheMap.set(cacheKey, {
                        data: cleanedRes,
                        timestamp: Date.now()
                    });

                    // Limit cache size to 20 entries (prevent memory bloat)
                    if (this.memoryCacheMap.size > 20) {
                        const firstKey = this.memoryCacheMap.keys().next().value;
                        this.memoryCacheMap.delete(firstKey);
                    }
                }

                return cleanedRes;
            } catch (e) {
                console.error('[Discovery] Failed to fetch servers via IPC', e);
            }
        }
        return { servers: [], hasMore: false };
    }
}

export const discovery = new DiscoveryService();
