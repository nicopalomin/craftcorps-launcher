
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { discovery } from '../services/DiscoveryService';
import { useToast } from '../contexts/ToastContext';
import AccountManager from '../utils/AccountManager';

export const useDiscover = (selectedInstance, activeAccount) => {
    const { addToast } = useToast();

    // State
    const [servers, setServers] = useState(() => discovery.getMemoryCache() || []);
    const [loading, setLoading] = useState(() => !discovery.getMemoryCache());
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [joiningServers, setJoiningServers] = useState(new Set()); // Track which servers are being joined
    const [showJoinProgress, setShowJoinProgress] = useState(null); // { serverIp, message, step }

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

    // Listen for smart join progress events
    useEffect(() => {
        if (!window.electronAPI) return;

        const handleProgress = (progressData) => {
            const { step, message, showPopup } = progressData;

            log('Smart join progress:', progressData);

            if (showPopup) {
                setShowJoinProgress({ message, step });
            }
        };

        // Listen for progress events
        window.electronAPI.on?.('smart-join-progress', handleProgress);

        return () => {
            window.electronAPI.removeListener?.('smart-join-progress', handleProgress);
        };
    }, [log]);

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

    const [playingServerIp, setPlayingServerIp] = useState(null);
    const isLaunchingRef = useRef(false);

    // Track active game status and errors
    useEffect(() => {
        if (!window.electronAPI) return;

        const handleExit = () => {
            log('Game exited, clearing playing state');
            setPlayingServerIp(null);
            // Ensure join progress is cleared
            setJoiningServers(new Set());
            setShowJoinProgress(null);
            isLaunchingRef.current = false;
        };

        const handleError = (err) => {
            log('Launch error received:', err);
            // Only toast if we initiated a launch via this hook
            if (isLaunchingRef.current) {
                addToast(`Launch Failed: ${err.summary || 'Unknown error'}`, 'error');
            }
            setPlayingServerIp(null);
            setJoiningServers(new Set());
            setShowJoinProgress(null);
            isLaunchingRef.current = false;
        }

        window.electronAPI.onGameExit(handleExit);
        window.electronAPI.onLaunchError(handleError);

        // Cleanup not possible without breaking other listeners (due to preload implementation), 
        // so we rely on React unmount and the fact that functions are lightweight.
    }, [log, addToast]);

    // Smart Join Handler
    const handleJoin = useCallback(async (serverIp, serverData) => {
        if (!window.electronAPI?.smartJoinServer) {
            addToast('Join functionality not available', 'error');
            return;
        }

        // Prevent multiple concurrent joins
        if (joiningServers.size > 0 || isLaunchingRef.current || playingServerIp) {
            addToast("You are already joining or playing a server.", "warning");
            return;
        }

        // Add to joining set
        setJoiningServers(prev => new Set(prev).add(serverIp));
        isLaunchingRef.current = true;

        try {
            log(`Starting smart join for ${serverIp}`);

            // Pass the current selected instance path if available
            const preferredInstancePath = selectedInstance ? selectedInstance.path : null;

            // Call smart join to find/create compatible instance
            const result = await window.electronAPI.smartJoinServer({
                serverIp,
                serverData: {
                    id: serverData?.id,
                    listPosition: servers.findIndex(s => s.ip === serverIp),
                    ...serverData
                },
                selectedInstancePath: preferredInstancePath
            });

            if (result.success && result.instance) {
                // Found compatible instance - launch using consistent account data!
                log(`Compatible instance found: ${result.instance.name}, launching...`);

                // Use AccountManager to build launch options (same as Play button)
                const launchOptions = await AccountManager.buildLaunchOptions(
                    result.instance,
                    (result.instance.maxRam || 4096) / 1024, // MB to GB
                    serverIp, // Auto-connect server
                    result.instance.javaPath || '',
                    activeAccount // Explicitly pass the active account
                );

                window.electronAPI.launchGame(launchOptions);

                // Show "Launching..." for 5 seconds more before showing "Currently Playing"
                await new Promise(r => setTimeout(r, 5000));

                // Only set playing if launch is still considered active (no error occurred)
                if (isLaunchingRef.current) {
                    setPlayingServerIp(serverIp);
                    addToast(`Launching ${serverIp}...`, 'success');
                }
                setShowJoinProgress(null);
            } else {
                // Show specific error message
                let errorMsg = 'Failed to join server';
                if (result.step === 'ping') errorMsg = 'Server is offline or unreachable';
                else if (result.step === 'create') errorMsg = 'Could not prepare game';
                else if (result.error) errorMsg = result.error;

                addToast(errorMsg, 'error');
                setShowJoinProgress(null);
                isLaunchingRef.current = false;
            }
        } catch (error) {
            log('Smart join error:', error);
            addToast(`Failed to join: ${error.message}`, 'error');
            setShowJoinProgress(null);
            isLaunchingRef.current = false;
        } finally {
            // Remove from joining set
            setJoiningServers(prev => {
                const newSet = new Set(prev);
                newSet.delete(serverIp);
                return newSet;
            });
        }
    }, [addToast, servers, log, joiningServers.size, playingServerIp, selectedInstance, activeAccount]); // Added dependencies

    const handleCopy = useCallback((serverIp) => {
        navigator.clipboard.writeText(serverIp);
        addToast("IP copied to clipboard!", "success");
    }, [addToast]);

    const handleStop = useCallback(() => {
        if (window.electronAPI && window.electronAPI.stopGame) {
            log('Stop game requested by user');
            window.electronAPI.stopGame();
            addToast("Stopping game...", "info");
        }
    }, [log, addToast]);

    const isBusy = joiningServers.size > 0 || playingServerIp !== null;

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
        handleCopy,
        handleStop,
        joiningServers,
        showJoinProgress,
        setShowJoinProgress,
        playingServerIp,
        isBusy
    };
};
