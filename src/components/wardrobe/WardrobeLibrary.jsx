import React from 'react';
import { Shirt, Sparkles, PlusCircle, RefreshCw } from 'lucide-react';
import SkinCard from './SkinCard';
import CosmeticCard from './CosmeticCard';

const WardrobeLibrary = ({
    activeTab,
    setActiveTab,
    theme,
    cape3DMode,
    setCape3DMode,
    currentSkin,
    selectedSkin,
    setSelectedSkin,
    savedSkins,
    handleDeleteSkin,
    editingSkinId,
    editName,
    setEditName,
    startEditing,
    saveName,
    handleImportSkin,
    isLoadingCosmetics,
    categorizedCosmetics,
    unequippedCosmeticSlots,
    activeCosmetics,
    toggleCosmetic,
    refreshCosmetics
}) => {
    return (
        <div className={`flex-1 rounded-[2rem] border p-8 flex flex-col min-h-0 relative overflow-hidden group/card ${theme === 'white' ? 'bg-white/60 border-slate-200 shadow-xl' : 'bg-slate-900/40 border-white/10 shadow-2xl backdrop-blur-xl'}`}>
            {/* Border Glow */}
            <div className="absolute -inset-[2px] bg-gradient-to-br from-emerald-500/20 via-transparent to-emerald-500/20 rounded-[2rem] blur-sm animate-slow-pulse pointer-events-none" />

            {/* Slow Background Shine */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-slow-sweep pointer-events-none" />

            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-50 pointer-events-none" />
            <div className="absolute inset-0 animate-shimmer opacity-[0.02] pointer-events-none" />

            {/* Tabs */}
            <div className="flex items-end justify-between gap-8 mb-8 border-b border-white/5 pb-0">
                <div className="flex gap-8">
                    <button
                        onClick={() => setActiveTab('skins')}
                        className={`pb-4 font-bold text-sm tracking-tight transition-all relative ${activeTab === 'skins' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Shirt size={16} /> My Skins
                        </div>
                        {activeTab === 'skins' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400 rounded-t-full shadow-[0_-4px_10px_rgba(16,185,129,0.5)] animate-in slide-in-from-bottom-1" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('cosmetics')}
                        className={`pb-4 font-bold text-sm tracking-tight transition-all relative ${activeTab === 'cosmetics' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} /> Cosmetics
                        </div>
                        {activeTab === 'cosmetics' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400 rounded-t-full shadow-[0_-4px_10px_rgba(16,185,129,0.5)] animate-in slide-in-from-bottom-1" />}
                    </button>
                </div>

                {/* 2D/3D Toggle */}
                {activeTab === 'cosmetics' && (
                    <div className="flex items-center gap-2 pb-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">3D Preview:</span>
                        <button
                            onClick={() => setCape3DMode(!cape3DMode)}
                            className={`relative px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all ${cape3DMode
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                : 'bg-slate-800/60 text-slate-400 border border-white/10 hover:border-white/20'
                                }`}
                        >
                            <span className="relative z-10">{cape3DMode ? '3D' : '2D'}</span>
                            {cape3DMode && (
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-emerald-400/20 to-emerald-500/10 animate-slow-sweep rounded-lg" />
                            )}

                        </button>
                        <div className="w-px h-4 bg-white/10 mx-2" />
                        <button
                            onClick={refreshCosmetics}
                            className={`p-1.5 rounded-lg transition-colors ${isLoadingCosmetics ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            title="Refresh Cosmetics"
                            disabled={isLoadingCosmetics}
                        >
                            <RefreshCw size={14} className={isLoadingCosmetics ? 'animate-spin' : ''} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {activeTab === 'skins' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4 pb-8">
                        {/* Current Equipped Card */}
                        {currentSkin.skinUrl && (
                            <SkinCard
                                skin={currentSkin}
                                selectedSkin={selectedSkin}
                                isCurrentMojang={true}
                                theme={theme}
                                setSelectedSkin={setSelectedSkin}
                            />
                        )}

                        {savedSkins.map(skin => (
                            <SkinCard
                                key={skin.id}
                                skin={skin}
                                selectedSkin={selectedSkin}
                                theme={theme}
                                editingSkinId={editingSkinId}
                                editName={editName}
                                setSelectedSkin={setSelectedSkin}
                                handleDeleteSkin={handleDeleteSkin}
                                startEditing={startEditing}
                                setEditName={setEditName}
                                saveName={saveName}
                            />
                        ))}

                        <div
                            onClick={handleImportSkin}
                            className={`border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 hover:text-emerald-400 hover:border-emerald-500/40 transition-all cursor-pointer aspect-[3/4] group ${theme === 'white' ? 'bg-white/50 border-slate-300 text-slate-400 hover:bg-slate-50 shadow-inner' : 'bg-slate-900/20 border-white/5 text-slate-500 hover:bg-slate-800/40'}`}
                        >
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                                <PlusCircle size={24} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest">Add Skin</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12 pb-8">
                        {isLoadingCosmetics && Object.keys(categorizedCosmetics).every(cat => categorizedCosmetics[cat].length === 0) ? (
                            <div className="py-20 text-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-4 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                                <p className="text-slate-500 font-medium">Synchronizing wardrobe...</p>
                            </div>
                        ) : Object.keys(categorizedCosmetics).every(cat => categorizedCosmetics[cat].length === 0) && unequippedCosmeticSlots.length === 0 ? (
                            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-4">
                                <div className="w-16 h-16 bg-slate-900/40 rounded-full flex items-center justify-center border border-white/5">
                                    <Sparkles size={32} className="opacity-20" />
                                </div>
                                <p className="font-medium">No cosmetics discovered yet.</p>
                            </div>
                        ) : (
                            <>
                                {Object.entries(categorizedCosmetics).map(([category, items]) => (
                                    <div key={category} className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-xs font-black text-white tracking-widest uppercase bg-slate-800 border border-white/10 px-4 py-1.5 rounded-full shadow-lg">
                                                {category}
                                            </h3>
                                            {items.length === 0 && (
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-black text-emerald-400 animate-pulse">
                                                    <Sparkles size={10} />
                                                    <span>COMING SOON...</span>
                                                </div>
                                            )}
                                            <div className="flex-1 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />
                                            <span className="text-[10px] font-black text-slate-600 tracking-tighter">{items.length} ITEMS</span>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {items.length > 0 ? (
                                                items.map((item) => (
                                                    <CosmeticCard
                                                        key={item.id}
                                                        item={item}
                                                        activeCosmetics={activeCosmetics}
                                                        toggleCosmetic={toggleCosmetic}
                                                        theme={theme}
                                                        cape3DMode={cape3DMode}
                                                    />
                                                ))
                                            ) : (
                                                <div className="group relative rounded-3xl p-4 border border-dashed border-white/5 bg-white/[0.02] opacity-20 transition-all">
                                                    <div className="aspect-square rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden bg-black/40 border border-dashed border-white/5">
                                                        <Shirt size={24} className="text-white/20" />
                                                    </div>
                                                    <div className="h-3 w-2/3 bg-white/10 rounded-full mb-2" />
                                                    <div className="h-2 w-1/3 bg-white/5 rounded-full" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WardrobeLibrary;
