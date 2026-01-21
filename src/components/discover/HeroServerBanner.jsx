
import React from 'react';
import { Crown, Zap, Copy, Info, Loader2 } from 'lucide-react';
import { getGradient, toInt } from './utils';
import ServerBadge from './ServerBadge';

const HeroServerBanner = React.memo(({ server, onJoin, onCopy, onStop, isJoining = false, isPlaying = false, disabled = false }) => {
    const gradient = getGradient(server.ip);
    const players = toInt(server.players);
    const isHot = players >= 1500;

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
        <div className="relative w-full h-[400px] rounded-3xl overflow-hidden group shrink-0 mb-8 border border-white/10 shadow-2xl shadow-black/50 bg-slate-950">
            {/* Backgrounds */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-25`} />
            {server.icon && (
                <img src={server.icon} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110" alt="" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-slate-950/40" />

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
                            onClick={() => isPlaying ? onStop() : onJoin(server.ip, server)}
                            disabled={isJoining || disabled}
                            className={`
                                font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 group/btn
                                ${isPlaying
                                    ? 'bg-blue-500 text-white hover:bg-red-500 hover:text-white border-blue-400'
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                }
                            `}
                        >
                            {isJoining ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Launching...
                                </>
                            ) : isPlaying ? (
                                <>
                                    {/* Default State: Playing */}
                                    <span className="group-hover/btn:hidden flex items-center gap-2">
                                        <Zap size={18} fill="currentColor" />
                                        Currently Playing
                                    </span>
                                    {/* Hover State: Stop */}
                                    <span className="hidden group-hover/btn:flex items-center gap-2">
                                        <div className="w-4 h-4 bg-white rounded-sm" /> {/* Stop Icon */}
                                        Stop Game
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Zap size={18} fill="currentColor" />
                                    Join Server
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => onCopy(server.ip)}
                            className="bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-3.5 rounded-xl backdrop-blur-md transition-colors border border-white/5"
                            title="Copy IP"
                        >
                            <Copy size={18} />
                        </button>

                        {/* Info Tooltip */}
                        <div className="relative group/tooltip">
                            <button
                                className="bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-3.5 rounded-xl backdrop-blur-md transition-colors border border-white/5 cursor-help"
                                title="Server Info"
                            >
                                <Info size={18} />
                            </button>
                            {/* Tooltip Content - positioned ABOVE */}
                            <div className="invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 text-[10px] text-slate-300 rounded-xl border border-white/10 shadow-2xl z-50 flex flex-col gap-2 pointer-events-none">
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
                                {/* Little triangle pointer pointing down */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-white/10 rotate-45 transform"></div>
                            </div>
                        </div>
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
