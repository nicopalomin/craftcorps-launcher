import React from 'react';
import {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy
} from 'lucide-react';

const ICON_MAP = {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy
};

const QuickSelectCard = ({ instance, isSelected, onClick }) => (
    <button
        onClick={onClick}
        className={`focus:outline-none snap-center flex-shrink-0 w-48 p-3 rounded-xl border transition-all duration-200 text-left flex items-center gap-3 select-none ${isSelected
            ? 'bg-slate-800 border-emerald-500/50 ring-1 ring-emerald-500/20'
            : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
            }`}
    >
        <div className={`w-10 h-10 rounded-lg ${instance.icon ? 'bg-transparent' : instance.iconColor} flex items-center justify-center ${instance.glyphColor || 'text-slate-900'} shadow-md overflow-hidden`}>
            {instance.icon ? (
                <img src={instance.icon} alt={instance.name} className="w-full h-full object-cover" />
            ) : (
                React.createElement(ICON_MAP[instance.iconKey] || Sprout, { size: 20 })
            )}
        </div>
        <div className="min-w-0">
            <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>{instance.name}</h4>
            <p className="text-xs text-slate-600 truncate">{instance.version} • {instance.loader}</p>
        </div>
    </button>
);

export default QuickSelectCard;
