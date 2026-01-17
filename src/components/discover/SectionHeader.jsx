
import React from 'react';

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

export default SectionHeader;
