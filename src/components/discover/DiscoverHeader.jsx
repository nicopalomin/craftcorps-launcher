
import React, { useState, useEffect, useRef } from 'react';
import { Star, Search, X, Filter } from 'lucide-react';

const DiscoverHeader = React.memo(({
    query,
    setQuery,
    activeFilters,
    setActiveFilters,
    metadata
}) => {
    const [showSearch, setShowSearch] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const filterMenuRef = useRef(null);

    // Close filters on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
                setShowFilterMenu(false);
            }
        };

        if (showFilterMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showFilterMenu]);

    return (
        <div className="relative z-50 p-0 pb-6 shrink-0">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-200 tracking-tight leading-none mb-1">
                        Discover Servers
                    </h1>
                    <p className="text-slate-400 text-sm">
                        Browse, select and you're in the server!
                    </p>
                </div>

                {/* Right: Search + Filter + Status */}
                <div className="flex items-center gap-3 transition-all duration-300">
                    {/* Search Bar */}
                    <div className="relative group cursor-not-allowed">
                        <div className={`flex items-center bg-slate-800/60 border border-white/5 rounded-xl overflow-hidden pointer-events-none opacity-50 transition-all duration-300 ${showSearch ? 'w-[200px]' : 'w-10'}`}>
                            <button
                                onClick={() => {
                                    setShowSearch(!showSearch);
                                    if (showSearch) setQuery('');
                                }}
                                className="w-10 h-10 flex items-center justify-center text-slate-400 shrink-0"
                            >
                                <Search size={18} />
                            </button>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search..."
                                className={`bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none h-full w-full pr-3 ${showSearch ? 'opacity-100' : 'opacity-0'}`}
                            />
                            {query && showSearch && (
                                <button onClick={() => setQuery('')} className="pr-3 text-slate-500">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        {/* Bandage Tooltip */}
                        <div className="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 border border-white/10 text-xs font-medium text-slate-300 rounded-lg shadow-xl opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 select-none">
                            Search (Coming Soon)
                        </div>
                    </div>

                    {/* Filter Menu Toggle */}
                    <div className="relative group cursor-not-allowed" ref={filterMenuRef}>
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border pointer-events-none opacity-50 transition-colors ${showFilterMenu || activeFilters.category !== 'all' || activeFilters.version || activeFilters.language
                                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                                : 'bg-slate-800/60 border-white/5 text-slate-400'
                                }`}
                            title="Filters"
                        >
                            <Filter size={18} />
                        </button>
                        {/* Bandage Tooltip */}
                        <div className="absolute top-12 right-0 px-3 py-1.5 bg-slate-900 border border-white/10 text-xs font-medium text-slate-300 rounded-lg shadow-xl opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 select-none">
                            Filters (Coming Soon)
                        </div>

                        {/* Dropdown Menu */}
                        {showFilterMenu && (
                            <div className="absolute right-0 top-12 w-72 bg-slate-900 border border-white/10 shadow-2xl rounded-2xl p-4 z-[100] flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters</span>
                                    {(activeFilters.category !== 'all' || activeFilters.version || activeFilters.language) && (
                                        <button
                                            onClick={() => setActiveFilters({ category: 'all', version: '', language: '' })}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                                {/* ... Rest of dropdown ... */}

                                <div className="space-y-3">
                                    {/* Category */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500 font-medium ml-1">Category</label>
                                        <select
                                            value={activeFilters.category}
                                            onChange={(e) => setActiveFilters(p => ({ ...p, category: e.target.value }))}
                                            className="w-full h-10 pl-3 pr-8 rounded-xl bg-slate-800 border border-white/5 text-slate-300 text-sm outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-slate-700"
                                        >
                                            <option value="all">All Categories</option>
                                            {metadata.categories.map(c => (
                                                <option key={c.id || c} value={c.id || c}>{c.displayName || c.id || c}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Version */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500 font-medium ml-1">Version</label>
                                        <select
                                            value={activeFilters.version}
                                            onChange={(e) => setActiveFilters(p => ({ ...p, version: e.target.value }))}
                                            className="w-full h-10 pl-3 pr-8 rounded-xl bg-slate-800 border border-white/5 text-slate-300 text-sm outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-slate-700"
                                        >
                                            <option value="">Any Version</option>
                                            {(metadata.versions.length > 0 ? metadata.versions : ["1.21", "1.20.4", "1.20.1", "1.19", "1.18", "1.16.5", "1.12.2", "1.8.9"]).map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Language */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500 font-medium ml-1">Language</label>
                                        <select
                                            value={activeFilters.language}
                                            onChange={(e) => setActiveFilters(p => ({ ...p, language: e.target.value }))}
                                            className="w-full h-10 pl-3 pr-8 rounded-xl bg-slate-800 border border-white/5 text-slate-300 text-sm outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-slate-700"
                                        >
                                            <option value="">Any Language</option>
                                            {(metadata.languages.length > 0 ? metadata.languages : ["en-US", "es-ES", "fr-FR", "de-DE", "pt-BR", "ru-RU", "zh-CN"]).map(l => (
                                                <option key={l} value={l}>{l}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default DiscoverHeader;
