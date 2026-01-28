
import React from 'react';
import { Users, Crown, BadgeCheck, Flame, Shield } from 'lucide-react';

const ServerBadge = React.memo(({ server, isHot }) => {
    // Determine priority status
    let type = "community";
    let icon = Users;
    let label = "Community";
    let colorClass = "bg-slate-700 text-slate-200 border-l-2 border-slate-500 shadow-[0_0_15px_rgba(71,85,105,0.4)]";

    if (server.official) {
        type = "official";
        icon = Shield;
        label = "Official Server";
        colorClass = "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.6)] border-l-2 border-emerald-300";
    } else if (server.featured) {
        type = "featured";
        icon = Crown;
        label = "Featured";
        colorClass = "bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)] border-l-2 border-yellow-300";
    } else if (server.source === 'MANUAL_SEED' || server.source === 'API_IMPORT') {
        type = "well-known";
        icon = BadgeCheck; // Or a Globe?
        label = "Well-Known";
        colorClass = "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.5)] border-l-2 border-violet-400";
    } else if (server.verified) {
        type = "verified";
        icon = BadgeCheck;
        label = "Verified";
        colorClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] border-l-2 border-blue-400";
    } else if (isHot) {
        type = "hot";
        icon = Flame;
        label = "Trending";
        colorClass = "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.5)] border-l-2 border-orange-300";
    }

    const Icon = icon;

    return (
        <div className="absolute top-6 right-0 z-30 filter drop-shadow-md">
            {/* The Badge Itself */}
            <div
                className={`relative h-9 pl-6 pr-4 flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${colorClass}`}
                style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)", // Swallowtail left
                }}
            >
                <div className="absolute left-[2px] top-0 bottom-0 w-[2px] bg-white/20" /> {/* Subtle pattern detail */}
                <Icon size={14} fill="currentColor" className="opacity-90" />
                <span>{label}</span>
            </div>
        </div>
    );
});

export default ServerBadge;
