import React from 'react';

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center pl-3.5 pr-4 py-3 rounded-lg transition-all duration-500 ease-out group relative ${active
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
        title={collapsed ? label : undefined}
    >
        <Icon size={20} className={`shrink-0 transition-colors duration-500 ${active ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
        <span className={`font-medium text-sm pointer-events-none whitespace-nowrap overflow-hidden transition-all duration-500 ease-out ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-3'}`}>
            {label}
        </span>
        {/* Active Indicator */}
        <div className={`bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)] ml-auto transition-all duration-500 ease-out ${active && !collapsed ? 'w-1.5 h-1.5 opacity-100' : 'w-0 h-0 opacity-0'}`} />
    </button>
);

export default SidebarItem;
