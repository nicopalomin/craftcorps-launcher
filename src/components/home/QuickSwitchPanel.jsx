import React from 'react';
import { Plus, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// We'll reimplement the card inline for 'Compact' mode to avoid touching the main one extensively
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

const CompactInstanceItem = ({ instance, isSelected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`group relative flex items-center justify-center p-2 rounded-xl border transition-all duration-200 select-none w-14 h-14 ${isSelected
                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                }`}
        >
            <div className={`w-10 h-10 rounded-lg ${instance.icon ? 'bg-transparent' : instance.iconColor} flex items-center justify-center ${instance.glyphColor || 'text-slate-900'} overflow-hidden`}>
                {instance.icon ? (
                    <img src={instance.icon} alt={instance.name} className="w-full h-full object-cover" />
                ) : (
                    React.createElement(ICON_MAP[instance.iconKey] || Sprout, { size: 20 })
                )}
            </div>

            {/* Version Badge */}
            <div className="absolute -bottom-1 -right-1 bg-slate-900/90 text-[9px] font-bold text-slate-400 px-1 rounded-md border border-white/10 backdrop-blur-sm">
                {instance.version}
            </div>

            {/* Hover Tooltip - Left Side */}
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                <div className="bg-slate-900/90 backdrop-blur-md text-white text-sm font-medium px-3 py-1.5 rounded-lg border border-white/10 shadow-xl flex flex-col items-end">
                    <span>{instance.name}</span>
                    <span className="text-[10px] text-slate-400">{instance.loader}</span>
                </div>
            </div>
        </button>
    );
};

const QuickSwitchPanel = ({
    instances,
    selectedInstance,
    setSelectedInstance,
    onManageAll,
    onNewCrop,
    className = ""
}) => {
    const { t } = useTranslation();

    return (
        <div className={`flex flex-col p-2 rounded-2xl glass-spotlight shadow-2xl ${className}`}>

            {/* Scrollable Instance List - Max height for ~5 items (64px * 5 = 320px) */}
            <div className="flex flex-col gap-2 overflow-y-auto overflow-x-hidden max-h-[320px] custom-scrollbar no-scrollbar-buttons pr-0.5">
                {instances.map((instance) => (
                    <CompactInstanceItem
                        key={instance.id}
                        instance={instance}
                        isSelected={selectedInstance?.id === instance.id}
                        onClick={() => setSelectedInstance(instance)}
                    />
                ))}
            </div>

            <div className="h-px bg-white/5 mx-2 my-2" />

            {/* Static Actions Footer */}
            <div className="flex flex-col gap-2">
                <button
                    onClick={onNewCrop}
                    className="w-14 h-14 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 flex flex-col items-center justify-center transition-all group gap-1 shrink-0"
                    title={t ? t('home_new_crop') : 'New Crop'}
                >
                    <Plus size={20} className="text-slate-500 group-hover:text-emerald-400" />
                </button>
                <button
                    onClick={onManageAll}
                    className="w-14 h-10 rounded-xl border border-white/5 hover:bg-white/5 flex items-center justify-center transition-all group shrink-0"
                    title="Manage All"
                >
                    <Archive size={16} className="text-slate-600 group-hover:text-slate-300" />
                </button>
            </div>
        </div>
    );
};

export default QuickSwitchPanel;
