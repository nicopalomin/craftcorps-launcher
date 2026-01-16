import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Star,
    Users,
    Zap,
    Search,
    Server,
    Wifi,
    Flame,
    Sparkles,
    Crown,
    ArrowRight,
    Clock,
    MoreHorizontal,
    Copy,
} from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { telemetry } from "../services/TelemetryService";

// Helper to generate a consistent gradient based on string
const getGradient = (str) => {
    const hash = str
        .split("")
        .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = [
        "from-amber-400 to-orange-600",
        "from-emerald-400 to-teal-600",
        "from-purple-400 to-indigo-600",
        "from-blue-400 to-cyan-600",
        "from-red-400 to-pink-600",
        "from-indigo-400 to-violet-600",
    ];
    return colors[Math.abs(hash) % colors.length];
};

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const toInt = (v) => {
    const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
};

const scoreServer = (s) => {
    // Business-first “attention” scoring: momentum + size + CTR-ish proxy.
    // No backend needed: we approximate with what you already have.
    const players = toInt(s.players);
    const views = toInt(s.views); // if you ever have it; otherwise 0
    const joins = toInt(s.joins); // if you ever have it; otherwise 0
    const copies = toInt(s.copies); // if you ever have it; otherwise 0
    const votes = toInt(s.votes); // if you ever have it; otherwise 0
    const ageDays = toInt(s.ageDays); // if you ever have it; otherwise 0

    const intent = joins * 1.0 + copies * 0.35;
    const ctr = (intent + 5) / (Math.max(views, 1) + 200);
    const momentum = Math.log1p(votes) * 0.25 + Math.log1p(intent) * 0.6;
    const size = Math.log1p(players) * 0.55;

    // fresh-ish boost, but capped
    const ageBoost = Math.exp(-clamp(ageDays, 0, 60) / 14);
    const freshness = 0.2 * ageBoost;

    return (momentum + size + freshness) * (0.75 + 0.75 * clamp(ctr, 0, 1));
};

