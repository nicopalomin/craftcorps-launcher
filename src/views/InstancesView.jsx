import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Sprout, Edit3, Trash2, Plus, GripVertical, Server, X, Play,
    Pickaxe, Axe, Sword, Shield, Box, Map, Compass, Flame, Snowflake, Droplet, Zap, Heart, Skull, Ghost, Trophy
} from 'lucide-react';
const ICON_MAP = {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy
};

const InstancesView = ({ instances, onEditCrop, onDeleteCrop, onSelectInstance, onNewCrop, onReorder }) => {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const { t } = useTranslation();
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredInstances = instances.filter(inst =>
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.loader.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e, index) => {
        e.preventDefault();
        if (draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverIndex(null);
        }
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDragOverIndex(null);
            return;
        }

        // Note: Reordering logic might need adjustment if filtering is active because indices won't match.
        // For simplicity, we disable drag-and-drop while searching if it gets complicated, 
        // OR we map dropIndex back to original index. 
        // Given the requirement is just "implement search", let's disable D&D visually or finding index when searching?
        // Actually, if filtered, drag and drop reordering becomes ambiguous (moving relative to what list?).
        // Let's just pass the filtered list to map, and if drag happens, we might need to find the REAL index.
        // Simpler: Disable drag and drop when filter is active.

        if (searchQuery) return;

        onReorder(draggedIndex, dropIndex);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div className="flex-1 overflow-y-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 select-none custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-200 mb-1">{t('instances_title')}</h2>
                    <p className="text-slate-400 text-sm">{t('instances_subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t('instances_search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg pl-4 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 w-64 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-800"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onNewCrop}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                        <Plus size={18} /> {t('instances_btn_new')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredInstances.map((inst, index) => (
                    <div
                        key={inst.id}
                        draggable={!searchQuery} // Disable drag when searching
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`group bg-slate-900 border rounded-xl p-6 transition-all relative overflow-hidden cursor-move flex flex-col h-full ${dragOverIndex === index && draggedIndex !== index
                            ? 'border-emerald-500 ring-2 ring-emerald-500/50 scale-105'
                            : 'border-slate-800 hover:border-slate-600'
                            }`}
                    >
                        {/* Drop indicator */}
                        {dragOverIndex === index && draggedIndex !== index && (
                            <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] z-20 flex items-center justify-center pointer-events-none">
                                <div className="text-emerald-400 font-bold text-sm bg-slate-900/80 px-3 py-1 rounded-full border border-emerald-500/50">
                                    {t('instances_drop_here')}
                                </div>
                            </div>
                        )}

                        {/* Drag Handle */}
                        <div className="absolute top-2 left-2 text-slate-600 group-hover:text-slate-400 transition-colors z-10">
                            <GripVertical size={16} />
                        </div>

                        <div className="flex gap-4 mb-5 relative z-10 flex-1">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-lg flex-shrink-0 ${inst.icon ? 'bg-transparent' : inst.iconColor} flex items-center justify-center ${inst.glyphColor || 'text-slate-900'} overflow-hidden shadow-inner`}>
                                {inst.icon ? (
                                    <img src={inst.icon} alt={inst.name} className="w-full h-full object-cover" />
                                ) : (
                                    React.createElement(ICON_MAP[inst.iconKey] || Sprout, { size: 24 })
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-slate-200 pr-2 text-base line-clamp-2 leading-tight break-words" title={inst.name}>{inst.name}</h3>

                                    {/* Actions */}
                                    <div className="flex gap-1 flex-shrink-0 -mt-1 -mr-1">
                                        <button
                                            onClick={() => onEditCrop(inst)}
                                            className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
                                            title={t('instances_edit')}
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDeleteCrop(inst.id)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                                            title={t('instances_delete')}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                        {inst.version}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 tracking-wider">
                                        {inst.loader}
                                    </span>
                                    {inst.autoConnect && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title={`Auto-connects to ${inst.serverAddress}`}>
                                            <Server size={10} />
                                            <span>{t('instances_server_badge')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => onSelectInstance(inst)}
                            className="w-[calc(100%+3rem)] -mx-6 -mb-6 py-3 bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-500 font-bold uppercase tracking-wider rounded-b-xl rounded-t-none text-xs transition-all duration-200 relative z-10 hover:shadow-lg active:scale-[0.98] active:bg-emerald-700 border-t border-slate-800/50 flex items-center justify-center gap-2"
                        >
                            <Play size={12} className="fill-current" /> {t('instances_btn_play')}
                        </button>
                        {/* Subtle Gradient BG */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${inst.bgGradient} opacity-10`} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InstancesView;
