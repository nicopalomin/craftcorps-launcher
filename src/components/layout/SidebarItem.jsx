import React from 'react';

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed, fill = "none" }) => {
    // Determine the effective fill: full opacity when active, lower when inactive
    const effectiveFill = fill !== 'none' ? (active ? fill : `${fill}40`) : 'none';

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center pl-3.5 pr-4 py-3 rounded-xl transition-all duration-300 ease-out group relative ${active
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
            title={collapsed ? label : undefined}
        >
            <Icon
                size={22}
                fill={effectiveFill}
                stroke={active ? "#000000" : (fill !== 'none' ? fill : 'currentColor')}
                strokeWidth={active ? 1.8 : 1.5}
                className={`shrink-0 transition-all duration-300 ${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'}`}
            />
            <span className={`font-medium text-sm pointer-events-none whitespace-nowrap overflow-hidden transition-all duration-500 ease-out ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-3'}`}>
                {label}
            </span>
            {/* Active Indicator */}
            <div className={`bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)] ml-auto transition-all duration-500 ease-out ${active && !collapsed ? 'w-1.5 h-1.5 opacity-100' : 'w-0 h-0 opacity-0'}`} />
        </button>
    );
};

export default SidebarItem;
