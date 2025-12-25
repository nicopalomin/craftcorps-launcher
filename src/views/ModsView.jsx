import React from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Box, Download, Search, Filter } from 'lucide-react';

const ModsView = () => {
    const { t } = useTranslation();
    return (
        <div className="flex-1 p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col h-full overflow-hidden relative select-none">
            <h2 className="text-3xl font-bold text-white mb-6">{t('mods_title')}</h2>

            {/* Construction Overlay */}
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-8">
                <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-12 max-w-2xl w-full text-center shadow-2xl shadow-black/50 transform -rotate-1">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-500/10 mb-6 border border-amber-500/30">
                        <HardDrive size={48} className="text-amber-500" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">{t('mods_under_construction')}</h1>
                    <p className="text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
                        {t('mods_desc')}
                        <br />
                        <span className="text-amber-500 font-bold">{t('mods_coming_soon')}</span>
                    </p>
                </div>
            </div>

            {/* Blurred Background Content (Fake Mod Interface) */}
            <div className="flex flex-col gap-6 flex-1 min-h-0 filter blur-sm pointer-events-none opacity-50 select-none">

                {/* Search Bar Placeholder */}
                <div className="flex gap-4">
                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
                        <Search size={20} className="text-slate-500" />
                        <span className="text-slate-600">{t('mods_search_placeholder')}</span>
                    </div>
                    <div className="w-48 bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                        <span className="text-slate-400">{t('mods_all_categories')}</span>
                        <Filter size={16} className="text-slate-600" />
                    </div>
                </div>

                {/* Mod Grid Placeholder */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-4">
                            <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center text-slate-600">
                                <Box size={24} />
                            </div>
                            <div className="flex-1">
                                <div className="h-5 w-3/4 bg-slate-800 rounded mb-2"></div>
                                <div className="h-3 w-1/2 bg-slate-800/50 rounded mb-3"></div>
                                <div className="flex gap-2">
                                    <span className="h-4 w-12 bg-emerald-900/30 border border-emerald-900/50 rounded-full"></span>
                                    <span className="h-4 w-12 bg-slate-800 rounded-full"></span>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between items-end">
                                <div className="p-2 bg-slate-800 rounded-lg">
                                    <Download size={16} className="text-slate-600" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ModsView;
