
import React from 'react';
import { Crown, BadgeCheck, Copy, Info, Loader2 } from 'lucide-react';
import { getGradient, toInt } from './utils';

const CompactServerRow = React.memo(({ server, onJoin, onCopy, onStop, rank, isJoining = false, isPlaying = false, disabled = false }) => {
    const players = toInt(server.players);

    // Status Flag Logic
    let status = { label: "Unverified", color: "bg-slate-900/80 text-slate-500 border-slate-700", icon: null };

    if (server.featured) {
        status = { label: "Featured", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: Crown };
    } else if (server.verified) {
        status = { label: "Verified", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: BadgeCheck };
    }

    const StatusIcon = status.icon;

    // Helper to format versions
    const formatVersions = () => {
        if (server.versions && server.versions.length > 0) {
            // Sort just in case strings need numeric sort, but simple join is usually fine for display if backend sorts
            // If many versions, show range
            if (server.versions.length > 4) {
                return `${server.versions[0]} - ${server.versions[server.versions.length - 1]}`;
            }
            return server.versions.join(', ');
        }
        return server.version || "Unknown";
    };

    const [imgError, setImgError] = React.useState(false);
    const iconSrc = server.icon || `https://api.mcsrvstat.us/icon/${server.ip}`;

    return (
        <div
            className="group relative flex flex-col gap-2 p-4 rounded-xl bg-slate-800/20 hover:bg-slate-800/60 border border-transparent hover:border-white/5 transition-colors duration-200 h-full"
        >
            {/* Corner Flag */}
            <div className={`absolute top-0 right-0 px-2.5 py-1 rounded-bl-xl border-b border-l rounded-tr-xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${status.color} z-10 shadow-sm`}>
                {StatusIcon && <StatusIcon size={10} strokeWidth={3} />}
                {status.label}
            </div>

            {/* Header: Icon & Title & Stats */}
            <div className="flex items-center gap-3 w-full pr-16">
                <span className="text-slate-500 font-mono text-xs opacity-50 w-5 text-center shrink-0">#{rank}</span>

                <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0 overflow-hidden border border-white/5 shadow-md group-hover:shadow-lg transition-shadow">
                    {!imgError ? (
                        <img
                            src={iconSrc}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${getGradient(server.ip)}`} />
                    )}
                </div>

                <div className="min-w-0 flex flex-col">
                    <div className="text-white font-bold text-base truncate tracking-tight">{server.ip}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono leading-none mt-1">
                        <span className="text-emerald-400 font-bold">{players.toLocaleString()}</span> online
                        {server.version && (
                            <>
                                <span className="w-0.5 h-2 bg-slate-700 rounded-full"></span>
                                <span className="text-slate-500 max-w-[100px] truncate">{server.version}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* MOTD */}
            <div
                className="text-slate-500 text-xs leading-relaxed line-clamp-2 whitespace-normal h-8 w-full mt-1"
                dangerouslySetInnerHTML={{ __html: (typeof server.motd === 'string' ? server.motd : (server.motd ? JSON.stringify(server.motd) : "")).replace(/<[^>]*>/g, '') || 'Join now to start your adventure.' }}
            />

            {/* Actions (Overlay) */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 z-20">
                {/* Info Tooltip */}
                <div className="relative group/tooltip">
                    <button
                        className="p-1.5 bg-slate-900/90 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 rounded-md backdrop-blur-md shadow-lg transition-colors cursor-help"
                        title="Server Info"
                    >
                        <Info size={14} />
                    </button>
                    {/* Tooltip Content */}
                    <div className="invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-900 text-[10px] text-slate-300 rounded-xl border border-white/10 shadow-2xl z-50 flex flex-col gap-2 pointer-events-none">
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
                        <div className="absolute -bottom-1 right-2 w-2 h-2 bg-slate-900 border-b border-l border-white/10 rotate-45 transform"></div>
                    </div>
                </div>

                <button
                    onClick={() => onCopy(server.ip)}
                    className="p-1.5 bg-slate-900/90 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 rounded-md backdrop-blur-md shadow-lg transition-colors"
                    title="Copy IP"
                >
                    <Copy size={14} />
                </button>
                <button
                    onClick={() => isPlaying ? onStop() : onJoin(server.ip, server)}
                    disabled={isJoining || disabled}
                    className={`
                        px-3 py-1.5 text-[10px] font-bold rounded-md shadow-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-1.5 group/btn
                        ${isPlaying
                            ? 'bg-blue-600 hover:bg-red-500 text-white shadow-blue-900/20 hover:shadow-red-900/20'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                        }
                    `}
                >
                    {isJoining ? (
                        <>
                            <Loader2 size={10} className="animate-spin" />
                            Launching
                        </>
                    ) : isPlaying ? (
                        <>
                            <span className="group-hover/btn:hidden">Playing</span>
                            <span className="hidden group-hover/btn:inline">Stop</span>
                        </>
                    ) : (
                        'Join'
                    )}
                </button>
            </div>
        </div>
    );
});

export default CompactServerRow;
