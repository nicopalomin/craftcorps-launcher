import React, { useState } from 'react';
import { Aperture, RefreshCw, Plus, Search, Loader2, CheckCircle, X, Sun, Globe } from 'lucide-react';

const ShadersList = ({
    shaders,
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
    className = "h-[500px]",
    theme
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const isDragging = isDraggingGlobal;

    return (
        <div
            className={`bg-slate-900/40 border transition-colors rounded-3xl p-6 backdrop-blur-sm flex flex-col relative ${className} ${isDragging ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-bold flex items-center gap-3 ${theme === 'white' ? '!text-black' : 'text-white'}`}>
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                            <Aperture size={20} />
                        </div>
                        Shaders
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${theme === 'white' ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'}`}>
                            {isLoading ? '...' : (shaders !== null ? shaders.length : 0)}
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRefresh}
                            className={`p-2 rounded-xl transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${theme === 'white' ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                            title="Refresh Shaders"
                            disabled={isLoading}
                        >
                            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                        {onBrowse && (
                            <button
                                onClick={onBrowse}
                                className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 hover:shadow-cyan-500/30 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                                title="Browse Online Shaders"
                            >
                                <Globe size={20} />
                            </button>
                        )}
                        <button
                            onClick={() => onAdd(null)}
                            className={`p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center border ${theme === 'white' ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-cyan-500 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-white hover:text-cyan-400 shadow-lg shadow-black/20 border-white/5'}`}
                            title="Add Local Shaders (.zip)"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search size={16} className={`transition-colors ${theme === 'white' ? 'text-slate-400 group-focus-within:text-cyan-500' : 'text-slate-500 group-focus-within:text-cyan-400'}`} />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search shaders..."
                        className={`w-full rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none transition-all font-medium ${theme === 'white'
                            ? 'bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-cyan-500/50 focus:bg-slate-50'
                            : 'bg-slate-950/50 border border-white/5 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:bg-slate-900/80'
                            }`}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className={`absolute inset-y-0 right-3 flex items-center transition-colors ${theme === 'white' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-slate-300'}`}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                        <Loader2 size={32} className="animate-spin text-cyan-500" />
                        <span className="text-sm font-medium">Scanning shaders...</span>
                    </div>
                ) : (
                    <>
                        {(() => {
                            const allShaders = shaders || [];

                            const filtered = searchQuery
                                ? allShaders.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                : allShaders;

                            return filtered.length > 0 ? (
                                filtered.map((shader, idx) => (
                                    <div key={idx} className={`p-3 rounded-xl flex items-center justify-between transition-colors group border ${theme === 'white'
                                        ? 'bg-white hover:bg-slate-50 border-slate-200'
                                        : 'bg-slate-950/50 hover:bg-slate-900/80 border-white/5'
                                        }`}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-12 h-12 shrink-0 rounded-lg flex items-center justify-center opacity-80 overflow-hidden ${theme === 'white' ? 'bg-slate-100 border border-slate-200' : 'bg-slate-800 bg-[url("https://www.transparenttextures.com/patterns/cubes.png")] bg-cover border border-white/5'}`}>
                                                <Sun size={20} className={theme === 'white' ? 'text-slate-400' : 'text-slate-600'} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`font-medium text-sm truncate ${shader.active ? (theme === 'white' ? 'text-slate-700' : 'text-slate-200') : 'text-slate-400'}`}>{shader.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{shader.active ? 'Active' : 'Inactive'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {shader.active && <CheckCircle size={16} className="text-emerald-500 shrink-0" />}
                                            {shader.path && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(shader);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Shader"
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
                                            <p>No shaders matching "{searchQuery}"</p>
                                        </>
                                    ) : (
                                        <>
                                            <Sun size={32} className="opacity-20" />
                                            <p>No shaders detected</p>
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

export default ShadersList;
