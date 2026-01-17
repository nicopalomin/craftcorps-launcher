
import React from 'react';
import { Users, Server, Crown, Wifi, Zap, ArrowRight, Copy, MoreHorizontal } from 'lucide-react';
import { getGradient, toInt } from './utils';
import ServerBadge from './ServerBadge';
import Pill from './Pill';

const ServerCard = React.memo(({
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
                    dangerouslySetInnerHTML={{ __html: (typeof server.motd === 'string' ? server.motd : String(server.motd || "")) || "No description available." }}
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
});

export default ServerCard;