const Pill = ({ icon: Icon, text, tone = "neutral" }) => {
    const toneCls =
        tone === "hot"
            ? "bg-orange-500/10 border-orange-500/20 text-orange-200"
            : tone === "live"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
                : tone === "premium"
                    ? "bg-violet-500/10 border-violet-500/20 text-violet-200"
                    : "bg-slate-800/60 border-white/10 text-slate-300";

    return (
        <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${toneCls}`}
        >
            {Icon ? <Icon size={14} className="opacity-90" /> : null}
            {text}
        </div>
    );
};

const SectionHeader = ({ icon: Icon, title, subtitle, right }) => (
    <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                {Icon ? <Icon size={18} className="text-slate-200" /> : null}
            </div>
            <div>
                <div className="text-white font-bold text-lg tracking-tight">{title}</div>
                {subtitle ? <div className="text-slate-400 text-sm">{subtitle}</div> : null}
            </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
    </div>
);

const ServerCard = ({
    server,
    variant = "standard", // standard | big | featured
    onJoin,
    onCopy,
}) => {
    const gradient = getGradient(server.ip);
    const players = toInt(server.players);

    const base =
        variant === "big"
            ? "rounded-3xl"
            : variant === "featured"
                ? "rounded-3xl ring-1 ring-violet-500/20"
                : "rounded-2xl";

    const pad = variant === "big" || variant === "featured" ? "p-7" : "p-6";
    const bannerH = variant === "big" || variant === "featured" ? "h-[96px]" : "h-[80px]";
    const iconSize = variant === "big" || variant === "featured" ? "w-16 h-16" : "w-14 h-14";
    const titleSize = variant === "big" || variant === "featured" ? "text-2xl" : "text-xl";

    // “Alive” signals (cheap but effective)
    const isHot = players >= 1500;
    const isLive = players > 0;

    return (
        <div
            className={`group bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-white/10 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20 flex flex-col ${base}`}
        >
            {/* Banner */}
            <div className={`${bannerH} bg-slate-900 relative overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-20`} />
                {server.icon ? (
                    <img
                        src={server.icon}
                        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-150"
                        alt=""
                    />
                ) : null}

                <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
                    {isHot ? (
                        <div className="bg-black/40 backdrop-blur-md text-orange-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                            <Flame size={12} className="text-orange-300" />
                            Trending
                        </div>
                    ) : null}

                    <div className="bg-black/40 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                        <Users size={12} className={isLive ? "text-emerald-400" : "text-slate-400"} />
                        {players.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={`${pad} pt-10 relative flex-1 flex flex-col`}>
                {/* Icon */}
                <div
                    className={`absolute -top-8 left-6 ${iconSize} rounded-2xl bg-slate-800 p-1 shadow-lg border border-slate-700 group-hover:scale-105 transition-transform duration-300`}
                >
                    {server.icon ? (
                        <img src={server.icon} alt={server.name} className="w-full h-full rounded-xl" />
                    ) : (
                        <div
                            className={`w-full h-full rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}
                        >
                            <Server className="text-white/50" />
                        </div>
                    )}
                </div>

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className={`${titleSize} font-bold text-white mb-1 mt-2 truncate`}>
                            {server.ip}
                        </h3>

                        {/* Minimal metadata: keep it calm */}
                        <div className="flex items-center gap-2 mb-4">
                            {server.version ? (
                                <span className="text-xs font-mono text-slate-400 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/50">
                                    {server.version}
                                </span>
                            ) : null}

                            {/* Optional pills you can wire later */}
                            {server.verified ? <Pill icon={Wifi} text="Verified" tone="live" /> : null}
                            {server.featured ? <Pill icon={Crown} text="Featured" tone="premium" /> : null}
                        </div>
                    </div>

                    {/* Overflow */}
                    <button
                        className="shrink-0 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center justify-center transition"
                        title="More"
                        onClick={() => onCopy(server.ip)}
                    >
                        <MoreHorizontal size={18} />
                    </button>
                </div>

                <div
                    className={`text-slate-300/80 text-sm mb-6 line-clamp-2 min-h-[40px] [&>span]:text-slate-200 ${variant === "featured" ? "line-clamp-3" : ""
                        }`}
                    dangerouslySetInnerHTML={{ __html: server.motd || "No description available." }}
                />

                <div className="flex-1" />

                {/* Primary action = JOIN */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onJoin(server.ip)}
                        className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/22 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-200 font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        <Zap size={16} className="opacity-95" />
                        Join
                        <ArrowRight size={16} className="opacity-80" />
                    </button>

                    {/* Secondary = copy */}
                    <button
                        onClick={() => onCopy(server.ip)}
                        className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center justify-center transition"
                        title="Copy IP"
                    >
                        <Copy size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const DiscoverView = () => {
    const { addToast } = useToast();

    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [query, setQuery] = useState("");

    const log = (msg, data) => {
        if (window.electronAPI && window.electronAPI.log) {
            try {
                const dataStr = data ? JSON.stringify(data) : "";
                window.electronAPI.log("info", `[DiscoverView] ${msg} ${dataStr}`);
            } catch (e) {
                /* ignore */
            }
        }
    };

    const loadServers = useCallback(
        async (isInitial = false) => {
            log(`loadServers called. isInitial=${isInitial}`);

            if (isInitial) {
                const cached = await telemetry.getCachedDiscoverServers();
                log("Cached servers:", cached?.length || "None");
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
                const data = await telemetry.fetchDiscoverServers(offset, 18); // pull more so we can build sections

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
        [addToast, servers.length]
    );

    useEffect(() => {
        loadServers(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleJoin = (serverIp) => {
        // Business-first: “Join” is primary. Even if not implemented, you should behave like it is.
        addToast(`Join not yet wired. Copying ${serverIp}...`, "info");
        navigator.clipboard.writeText(serverIp);
        addToast("IP copied — paste in Multiplayer", "success");
    };

    const handleCopy = (serverIp) => {
        navigator.clipboard.writeText(serverIp);
        addToast("IP copied to clipboard!", "success");
    };

    // --- Build attention-first sections (no backend dependencies) ---
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return servers;

        return servers.filter((s) => {
            const ip = String(s.ip || "").toLowerCase();
            const motd = String(s.motd || "").toLowerCase();
            const ver = String(s.version || "").toLowerCase();
            return ip.includes(q) || motd.includes(q) || ver.includes(q);
        });
    }, [servers, query]);

    const ranked = useMemo(() => {
        const copy = [...filtered];
        copy.sort((a, b) => scoreServer(b) - scoreServer(a));
        return copy;
    }, [filtered]);

    const sections = useMemo(() => {
        // In production you’ll likely compute these on backend.
        // Here: derive from player count + rank.
        const top = ranked.slice(0, 5);
        const trending = [...ranked]
            .sort((a, b) => toInt(b.players) - toInt(a.players))
            .slice(0, 5);

        // Featured mock: pretend some are featured (or use server.featured if present)
        const featured = ranked
            .filter((s) => !!s.featured)
            .slice(0, 3);

        // Fallback if none are flagged:
        const featuredFallback =
            featured.length > 0 ? featured : ranked.slice(0, 3);

        const explore = ranked.slice(5);

        return { top, trending, featured: featuredFallback, explore };
    }, [ranked]);

    return (
        <div className="flex-1 bg-slate-900 overflow-hidden relative flex flex-col select-none">
            {/* Header */}
            <div className="relative z-10 p-8 pb-4 shrink-0">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center ring-1 ring-emerald-500/30">
                            <Star size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">
                                Discover Servers
                            </h1>
                            <p className="text-slate-400">
                                Pick something alive. Join in one click.
                            </p>
                        </div>
                    </div>

                    {/* Right: Search + Status */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search servers..."
                                className="w-[300px] bg-slate-800/60 border border-white/10 focus:border-white/20 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-200 outline-none"
                            />
                        </div>

                        <div className="bg-slate-800/50 px-4 py-2 rounded-full border border-white/5 flex items-center gap-2 text-sm text-slate-400">
                            <div
                                className={`w-2 h-2 rounded-full ${loading
                                        ? "bg-amber-500 animate-pulse"
                                        : servers.length > 0
                                            ? "bg-emerald-500"
                                            : "bg-red-500"
                                    }`}
                            />
                            {loading
                                ? "Scanning..."
                                : servers.length > 0
                                    ? `${servers.length} listed`
                                    : "No servers"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
                {loading ? (
                    <div className="max-w-7xl mx-auto space-y-8 pb-16">
                        <div className="h-10 w-64 bg-slate-800/50 rounded-2xl animate-pulse" />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-80 bg-slate-800/50 rounded-3xl animate-pulse" />
                            ))}
                        </div>
                        <div className="h-10 w-56 bg-slate-800/50 rounded-2xl animate-pulse" />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto pb-20 space-y-10">
                        {/* RECENT (mock) */}
                        {/* If you have real "recently joined", show 1–2 cards here only. */}
                        {/* <SectionHeader icon={Clock} title="Continue playing" subtitle="Recently joined" /> */}

                        {/* Recommended for you */}
                        <div className="space-y-5">
                            <SectionHeader
                                icon={Sparkles}
                                title="Recommended for you"
                                subtitle="Fast picks that are active right now."
                                right={<Pill icon={Wifi} text="Live ordering" tone="live" />}
                            />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {sections.top.slice(0, 4).map((server, idx) => (
                                    <ServerCard
                                        key={`top-${server.ip}-${idx}`}
                                        server={server}
                                        variant="big"
                                        onJoin={handleJoin}
                                        onCopy={handleCopy}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Trending Now */}
                        <div className="space-y-5">
                            <SectionHeader
                                icon={Flame}
                                title="Trending now"
                                subtitle="Where players are piling in."
                                right={<Pill icon={Users} text="Momentum" tone="hot" />}
                            />

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {sections.trending.slice(0, 6).map((server, idx) => (
                                    <ServerCard
                                        key={`trend-${server.ip}-${idx}`}
                                        server={server}
                                        variant="standard"
                                        onJoin={handleJoin}
                                        onCopy={handleCopy}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Featured (paid) */}
                        <div className="space-y-5">
                            <SectionHeader
                                icon={Crown}
                                title="Featured"
                                subtitle="Sponsored placements (still must be online)."
                                right={<Pill icon={Crown} text="Sponsored" tone="premium" />}
                            />

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {sections.featured.slice(0, 3).map((server, idx) => (
                                    <ServerCard
                                        key={`feat-${server.ip}-${idx}`}
                                        server={{ ...server, featured: true }}
                                        variant="featured"
                                        onJoin={handleJoin}
                                        onCopy={handleCopy}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Explore more (long tail) */}
                        <div className="space-y-5">
                            <SectionHeader
                                icon={Server}
                                title="Explore more"
                                subtitle="More servers — use search if you know what you want."
                                right={
                                    hasMore ? (
                                        <button
                                            onClick={() => loadServers(false)}
                                            disabled={loadingMore}
                                            className="px-5 py-2.5 bg-slate-800/70 hover:bg-slate-700/70 text-white font-medium rounded-xl border border-white/10 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {loadingMore ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Loading...
                                                </>
                                            ) : (
                                                "Load more"
                                            )}
                                        </button>
                                    ) : (
                                        <div className="text-slate-500 text-sm">End of list.</div>
                                    )
                                }
                            />

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {sections.explore.slice(0, 12).map((server, idx) => (
                                    <ServerCard
                                        key={`explore-${server.ip}-${idx}`}
                                        server={server}
                                        variant="standard"
                                        onJoin={handleJoin}
                                        onCopy={handleCopy}
                                    />
                                ))}
                            </div>

                            {!hasMore ? (
                                <div className="text-center text-slate-600 text-sm pt-6">
                                    You&apos;ve reached the end of the void.
                                </div>
                            ) : null}

                            {/* Quiet owner entry point (non-distracting) */}
                            <div className="pt-8 flex justify-center">
                                <button
                                    className="text-slate-500 hover:text-slate-300 text-sm transition underline underline-offset-4"
                                    onClick={() => addToast("Publish flow not wired (UI stub).", "info")}
                                >
                                    Are you a server owner? Get listed
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiscoverView;
