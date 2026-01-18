
import React from 'react';
import { Users, Server, Crown, Wifi, Zap, ArrowRight, Copy, Info, Loader2 } from 'lucide-react';
import { getGradient, toInt } from './utils';
import ServerBadge from './ServerBadge';
import Pill from './Pill';

const ServerCard = React.memo(({
    server,
    variant = "standard", // standard | big | featured
    onJoin,
    onCopy,
    isJoining = false,
    isPlaying = false,
    disabled = false
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

    // "Alive" signals (cheap but effective)
    const isHot = players >= 1500;
    const isLive = players > 0;

    // Helper to format versions
    const formatVersions = () => {
        if (server.versions && server.versions.length > 0) {
            if (server.versions.length > 4) {
                return `${server.versions[0]} - ${server.versions[server.versions.length - 1]}`;
            }
            return server.versions.join(', ');
        }
        return server.version || "Unknown";
    };

    return (
        <div
            className={`group bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-white/10 overflow-hidden transition-colors transition-shadow duration-300 hover:shadow-xl hover:shadow-black/20 flex flex-col ${base}`}
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

                {/* Status Banners */}
                <ServerBadge server={server} isHot={isHot} />

                {/* Player Count Overlay */}
                <div className="absolute bottom-2 right-2 z-20">
                    <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1.5 border border-white/10">
                        <Users size={10} className={isLive ? "text-emerald-400" : "text-slate-400"} />
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

                    {/* Info Tooltip */}
                    <div className="relative group/tooltip shrink-0">
                        <button
                            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center justify-center transition cursor-help"
                            title="Server Info"
                        >
                            <Info size={18} />
                        </button>
                        {/* Tooltip Content */}
                        <div className="invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all absolute top-full right-0 mt-2 w-48 p-3 bg-slate-900 text-[10px] text-slate-300 rounded-xl border border-white/10 shadow-2xl z-50 flex flex-col gap-2 pointer-events-none">
                            <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-0.5">
                                <span className="font-bold text-white uppercase tracking-wider">Server Info</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Platform</span>
                                <span className={`font-medium ${server.platform === 'Bedrock' ? 'text-green-400' : 'text-blue-400'}`}>
                                    {server.platform || 'Java'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Versions</span>
                                <span className="text-white bg-slate-800 px-1.5 py-0.5 rounded text-right leading-tight">
                                    {formatVersions()}
                                </span>
                            </div>
                            {/* Little triangle pointer */}
                            <div className="absolute -top-1 right-2 w-2 h-2 bg-slate-900 border-t border-l border-white/10 rotate-45 transform"></div>
                        </div>
                    </div>
                </div>

                <div
                    className={`text-slate-300/80 text-sm mb-6 line-clamp-2 min-h-[40px] [&>span]:text-slate-200 ${variant === "featured" ? "line-clamp-3" : ""
                        }`}
                    dangerouslySetInnerHTML={{ __html: (typeof server.motd === 'string' ? server.motd : String(server.motd || "")) || "No description available." }}
                />

                <div className="flex-1" />

                {/* Primary action = JOIN */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => isPlaying ? onStop() : onJoin(server.ip, server)}
                        disabled={isJoining || disabled}
                        className={`flex-1 font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group/btn
                            ${isPlaying
                                ? 'bg-blue-500/15 hover:bg-red-500/20 border border-blue-500/25 hover:border-red-500/40 text-blue-200 hover:text-red-200'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/22 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-200'
                            }`}
                    >
                        {isJoining ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Launching...
                            </>
                        ) : isPlaying ? (
                            <>
                                {/* Default Status */}
                                <span className="group-hover/btn:hidden flex items-center gap-2">
                                    <Zap size={16} className="opacity-95" />
                                    Playing
                                </span>
                                {/* Hover Status */}
                                <span className="hidden group-hover/btn:flex items-center gap-2">
                                    <div className="w-3 h-3 bg-current rounded-sm" />
                                    Stop
                                </span>
                            </>
                        ) : (
                            <>
                                <Zap size={16} className="opacity-95" />
                                Join
                                <ArrowRight size={16} className="opacity-80" />
                            </>
                        )}
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
});

export default ServerCard;
