import React, { useState } from 'react';
import { Layers, RefreshCw, Plus, Search, Loader2, CheckCircle, X } from 'lucide-react';

const ResourcePacksList = ({
    resourcePacks,
    selectedInstance,
    isLoading,
    onRefresh,
    onAdd,
    onDelete,
    isDraggingGlobal,
    onDragOver,
    onDragLeave,
    onDrop,
    className = "h-[500px]"
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const isDragging = isDraggingGlobal;

    return (
        <div
            className={`bg-slate-900/40 border transition-colors rounded-3xl p-6 backdrop-blur-sm flex flex-col relative ${className} ${isDragging ? 'border-pink-500 bg-pink-500/10' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                            <Layers size={20} />
                        </div>
                        Resource Packs
                        <span className="text-xs font-medium bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
                            {isLoading ? '...' : (resourcePacks !== null ? resourcePacks.length : (selectedInstance.resourcePacks?.length || 0))}
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRefresh}
                            className={`p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Refresh Resource Packs"
                            disabled={isLoading}
                        >
                            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => onAdd(null)}
                            className="p-2 bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-900/20 hover:shadow-pink-500/30 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                            title="Add Resource Pack"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                {/* Resource Pack Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-500 group-focus-within:text-pink-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search resource packs..."
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500/50 focus:bg-slate-900/80 transition-all font-medium"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-3 flex items-center text-slate-600 hover:text-slate-300 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                        <Loader2 size={32} className="animate-spin text-pink-500" />
                        <span className="text-sm font-medium">Scanning packs...</span>
                    </div>
                ) : (
                    <>
                        {(() => {
                            const allPacks = resourcePacks !== null ? resourcePacks : (selectedInstance.resourcePacks || []);

                            // Search Filter Logic
                            const packs = searchQuery
                                ? allPacks.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                : allPacks;

                            return packs.length > 0 ? (
                                packs.map((pack, idx) => (
                                    <div key={idx} className="bg-slate-950/50 hover:bg-slate-900/80 border border-white/5 p-3 rounded-xl flex items-center justify-between transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-12 h-12 shrink-0 rounded-lg bg-slate-800 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-cover flex items-center justify-center opacity-80 border border-white/5 overflow-hidden">
                                                {pack.icon ? (
                                                    <img src={pack.icon} alt={pack.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Layers size={20} className="text-slate-600" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`font-medium text-sm truncate ${pack.enabled ? 'text-slate-200' : 'text-slate-400'}`}>{pack.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{pack.description || (pack.enabled ? 'Active' : 'Inactive')}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {pack.enabled && <CheckCircle size={16} className="text-emerald-500 shrink-0" />}
                                            {pack.path && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(pack);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Resource Pack"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-slate-500 py-12 flex flex-col items-center gap-2">
                                    {searchQuery ? (
                                        <>
                                            <Search size={32} className="opacity-20" />
                                            <p>No resource packs matching "{searchQuery}"</p>
                                        </>
                                    ) : (
                                        <>
                                            <Layers size={32} className="opacity-20" />
                                            <p>No resource packs detected</p>
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>
        </div>
    );
};

export default ResourcePacksList;
