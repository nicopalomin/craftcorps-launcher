
import React from 'react';
import { Crown, Zap, Copy } from 'lucide-react';
import { getGradient, toInt } from './utils';
import ServerBadge from './ServerBadge';

const HeroServerBanner = React.memo(({ server, onJoin, onCopy }) => {
    const gradient = getGradient(server.ip);
    const players = toInt(server.players);
    const isHot = players >= 1500;

    return (
        <div className="relative w-full h-[400px] rounded-3xl overflow-hidden group shrink-0 mb-8 border border-white/10 shadow-2xl shadow-black/50">
            {/* Backgrounds */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-20`} />
            {server.icon && (
                <img src={server.icon} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110" alt="" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

            {/* Status Badges */}
            <ServerBadge server={server} isHot={isHot} />

            {/* Content */}
            <div className="absolute inset-0 p-10 flex flex-col justify-end items-start md:items-end md:flex-row md:justify-between gap-6">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-full bg-amber-500 text-amber-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <Crown size={12} /> Most Popular
                        </span>
                        <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-emerald-400 font-mono text-xs flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {players.toLocaleString()} online
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight drop-shadow-lg truncate w-full">
                        {server.ip}
                    </h1>

                    <div className="text-slate-300 text-lg max-w-2xl line-clamp-2 md:line-clamp-3 mb-6" dangerouslySetInnerHTML={{ __html: typeof server.motd === 'string' ? server.motd : String(server.motd || "") }} />

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onJoin(server.ip)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            <Zap size={18} fill="currentColor" />
                            Join Server
                        </button>
                        <button
                            onClick={() => onCopy(server.ip)}
                            className="bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-3.5 rounded-xl backdrop-blur-md transition-colors border border-white/5"
                            title="Copy IP"
                        >
                            <Copy size={18} />
                        </button>
                    </div>
                </div>

                {/* Visual Icon (Large) */}
                <div className="hidden md:block shrink-0">
                    <div className="w-32 h-32 rounded-3xl bg-slate-900 border-2 border-white/10 shadow-2xl p-1 overflow-hidden rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        {server.icon ? (
                            <img src={server.icon} alt="" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default HeroServerBanner;
