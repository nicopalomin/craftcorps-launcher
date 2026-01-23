import React, { useState, useEffect } from 'react';
import { Package, Box, Search, Loader2, Download, Layers, AlertTriangle, Aperture } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ModsGridView = ({
    projectType,
    setProjectType,
    searchQuery,
    setSearchQuery,
    filterVersion,
    setFilterVersion,
    filterCategory,
    setFilterCategory,
    availableVersions,
    availableCategories,
    isLoadingFilters,
    isSearching,
    searchError,
    results,
    onProjectSelect,
    setSelectedProject, // Added prop
    selectedInstance, // Added prop
    onLoadMore, // Added prop
    isLoadingMore, // Added prop
    onSwitchInstance // Added prop
}) => {
    const { t } = useTranslation();

    const isVanilla = (projectType === 'mod' || projectType === 'shader') && selectedInstance && (!selectedInstance.loader || selectedInstance.loader.toLowerCase() === 'vanilla');

    return (
        <>
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-slate-200">{t('mods_title') || 'Marketplace'}</h2>
                    <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => { setProjectType('mod'); setSelectedProject(null); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectType === 'mod' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            title="Browse Mods"
                        >
                            <Box size={16} /> Mods
                        </button>
                        <button
                            onClick={() => { setProjectType('modpack'); setSelectedProject(null); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectType === 'modpack' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            title="Browse Modpacks"
                        >
                            <Package size={16} /> Modpacks
                        </button>
                        <button
                            onClick={() => { setProjectType('shader'); setSelectedProject(null); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectType === 'shader' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            title="Browse Shaders"
                        >
                            <Aperture size={16} /> Shaders
                        </button>
                    </div>
                </div>

                {/* Instance Indicator */}
                {projectType !== 'modpack' && selectedInstance && !isVanilla && (
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl px-4 py-2 flex items-center justify-between gap-3 text-emerald-400 text-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                <Box size={14} />
                            </div>
                            <span>
                                Browsing generic content for <span className="font-bold text-emerald-300">{selectedInstance.name}</span>
                                <span className="opacity-50 ml-2 text-xs border-l border-emerald-500/20 pl-2">
                                    {selectedInstance.loader} {selectedInstance.version}
                                </span>
                            </span>
                        </div>
                        <button
                            onClick={onSwitchInstance}
                            className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-xs font-medium transition-colors"
                        >
                            Switch
                        </button>
                    </div>
                )}

                {/* Specific msg for mods */}
                {projectType === 'mod' && selectedInstance && !isVanilla && (
                    <div className="hidden"></div> // Placeholder if needed, but above covers generic.
                )}


                {!isVanilla && (
                    <div className="flex gap-2 items-center">
                        {/* Search Bar */}
                        <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                            <Search size={20} className="text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={projectType === 'shader' ? "Search shaders..." : `Search ${projectType}s...`}
                                className="bg-transparent border-none focus:outline-none text-slate-200 w-full placeholder:text-slate-600"
                            />
                        </div>

                        {/* Version Filter */}
                        <select
                            value={filterVersion}
                            onChange={(e) => setFilterVersion(e.target.value)}
                            disabled={isLoadingFilters || (!!selectedInstance && projectType === 'mod')}
                            className={`bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-xl px-4 py-3 focus:ring-emerald-500 focus:border-emerald-500 block outline-none appearance-none disabled:opacity-50 ${(selectedInstance && projectType === 'mod') ? 'cursor-not-allowed border-emerald-500/30 bg-emerald-900/10 text-emerald-400' : ''}`}
                            title={(selectedInstance && projectType === 'mod') ? `Locked to ${selectedInstance.version}` : "Filter by Version"}
                        >
                            <option value="">All Versions</option>
                            {availableVersions.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>

                        {/* Category Filter */}
                        {projectType !== 'mod' && projectType !== 'shader' && (
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                disabled={isLoadingFilters}
                                className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-xl px-4 py-3 focus:ring-emerald-500 focus:border-emerald-500 block outline-none appearance-none disabled:opacity-50"
                            >
                                <option value="">All Categories</option>
                                {availableCategories.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        )}

                        {isSearching && (
                            <div className="flex items-center justify-center w-12 text-emerald-500 animate-spin">
                                <Loader2 size={24} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Content Area: Warning OR Search/Grid */}
            {isVanilla && (projectType === 'mod' || projectType === 'shader') ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 animate-in fade-in zoom-in duration-300">
                    <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-amber-500/20 shadow-[0_0_30px_-5px_theme(colors.amber.500/0.2)]">
                        <AlertTriangle size={48} className="text-amber-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-200 mb-2">Vanilla Instance Selected</h3>
                    <p className="text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                        You are currently using <span className="text-amber-400 font-medium">{selectedInstance?.name}</span>, which is a vanilla instance.
                        {projectType === 'shader' ? (
                            <span>
                                To use Shaders, you must use a modded instance (e.g. <span className="text-emerald-400 font-bold">Fabric</span>, <span className="text-emerald-400 font-bold">Quilt</span>, <span className="text-emerald-400 font-bold">Forge</span>, or <span className="text-emerald-400 font-bold">NeoForge</span>). Vanilla Minecraft does not support shaders directly in this launcher.
                            </span>
                        ) : 'Mods require a mod loader like Fabric, Forge, or Quilt to function.'}
                    </p>
                    <button
                        onClick={onSwitchInstance}
                        className="text-sm text-slate-400 bg-slate-900/50 hover:bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-all cursor-pointer hover:text-slate-200"
                    >
                        Switch to a modded instance or create a new Modpack to continue.
                    </button>
                </div>
            ) : (
                <div className="pr-2">
                    {searchError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center mb-4">
                            {searchError}
                        </div>
                    )}

                    {results.length === 0 ? (
                        isSearching ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-32 flex flex-col gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-16 h-16 bg-slate-800 rounded-lg shrink-0" />
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="h-4 bg-slate-800 rounded w-3/4" />
                                                <div className="h-3 bg-slate-800 rounded w-1/2" />
                                                <div className="h-8 bg-slate-800 rounded w-full" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-slate-500">
                                <Package size={64} className="mx-auto mb-4 opacity-20" />
                                <p>{searchQuery ? 'No results found.' : 'Loading recommendations...'}</p>
                            </div>
                        )
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {results.map((project) => (
                                <ModsGridCard
                                    key={project.project_id}
                                    project={project}
                                    onClick={() => onProjectSelect(project)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Load More Button */}
                    {results.length > 0 && (
                        <div className="flex justify-center mt-8 pb-8">
                            <button
                                onClick={onLoadMore}
                                disabled={isLoadingMore}
                                className={`px-6 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:cursor-not-allowed flex items-center gap-2 ${isLoadingMore ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-200'}`}
                            >
                                {isLoadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                                {isLoadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}

                    {/* Modrinth Attribution */}
                    <div className="text-center pb-0 mt-4 border-t border-slate-800/50 pt-4">
                        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                            <Layers size={12} className="text-emerald-500" />
                            <span><span className="font-bold text-slate-400">CraftCorps</span> leverages the <span className="font-bold text-slate-400">Modrinth</span> ecosystem to provide a secure and verified modding experience</span>
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

// Extracted internal component for cleaner code
const ModsGridCard = ({ project, onClick }) => {
    const loaders = project.categories?.filter(c => ['fabric', 'forge', 'quilt', 'neoforge'].includes(c)) || [];
    const gameVersions = project.versions || [];
    const displayVersions = gameVersions.slice(0, 2);
    const hasMoreVersions = gameVersions.length > 2;

    return (
        <div
            onClick={onClick}
            className="group bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700/50 rounded-xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer"
        >
            <div className="flex items-start gap-3">
                <div className="w-16 h-16 bg-slate-950 rounded-lg flex-shrink-0 overflow-hidden border border-slate-800 group-hover:border-emerald-500/30 transition-colors">
                    {project.icon_url ? (
                        <img src={project.icon_url} alt={project.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-emerald-500/20">
                            <Box size={32} />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                        {project.title}
                    </h3>
                    <p className="text-xs text-emerald-500/80 mb-1 font-medium">
                        by {project.author}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-2">
                        {project.description}
                    </p>
                </div>
            </div>

            {/* Tags / Versions */}
            <div className="flex flex-wrap gap-1.5 mt-1">
                {loaders.map(l => (
                    <span key={l} className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300 capitalize">
                        {l}
                    </span>
                ))}
                {displayVersions.map(v => (
                    <span key={v} className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-500">
                        {v}
                    </span>
                ))}
                {hasMoreVersions && (
                    <span className="px-1.5 py-0.5 text-[10px] text-slate-600">+{gameVersions.length - 2}</span>
                )}
            </div>

            <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-800/50 text-[10px] text-slate-500 font-mono">
                <span className="flex items-center gap-1"><Download size={12} /> {project.downloads.toLocaleString()}</span>
                <span className="flex items-center gap-1"><Layers size={12} /> {project.project_type}</span>
            </div>
        </div>
    )
}
