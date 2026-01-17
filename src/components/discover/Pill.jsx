
import React from 'react';

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

export default Pill;
