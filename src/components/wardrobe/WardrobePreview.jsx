import React from 'react';
import { Upload, Save } from 'lucide-react';
import SkinViewer from '../common/SkinViewer';

const WardrobePreview = ({
    viewerSkin,
    activeCosmetics,
    handleImportSkin,
    handleApplySkin,
    isProcessing,
    selectedSkin,
    activeAccount,
    theme,
    isActive = true, // Default to true if not passed
    isInitializing = false
}) => {
    return (
        <div className="lg:w-2/5 flex flex-col gap-6 h-full">
            <div className="flex-1 flex flex-col items-center justify-center relative group min-h-[450px] bg-slate-900/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-inner group/card">
                {/* Slow Background Shine */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-slow-sweep pointer-events-none" />

                {/* Shimmer and Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent opacity-50 pointer-events-none" />
                <div className="absolute inset-0 animate-shimmer opacity-[0.03] pointer-events-none" />

                {/* 3D Model Viewer */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                    {isInitializing ? (
                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                            <div className="w-8 h-8 rounded-full border-2 border-slate-700/50 border-t-emerald-500 animate-spin" />
                            <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">Loading Wardrobe...</span>
                        </div>
                    ) : isActive ? (
                        <SkinViewer
                            skinUrl={viewerSkin.skinUrl}
                            capeUrl={viewerSkin.capeUrl}
                            model={viewerSkin.model}
                            cosmetics={activeCosmetics}
                            className="w-full h-full animate-in fade-in duration-500"
                            isActive={isActive}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-500 opacity-50">
                            <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
                            <span className="text-[10px] font-bold tracking-widest uppercase">Paused</span>
                        </div>
                    )}
                </div>

                {/* Drag hint */}
                <div className="absolute bottom-6 text-[10px] font-bold tracking-widest uppercase text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md px-4 py-2 rounded-full pointer-events-none z-20 border border-white/5">
                    Rotate Preview
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleImportSkin}
                    disabled={isProcessing}
                    className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${theme === 'white' ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-800/40 hover:bg-slate-700/60 text-slate-200 border-white/5'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                >
                    <Upload size={14} /> Import Skin
                </button>
                <button
                    onClick={handleApplySkin}
                    disabled={isProcessing || !selectedSkin || selectedSkin.source === 'mojang' || activeAccount?.type?.toLowerCase() === 'offline'}
                    className={`flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-transparent text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] ${!isProcessing && selectedSkin && selectedSkin.source !== 'mojang' && activeAccount?.type?.toLowerCase() !== 'offline' ? 'hover:scale-[1.02]' : ''}`}
                >
                    {isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={14} />}
                    {isProcessing ? 'Processing...' : 'Apply Details'}
                </button>
            </div>
        </div>
    );
};

export default WardrobePreview;
