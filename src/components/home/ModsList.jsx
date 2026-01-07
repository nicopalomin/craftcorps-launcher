import React, { useState } from 'react';
import { Box, RefreshCw, Plus, Search, Loader2, Cpu, X, PlusCircle, Globe } from 'lucide-react';

const ModsList = ({
    installedMods,
    selectedInstance,
    isLoading,
    onRefresh,
    onAdd,
    onBrowse,
    onDelete,
    isDraggingGlobal,
    onDragOver,
    onDragLeave,
    onDrop,
    className = "h-[500px]"
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const isDragging = isDraggingGlobal; // Or manage local dragging state if needed, but the parent seems to manage it.

    return (
        <div
            className={`bg-slate-900/40 border transition-colors rounded-3xl p-6 backdrop-blur-sm flex flex-col relative ${className} ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                            <Box size={20} />
                        </div>
                        Installed Mods
                        <span className="text-xs font-medium bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
                            {isLoading ? '...' : (installedMods.length > 0 ? installedMods.length : (selectedInstance.mods?.length || 0))}
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRefresh}
                            className={`p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Refresh Mods"
                            disabled={isLoading}
                        >
                            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onBrowse}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 hover:shadow-indigo-500/30 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                            title="Browse & Download Mods"
                        >
                            <Globe size={20} />
                        </button>
                        <button
                            onClick={() => onAdd(null)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-white hover:text-emerald-400 shadow-lg shadow-black/20 rounded-xl transition-all active:scale-95 flex items-center justify-center border border-white/5"
                            title="Install Local Mod (JAR)"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                {/* Mod Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search installed mods..."
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-900/80 transition-all font-medium"
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
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                        <span className="text-sm font-medium">Scanning mods...</span>
                    </div>
                ) : (
                    <>
                        {(() => {
                            const allMods = installedMods.length > 0 ? installedMods : (selectedInstance.mods || []);

                            // Search Filter Logic
                            const mods = searchQuery
                                ? allMods.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                : allMods;

                            return mods.length > 0 ? (
                                mods.map((mod, idx) => (
                                    <div key={idx} className="bg-slate-950/50 hover:bg-slate-900/80 border border-white/5 p-3 rounded-xl flex items-center justify-between transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${mod.enabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-600'}`}>
                                                <Cpu size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`font-medium text-sm truncate ${mod.enabled ? 'text-slate-200' : 'text-slate-500 decoration-slate-600 line-through'}`}>{mod.name}</div>
                                                {mod.version && <div className="text-xs text-slate-500 font-mono truncate mr-2">{mod.version}</div>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            {mod.enabled ? <span className="text-emerald-500 text-xs font-medium bg-emerald-500/10 px-2 py-0.5 rounded">Enabled</span> : <span className="text-slate-500 text-xs">Disabled</span>}
                                            {mod.path && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(mod);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete Mod"
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
                                            <p>No mods matching "{searchQuery}"</p>
                                        </>
                                    ) : (
                                        <>
                                            <Box size={32} className="opacity-20" />
                                            <p>No mods detected</p>
                                        </>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 rounded-3xl backdrop-blur-sm pointer-events-none border-2 border-indigo-500 border-dashed">
                    <div className="flex flex-col items-center gap-4 text-indigo-400">
                        <PlusCircle size={48} />
                        <span className="text-xl font-bold">Drop JARs to Install</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModsList;
