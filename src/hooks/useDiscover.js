
import { useState, useEffect, useCallback, useMemo } from 'react';
import { discovery } from '../services/DiscoveryService';
import { useToast } from '../contexts/ToastContext';

export const useDiscover = () => {
    const { addToast } = useToast();

    // State
    const [servers, setServers] = useState(() => discovery.getMemoryCache() || []);
    const [loading, setLoading] = useState(() => !discovery.getMemoryCache());
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [query, setQuery] = useState("");
    const [metadata, setMetadata] = useState({ categories: [], versions: [], languages: [] });
    const [activeFilters, setActiveFilters] = useState({ category: 'all', version: '', language: '' });

    // Logging helper
    const log = useCallback((msg, data) => {
        if (window.electronAPI && window.electronAPI.log) {
            try {
                const dataStr = data ? JSON.stringify(data) : "";
                window.electronAPI.log("info", `[DiscoverView] ${msg} ${dataStr}`);
            } catch (e) { /* ignore */ }
        }
    }, []);

    // Load Servers
    const loadServers = useCallback(
        async (isInitial = false) => {
            log(`loadServers called. isInitial=${isInitial}`);

            if (isInitial) {
                // If clean, check MEMORY cache (instant tab switch)
                const isClean = !query && activeFilters.category === 'all' && !activeFilters.version && !activeFilters.language;
                const cached = isClean ? discovery.getMemoryCache() : null;

                if (cached && cached.length > 0) {
                    setServers(cached);
                    setLoading(false);
                } else {
                    setLoading(true);
                }
            } else {
                setLoadingMore(true);
            }

            try {
                const offset = isInitial ? 0 : servers.length;
                const { category, version, language } = activeFilters;

                const data = await discovery.fetchServers(offset, 36, category, version, language, query);

                if (data && (data.success || Array.isArray(data.servers) || Array.isArray(data))) {
                    const newServers = data.servers || (Array.isArray(data) ? data : []);
                    if (isInitial) setServers(newServers);
                    else setServers((prev) => [...prev, ...newServers]);

                    setHasMore(data.hasMore === undefined ? false : data.hasMore);
                }
            } catch (err) {
                log("Failed to load discover servers", err);
                addToast("Failed to load servers", "error");
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [addToast, servers.length, activeFilters, query, log]
    );

    // Initial Metadata Fetch
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const cached = localStorage.getItem('discover_metadata');
                if (cached) setMetadata(JSON.parse(cached));

                const data = await discovery.getMetadata();
                if (data) {
                    setMetadata({
                        categories: data.categories || [],
                        versions: data.versions || [],
                        languages: data.languages || []
                    });
                    localStorage.setItem('discover_metadata', JSON.stringify(data));
                }
            } catch (e) {
                console.error("Failed to load metadata", e);
            }
        };
        fetchMeta();
    }, []);

    // Debounce search/filter
    useEffect(() => {
        const timer = setTimeout(() => {
            loadServers(true);
        }, 600);
        return () => clearTimeout(timer);
    }, [query, activeFilters, loadServers]);

    // Derived Sections
    const sections = useMemo(() => {
        return {
            hero: servers.find(s => s.uiSection === 'hero'),
            subFeatured: servers.filter(s => s.uiSection === 'subFeatured'),
            trending: servers.filter(s => s.uiSection === 'trending'),
            featuredCorp: servers.filter(s => s.uiSection === 'featured_corp'),
            list: servers.filter(s => !s.uiSection || s.uiSection === 'list')
        };
    }, [servers]);

    // Actions
    const handleJoin = useCallback((serverIp) => {
        addToast(`Join not yet wired. Copying ${serverIp}...`, "info");
        navigator.clipboard.writeText(serverIp);
        addToast("IP copied — paste in Multiplayer", "success");
    }, [addToast]);

    const handleCopy = useCallback((serverIp) => {
        navigator.clipboard.writeText(serverIp);
        addToast("IP copied to clipboard!", "success");
    }, [addToast]);

    return {
        servers,
        loading,
        loadingMore,
        hasMore,
        query,
        setQuery,
        activeFilters,
        setActiveFilters,
        metadata,
        sections,
        loadServers,
        handleJoin,
        handleCopy
    };
};
