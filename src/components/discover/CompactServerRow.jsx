
import React from 'react';
import { Crown, BadgeCheck, Copy } from 'lucide-react';
import { getGradient, toInt } from './utils';

const CompactServerRow = React.memo(({ server, onJoin, onCopy, rank }) => {
    const players = toInt(server.players);

    // Status Flag Logic
    let status = { label: "Unverified", color: "bg-slate-900/80 text-slate-500 border-slate-700", icon: null };

    if (server.featured) {
        status = { label: "Featured", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: Crown };
    } else if (server.verified) {
        status = { label: "Verified", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: BadgeCheck };
    }

    const StatusIcon = status.icon;

    // Use content-visibility: auto to skip rendering off-screen (like virtual scrolling but automatic)
    return (
        <div
            className="group relative flex flex-col gap-2 p-4 rounded-xl bg-slate-800/20 hover:bg-slate-800/60 border border-transparent hover:border-white/5 transition-colors duration-200 overflow-hidden h-full"
        >
            {/* Corner Flag */}
            <div className={`absolute top-0 right-0 px-2.5 py-1 rounded-bl-xl border-b border-l text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${status.color} z-10 shadow-sm`}>
                {StatusIcon && <StatusIcon size={10} strokeWidth={3} />}
                {status.label}
            </div>

            {/* Header: Icon & Title & Stats */}
            <div className="flex items-center gap-3 w-full pr-16">
                <span className="text-slate-500 font-mono text-xs opacity-50 w-5 text-center shrink-0">#{rank}</span>

                <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0 overflow-hidden border border-white/5 shadow-md group-hover:shadow-lg transition-shadow">
                    {server.icon ? (
                        <img src={server.icon} alt="" className="w-full h-full object-cover" />
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
                                <span className="text-slate-500">{server.version}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* MOTD - Simplified regex exec by relying on safe stripped content which likely doesn't change often */}
            <div
                className="text-slate-500 text-xs leading-relaxed line-clamp-2 whitespace-normal h-8 w-full mt-1"
                dangerouslySetInnerHTML={{ __html: (typeof server.motd === 'string' ? server.motd : JSON.stringify(server.motd || "")).replace(/<[^>]*>/g, '') || 'Join now to start your adventure.' }}
            />

            {/* Actions (Overlay) */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 z-20">
                <button
                    onClick={() => onCopy(server.ip)}
                    className="p-1.5 bg-slate-900/90 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 rounded-md backdrop-blur-md shadow-lg transition-colors"
                    title="Copy IP"
                >
                    <Copy size={14} />
                </button>
                <button
                    onClick={() => onJoin(server.ip)}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-md shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-colors"
                >
                    Join
                </button>
            </div>
        </div>
    );
});

export default CompactServerRow;
