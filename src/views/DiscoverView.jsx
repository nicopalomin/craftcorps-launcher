import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Star, Users, Zap, Search, Server, Wifi } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { telemetry } from '../services/TelemetryService';

// Helper to generate a consistent gradient based on string
const getGradient = (str) => {
    const hash = str.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = [
        "from-amber-400 to-orange-600",
        "from-emerald-400 to-teal-600",
        "from-purple-400 to-indigo-600",
        "from-blue-400 to-cyan-600",
        "from-red-400 to-pink-600",
        "from-indigo-400 to-violet-600"
    ];
    return colors[Math.abs(hash) % colors.length];
};

const ServerCard = React.memo(({ server, index, handleJoin, getGradient }) => {
    const gradient = getGradient(server.ip);
    return (
        <div
            className="group bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20 flex flex-col transform-gpu will-change-transform"
        >
            {/* Banner Area (Generated or Icon Blur) */}
            <div className="h-[80px] bg-slate-900 relative overflow-hidden transition-all duration-300">
                <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-20`} />

                {/* Icon as huge blur BG */}
                {server.icon && (
                    <img
                        src={server.icon}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-150 transform-gpu"
                        alt=""
                    />
                )}

                <div className="absolute top-4 right-4 z-30 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1.5 border border-white/10 shadow-lg">
                    <Users size={12} className="text-emerald-400" />
                    {parseInt(server.players).toLocaleString()}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 pt-10 relative flex-1 flex flex-col">
                {/* Main Icon - Floating */}
                <div className="absolute -top-8 left-6 w-16 h-16 rounded-2xl bg-slate-800 p-1 shadow-lg border border-slate-700 group-hover:scale-110 transition-transform duration-300 transform-gpu">
                    {server.icon ? (
                        <img src={server.icon} alt={server.name} loading="lazy" decoding="async" className="w-full h-full rounded-xl" />
                    ) : (
                        <div className={`w-full h-full rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                            <Server className="text-white/50" />
                        </div>
                    )}
                </div>

                <h3 className="text-xl font-bold text-white mb-1 mt-2 truncate">
                    {server.ip}
                </h3>
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-mono text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/50">
                        {server.version || 'Unknown'}
                    </span>
                    {server.software && (
                        <span className="text-xs text-slate-500 truncate max-w-[150px]">
                            {server.software}
                        </span>
                    )}
                </div>

                <div
                    className="text-slate-400 text-sm mb-6 line-clamp-2 min-h-[40px] [&>span]:text-slate-300"
                    dangerouslySetInnerHTML={{ __html: server.motd || 'No description available.' }}
                />

                {/* Spacer to push button down */}
                <div className="flex-1" />

                {/* Join Button */}
                <button
                    onClick={() => handleJoin(server.ip)}
                    className="w-full bg-white/5 hover:bg-white/10 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group/btn"
                >
                    <Zap size={16} className="group-hover/btn:fill-emerald-400 transition-colors" />
                    Copy IP
                </button>
            </div>
        </div>
    );
});

const DiscoverView = () => {
    const { addToast } = useToast();
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const log = (msg, data) => {
        // console.log(msg, data || '');
        if (window.electronAPI && window.electronAPI.log) {
            try {
                const dataStr = data ? JSON.stringify(data) : '';
                window.electronAPI.log('info', `[DiscoverView] ${msg} ${dataStr}`);
            } catch (e) { /* ignore */ }
        }
    };

    const loadServers = useCallback(async (isInitial = false) => {
        log(`loadServers called. isInitial=${isInitial}`);
        if (isInitial) {
            // Try load cache first for instant render
            const cached = await telemetry.getCachedDiscoverServers();
            log('Cached servers:', cached?.length || 'None');
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
            const data = await telemetry.fetchDiscoverServers(offset, 9);


            if (data && (data.success || Array.isArray(data.servers) || Array.isArray(data))) {
                // Normalize for safety
                const newServers = data.servers || (Array.isArray(data) ? data : []);

                if (isInitial) {
                    setServers(newServers);
                } else {
                    setServers(prev => [...prev, ...newServers]);
                }
                setHasMore(data.hasMore === undefined ? false : data.hasMore);
            }
        } catch (err) {
            log('Failed to load discover servers', err);
            addToast("Failed to load servers", "error");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [addToast, servers.length]);

    useEffect(() => {
        loadServers(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleJoin = useCallback((serverIp) => {
        addToast(`Joining ${serverIp} is not yet implemented directly! Copying IP...`, "info");
        navigator.clipboard.writeText(serverIp);
        addToast("IP copied to clipboard!", "success");
    }, [addToast]);

    return (
        <div className="flex-1 bg-slate-900 overflow-hidden relative flex flex-col select-none">

            {/* Header Section */}
            <div className="relative z-10 p-8 pb-4 shrink-0">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center ring-1 ring-emerald-500/30">
                            <Star size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Discover Servers</h1>
                            <p className="text-slate-400">Top Minecraft servers, updated live.</p>
                        </div>
                    </div>
                    {/* Stats Pill */}
                    <div className="bg-slate-800/50 px-4 py-2 rounded-full border border-white/5 flex items-center gap-2 text-sm text-slate-400">
                        <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : (servers.length > 0 ? 'bg-emerald-500' : 'bg-red-500')}`} />
                        {loading ? 'Scanning...' : (servers.length > 0 ? `${servers.length} Servers Listed` : 'No Servers Found')}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">

                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto pb-10">
                            {servers.map((server, index) => (
                                <ServerCard
                                    key={server.ip + index}
                                    server={server}
                                    index={index}
                                    handleJoin={handleJoin}
                                    getGradient={getGradient}
                                />
                            ))}
                        </div>

                        {/* Load More / End of List */}
                        <div className="flex justify-center pb-20">
                            {hasMore ? (
                                <button
                                    onClick={() => loadServers(false)}
                                    disabled={loadingMore}
                                    className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl border border-white/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {loadingMore ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More Servers'
                                    )}
                                </button>
                            ) : (
                                <div className="text-center text-slate-600 text-sm">
                                    You've reached the end of the void.
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DiscoverView;
