import React from 'react';
import { Maximize2, Upload, HardDrive, User, Check, PlusCircle } from 'lucide-react';
import { SKINS } from '../data/mockData';

const WardrobeView = () => {
    return (
        <div className="flex-1 p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col h-full overflow-hidden relative">
            <h2 className="text-3xl font-bold text-white mb-6">Wardrobe</h2>

            {/* Construction Overlay */}
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-8">
                <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-12 max-w-2xl w-full text-center shadow-2xl shadow-black/50 transform rotate-1">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-500/10 mb-6 border border-amber-500/30">
                        <HardDrive size={48} className="text-amber-500" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">Under Construction</h1>
                    <p className="text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
                        We're stitching together the ultimate skin manager details.
                        <br />
                        <span className="text-amber-500 font-bold">Coming Soon to CraftCorps!</span>
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0 filter blur-sm pointer-events-none opacity-50 select-none">
                {/* Left Column: Preview */}
                <div className="lg:w-1/3 flex flex-col gap-4">
                    <div className="flex-1 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-8 flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

                        {/* Fake Steve Model */}
                        <div className="relative z-10 w-32 h-64 flex flex-col items-center animate-bounce-slow">
                            <div className="w-16 h-16 bg-emerald-300 border-4 border-black/20 mb-1 relative">
                                <div className="absolute top-4 left-3 w-2 h-2 bg-black/80" />
                                <div className="absolute top-4 right-3 w-2 h-2 bg-black/80" />
                                <div className="absolute bottom-3 left-4 right-4 h-1 bg-black/40" />
                            </div>
                            <div className="w-16 h-24 bg-emerald-500 border-4 border-black/20 mb-1 flex items-start justify-center relative">
                                {/* Arms */}
                                <div className="absolute top-0 -left-6 w-5 h-20 bg-emerald-400 border-4 border-black/20" />
                                <div className="absolute top-0 -right-6 w-5 h-20 bg-emerald-400 border-4 border-black/20" />
                            </div>
                            <div className="w-16 h-20 flex">
                                <div className="w-1/2 h-full bg-slate-700 border-4 border-black/20" />
                                <div className="w-1/2 h-full bg-slate-700 border-4 border-black/20" />
                            </div>
                        </div>

                        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                            <button className="bg-slate-900 p-2 rounded-lg text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all"><Maximize2 size={16} /></button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors border border-slate-700">
                            <Upload size={16} /> Upload Skin
                        </button>
                        <button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors">
                            Save & Apply
                        </button>
                    </div>
                </div>

                {/* Right Column: Library */}
                <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 p-6 flex flex-col min-h-0">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <HardDrive size={18} className="text-emerald-500" /> Skin Library
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                        {SKINS.map(skin => (
                            <div key={skin.id} className={`group relative bg-slate-800 rounded-xl p-3 border transition-all cursor-pointer ${skin.used ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-slate-700 hover:border-slate-500'}`}>
                                <div className={`aspect-[3/4] rounded-lg ${skin.color} mb-3 flex items-center justify-center text-white/50 relative overflow-hidden`}>
                                    <User size={32} />
                                    {skin.used && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                            <span className="text-xs font-bold text-white bg-emerald-600 px-2 py-1 rounded-full flex items-center gap-1">
                                                <Check size={10} /> Active
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="mb-2">
                                    <h4 className="text-sm font-bold text-slate-200 truncate">{skin.name}</h4>
                                    <p className="text-xs text-slate-500">{skin.type}</p>
                                </div>
                                <button className="w-full py-1.5 rounded bg-slate-900 text-xs font-medium text-slate-400 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                                    {skin.used ? 'Selected' : 'Equip'}
                                </button>
                            </div>
                        ))}
                        {/* Add New Placeholder */}
                        <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-slate-900 transition-all cursor-pointer aspect-[3/5]">
                            <PlusCircle size={24} />
                            <span className="text-xs font-medium">Add to Library</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WardrobeView;
