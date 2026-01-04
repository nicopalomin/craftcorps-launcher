import React from 'react';
import {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy, Server, X, Play, Loader2, ChevronRight
} from 'lucide-react';
import { formatLastPlayed } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';

const ICON_MAP = {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy
};

const InstanceHero = ({
    selectedInstance,
    launchStatus,
    launchFeedback,
    onPlay,
    onStop,
    theme
}) => {
    const { t } = useTranslation();
    const isModded = selectedInstance.loader !== 'Vanilla';

    return (
        <div className={`flex flex-col items-center text-center w-full px-8 pb-8 ${isModded ? 'pt-16 max-w-7xl mx-auto' : 'max-w-4xl'}`}>

            {/* Horizontal Hero for Modded */}
            <div className={`${isModded ? 'flex items-start gap-8 w-full text-left bg-slate-900/40 p-8 rounded-3xl border border-white/5 backdrop-blur-sm shadow-xl' : 'contents'}`}>

                {/* Instance Icon */}
                <div
                    className={`${isModded ? 'w-24 h-24 shrink-0' : 'w-32 h-32 mb-8'} rounded-3xl ${selectedInstance.icon ? 'bg-transparent' : selectedInstance.iconColor} flex items-center justify-center ${selectedInstance.glyphColor || 'text-slate-900'} shadow-2xl shadow-black/50 transform hover:scale-105 transition-transform duration-300 ring-4 ring-white/10 overflow-hidden`}
                >
                    {selectedInstance.icon ? (
                        <img src={selectedInstance.icon} alt={selectedInstance.name} className="w-full h-full object-cover" />
                    ) : (
                        React.createElement(ICON_MAP[selectedInstance.iconKey] || Sprout, { size: 64 })
                    )}
                </div>

                {/* Info & Play */}
                <div className={isModded ? 'flex-1 min-w-0' : 'contents'}>
                    {/* Title */}
                    <h1 className={`${isModded ? 'text-3xl mb-3' : 'text-5xl mb-2'} font-bold text-slate-200 tracking-tight drop-shadow-lg truncate`}>
                        {selectedInstance.name}
                    </h1>

                    {/* Tags */}
                    <div className={`flex items-center gap-3 text-slate-300 mb-8 ${isModded ? '' : 'justify-center bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5'}`}>
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                            <span className="font-mono text-emerald-300">{selectedInstance.version}</span>
                        </div>

                        <span className={`w-1 h-1 rounded-full bg-slate-500 ${isModded ? 'hidden' : ''}`} />

                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                            <div className={`w-2 h-2 rounded-full ${isModded ? 'bg-amber-400' : 'bg-slate-400'}`}></div>
                            <span>{selectedInstance.loader}</span>
                        </div>

                        <span className={`w-1 h-1 rounded-full bg-slate-500 ${isModded ? 'hidden' : ''}`} />

                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                            <span className="text-emerald-400 font-medium">{selectedInstance.status === 'Ready' ? t('home_status_ready') : selectedInstance.status}</span>
                        </div>

                        {selectedInstance.autoConnect && (
                            <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 text-emerald-400">
                                <Server size={14} />
                                <span className="text-xs font-medium">{selectedInstance.serverAddress}</span>
                            </div>
                        )}
                    </div>

                    {/* Play Button - Inline for Modded */}
                    <div className={`${isModded ? 'max-w-md' : 'w-full flex justify-center'}`}>
                        {launchStatus === 'idle' ? (
                            launchFeedback === 'cancelled' ? (
                                <button disabled className="group relative w-full max-w-sm bg-slate-800 border-2 border-slate-700 text-amber-500 py-4 px-8 rounded-2xl font-bold text-lg cursor-not-allowed flex items-center justify-center gap-3 animate-pulse">
                                    <X size={24} /> {t('home_launch_cancelled')}
                                </button>
                            ) : launchFeedback === 'error' ? (
                                <button disabled className="group relative w-full max-w-sm bg-slate-800 border-2 border-red-900/50 text-red-500 py-4 px-8 rounded-2xl font-bold text-lg cursor-not-allowed flex items-center justify-center gap-3">
                                    <X size={24} /> Launch Failed
                                </button>
                            ) : (
                                <div className="group relative w-full max-w-sm">
                                    <button
                                        onClick={onPlay}
                                        className={`relative w-full bg-emerald-600 group-hover:bg-emerald-500 text-white rounded-2xl font-bold ${theme === 'midnight'
                                            ? 'shadow-lg shadow-black/40 group-hover:shadow-2xl group-hover:shadow-black/60'
                                            : 'shadow-[0_0_40px_rgba(5,150,105,0.4)] group-hover:shadow-[0_0_60px_rgba(5,150,105,0.6)]'
                                            } transform group-hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-[transform,box-shadow,background-color] duration-200 overflow-hidden flex items-center ring-offset-2 ring-offset-transparent group-hover:ring-2 group-hover:ring-emerald-400/30 ${isModded ? 'py-4 text-xl justify-between text-left px-6' : 'py-6 text-2xl justify-center gap-3'}`}
                                    >
                                        {/* Shiny Edge Overlay */}
                                        <div className={`absolute inset-0 rounded-2xl ring-1 ${theme === 'midnight' ? 'ring-white/5 group-hover:ring-white/10' : 'ring-white/10 group-hover:ring-white/30'} transition-all pointer-events-none`} />

                                        <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${theme === 'midnight' ? 'via-white/5' : 'via-white/20'} to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`} />
                                        <span className="flex items-center gap-4">
                                            <Play size={isModded ? 28 : 32} fill="currentColor" />
                                            <span className="flex flex-col items-start leading-none gap-1">
                                                <span>{t('home_playing')}</span>
                                                {isModded && <span className="text-xs font-medium text-emerald-200 opacity-80 font-sans tracking-wide">Last Played: {formatLastPlayed(selectedInstance.lastPlayed, t)}</span>}
                                            </span>
                                        </span>
                                        {isModded && <ChevronRight size={24} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
                                    </button>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={onStop}
                                className="w-full max-w-sm bg-slate-800 border-2 border-slate-700 text-slate-300 hover:text-slate-200 hover:border-red-500/50 hover:bg-red-500/10 py-5 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3"
                            >
                                {launchStatus === 'launching' ? (
                                    <Loader2 size={24} className="animate-spin" />
                                ) : (
                                    <X size={24} />
                                )}
                                {launchStatus === 'launching' ? t('home_germinating') : t('home_stop')}
                            </button>
                        )}
                    </div>

                    {/* Last Played - Only for Vanilla layout as it's inline for Modded */}
                    {!isModded && (
                        <p className="mt-6 text-slate-500 text-sm font-medium">
                            {t('home_last_harvested')} {formatLastPlayed(selectedInstance.lastPlayed, t)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InstanceHero;
