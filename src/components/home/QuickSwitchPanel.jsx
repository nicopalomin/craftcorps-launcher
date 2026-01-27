import React from 'react';
import { Plus, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// We'll reimplement the card inline for 'Compact' mode to avoid touching the main one extensively
import InstanceIcon from '../common/InstanceIcon';

const CompactInstanceItem = React.memo(({ instance, isSelected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`group relative flex items-center justify-center p-1 rounded-lg border transition-all duration-200 select-none w-14 h-14 ${isSelected
                ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_10px_-2px_rgba(16,185,129,0.4)]'
                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                }`}
        >
            <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center">
                <InstanceIcon instance={instance} size={40} />
            </div>

            {/* Version Badge */}
            <div className="absolute -bottom-1 -right-1 bg-slate-900/95 text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded-md border border-white/10">
                {instance.version}
            </div>

            {/* Hover Tooltip - Top Side */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                <div className="bg-slate-900/95 text-white text-sm font-medium px-4 py-2 rounded-xl border border-white/10 shadow-xl flex flex-col items-center">
                    <span>{instance.name}</span>
                    <span className="text-[10px] text-slate-400">{instance.loader}</span>
                </div>
            </div>
        </button>
    );
});

const QuickSwitchPanel = React.memo(({
    instances,
    selectedInstance,
    setSelectedInstance,
    onManageAll,
    onNewCrop,
    className = ""
}) => {
    const { t } = useTranslation();

    return (
        <div className={`flex items-center gap-2 bg-black/5 backdrop-blur-md ${className}`}>
            <div className="flex flex-col gap-0.5 pr-8 shrink-0">
                <h4 className="text-xl font-bold text-white tracking-tight">{t('home_quick_switch')}</h4>
                <p className="text-sm text-slate-500 font-medium">Switch between your instances easily</p>
            </div>

            <div className="w-px h-10 bg-white/10 shrink-0 mr-4" />

            {/* Scrollable Instance List - Now Horizontal */}
            <div className="flex-1 flex flex-row gap-3 overflow-x-auto overflow-y-hidden custom-scrollbar no-scrollbar-buttons pb-1 px-2">
                {instances.map((instance) => (
                    <div key={instance.id} className="shrink-0">
                        <CompactInstanceItem
                            instance={instance}
                            isSelected={selectedInstance?.id === instance.id}
                            onClick={() => setSelectedInstance(instance)}
                        />
                    </div>
                ))}
            </div>

            <div className="w-px h-8 bg-white/10 shrink-0" />

            {/* New Crop Action Moved to End */}
            <button
                onClick={onNewCrop}
                className="w-14 h-14 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 flex flex-col items-center justify-center transition-all group gap-1 shrink-0"
                title={t ? t('home_new_crop') : 'New Crop'}
            >
                <Plus size={20} className="text-slate-500 group-hover:text-emerald-400" />
            </button>

            <div className="w-px h-8 bg-white/10 shrink-0" />

            {/* Manage All Button */}
            <button
                onClick={onManageAll}
                className="w-12 h-14 rounded-lg border border-white/5 hover:bg-white/5 flex items-center justify-center transition-all group shrink-0"
                title="Manage All"
            >
                <Archive size={18} className="text-slate-600 group-hover:text-slate-300" />
            </button>
        </div>
    );
});

export default QuickSwitchPanel;
