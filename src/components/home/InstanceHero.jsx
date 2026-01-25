import React, { useEffect, useState } from 'react';
import {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy, Server, X, Play, Loader2, ChevronRight, Clock, Puzzle,
    Plus, User, Power, Activity
} from 'lucide-react';
import { formatLastPlayed } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { telemetry } from '../../services/TelemetryService';

const ICON_MAP = {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy
};

const formatPlayTime = (ms) => {
    if (!ms) return '0m';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60} m`;
    return `${minutes} m`;
};

const InstanceHero = ({
    selectedInstance,
    launchStatus,
    launchStep,
    launchProgress,
    launchFeedback,
    onPlay,
    onStop,
    theme,
    isAdvanced = false, // New prop to control layout mode
    accounts = [], // New prop for launch menu
    allowOverflow = true, // Allow the widget to show content outside its borders (e.g. menus)
    runningInstances = [], // Full list of active processes
    launchCooldown = false // 5-second safety cooldown
}) => {
    const { t } = useTranslation();
    const [playTime, setPlayTime] = useState(null);
    const [showLaunchMenu, setShowLaunchMenu] = useState(false);
    const [showRunningMenu, setShowRunningMenu] = useState(false);

    // Distinguish between content type and layout mode
    const isModdedContent = selectedInstance.loader !== 'Vanilla';
    const isHorizontalLayout = isModdedContent && isAdvanced;

    useEffect(() => {
        let active = true;
        const fetchTime = () => {
            if (selectedInstance) {
                // Use ID if available, else fallback to '0' (legacy/tracking default)
                // We fallback to path only if we suspect old tracking data might be keyed by path locally?
                // But user requested fallback '0'. Let's stick to ID || '0'.
                const queryId = selectedInstance.id || '0';
                window.electronAPI.getInstancePlayTime(queryId).then((time) => {
                    if (active) setPlayTime(time || 0);
                });
            }
        };

        fetchTime();

        if (window.electronAPI?.onPlaytimeUpdated) {
            window.electronAPI.onPlaytimeUpdated(fetchTime);
        }

        return () => {
            active = false;
            if (window.electronAPI?.removePlaytimeListener) {
                window.electronAPI.removePlaytimeListener();
            }
        };
    }, [selectedInstance?.path, launchStatus]);

    const timeString = formatPlayTime(playTime);

    // Last Played Text
    const lastPlayedText = selectedInstance.lastPlayed ? formatLastPlayed(selectedInstance.lastPlayed, t) : t('home_never');

    return (
        <div className={`flex flex-col items-center text-center w-full px-[5vw] transition-all duration-500 ${isHorizontalLayout ? 'pt-[5vh] max-w-none mx-auto' : 'max-w-none pt-0'}`}>

            {/* Main Hero Widget Container */}
            <div className={`mx-auto glass-spotlight shadow-2xl transition-all duration-500 ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'} ${isHorizontalLayout ? 'flex items-center gap-[4vw] text-left p-[clamp(1.5rem,3vw,3rem)] rounded-[clamp(2rem,5vw,4rem)] w-[clamp(500px,85vw,1100px)]' : 'flex flex-col items-center text-center p-[clamp(1.5rem,4vw,3.5rem)] rounded-[clamp(2rem,6vw,3.5rem)] w-[clamp(280px,90vw,600px)]'}`}>

                {/* Instance Icon */}
                <div
                    className={`${isHorizontalLayout ? 'w-[clamp(4rem,10vw,6rem)] h-[clamp(4rem,10vw,6rem)] shrink-0' : 'w-[clamp(5rem,15vw,7rem)] h-[clamp(5rem,15vw,7rem)] mb-[clamp(1rem,3vw,1.5rem)]'} rounded-[clamp(1rem,2vw,1.5rem)] ${selectedInstance.icon ? 'bg-transparent' : selectedInstance.iconColor} flex items-center justify-center ${selectedInstance.glyphColor || 'text-slate-900'} shadow-2xl transition-all duration-300 ring-4 ring-white/5 overflow-hidden`}
                >
                    {selectedInstance.icon ? (
                        <img src={selectedInstance.icon} alt={selectedInstance.name} className="w-full h-full object-cover" />
                    ) : (
                        React.createElement(ICON_MAP[selectedInstance.iconKey] || Sprout, { size: isHorizontalLayout ? 40 : 48 })
                    )}
                </div>

                {/* Info & Play Content */}
                <div className={`flex-1 min-w-0 ${isHorizontalLayout ? '' : 'flex flex-col items-center w-full'}`}>
                    {/* Title */}
                    <h1 className={`${isHorizontalLayout ? 'text-[clamp(1.5rem,3vw,2rem)] mb-1.5' : 'text-[clamp(1.75rem,5vw,2.5rem)] mb-1'} font-bold tracking-tight truncate ${theme === 'white' ? '!text-black' : 'text-slate-200'}`}>
                        {selectedInstance.name}
                    </h1>

                    {/* Tags */}
                    <div className={`flex items-center gap-2.5 mb-6 ${theme === 'white' ? 'text-slate-600' : 'text-slate-300'} ${isHorizontalLayout ? '' : 'justify-center bg-black/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/5'}`}>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${theme === 'white' ? 'bg-slate-200/50 border-slate-300/50' : 'bg-black/20 border-white/5'}`}>
                            <span className={`font-mono ${theme === 'white' ? 'text-emerald-600' : 'text-emerald-300'}`}>{selectedInstance.version}</span>
                        </div>

                        <span className="w-1 h-1 rounded-full bg-slate-500" />



                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${theme === 'white' ? 'bg-slate-200/50 border-slate-300/50' : 'bg-black/20 border-white/5'}`}>
                            <span className={`${theme === 'white' ? 'text-emerald-600' : 'text-emerald-400'} font-medium`}>{selectedInstance.status === 'Ready' ? t('home_status_ready') : selectedInstance.status}</span>
                        </div>

                        {/* Play Time Tag */}
                        <span className="w-1 h-1 rounded-full bg-slate-500" />
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${theme === 'white' ? 'bg-slate-200/50 border-slate-300/50' : 'bg-black/20 border-white/5'}`}>
                            <Clock size={14} className={theme === 'white' ? 'text-blue-600' : 'text-blue-400'} />
                            <span className={`font-mono ${theme === 'white' ? 'text-blue-600' : 'text-blue-300'}`}>{timeString}</span>
                        </div>

                        {selectedInstance.autoConnect && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-slate-500" />
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-emerald-400 ${theme === 'white' ? 'bg-slate-200/50 border-slate-300/50' : 'bg-black/20 border-white/5'}`}>
                                    <Server size={14} />
                                    <span className="text-xs font-medium">{selectedInstance.serverAddress}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Modded Loader Pill */}
                    {isModdedContent && (
                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-5 border w-fit ${isHorizontalLayout ? '' : 'mx-auto'} ${theme === 'white' ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                            <Puzzle size={12} />
                            <span>Modded • {selectedInstance.loader}</span>
                        </div>
                    )}

                    {/* Play Button - Inline for Modded */}
                    <div className={`${isHorizontalLayout ? 'max-w-sm' : 'w-full flex justify-center'}`}>
                        {launchStatus === 'idle' ? (
                            launchFeedback === 'cancelled' ? (
                                <button disabled className="group relative w-full max-w-[280px] bg-slate-800 border-2 border-slate-700 text-amber-500 py-3 px-6 rounded-xl font-bold text-base cursor-not-allowed flex items-center justify-center gap-3 animate-pulse">
                                    <X size={20} /> {t('home_launch_cancelled')}
                                </button>
                            ) : launchFeedback === 'error' ? (
                                <button disabled className="group relative w-full max-w-[280px] bg-slate-800 border-2 border-red-900/50 text-red-500 py-3 px-6 rounded-xl font-bold text-base cursor-not-allowed flex items-center justify-center gap-3">
                                    <X size={20} /> Launch Failed
                                </button>
                            ) : (
                                <div className="group relative w-full max-w-[320px]">
                                    <button
                                        disabled={launchCooldown}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            telemetry.track('CLICK_PLAY', { instanceId: selectedInstance.id });
                                            onPlay(selectedInstance);
                                        }}
                                        className={`btn-premium-emerald group w-full text-white rounded-2xl font-extrabold flex items-center ${launchCooldown ? 'opacity-70 cursor-wait' : ''} ${isHorizontalLayout ? 'py-4 text-xl justify-between px-6' : 'py-5 text-2xl justify-center gap-4'}`}
                                    >
                                        <div className="flex items-center gap-4 z-10 relative">
                                            {launchCooldown ? <Clock size={isHorizontalLayout ? 24 : 28} className="animate-spin" /> : <Play size={isHorizontalLayout ? 24 : 28} fill="currentColor" strokeWidth={3} />}
                                            <span className="flex flex-col items-start leading-none tracking-wider">
                                                <span>{launchCooldown ? 'COOLDOWN' : t('home_playing')}</span>
                                                {isHorizontalLayout && (
                                                    <span className="text-[10px] font-bold text-emerald-50/70 font-sans tracking-[0.1em] mt-1.5 uppercase group-hover:text-white transition-colors">
                                                        {lastPlayedText}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        {isHorizontalLayout && <ChevronRight size={24} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all z-10 relative" />}
                                    </button>
                                </div>
                            )
                        ) : launchStatus === 'launching' ? (
                            <div className="w-full max-w-sm flex flex-col items-center gap-4">
                                <div className={`w-full p-4 rounded-2xl border flex flex-col gap-3 relative overflow-hidden transition-all duration-300 ${theme === 'white' ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/50 border-white/5'}`}>
                                    {/* Progress Background Glow */}
                                    <div
                                        className="absolute inset-0 bg-emerald-500/5 transition-all duration-700"
                                        style={{ width: `${Math.min(100, Math.max(0, launchProgress))}%` }}
                                    />

                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                                <Loader2 size={18} className="animate-spin" />
                                            </div>
                                            <div className="text-left">
                                                <div className={`text-[10px] font-bold uppercase tracking-widest opacity-50 ${theme === 'white' ? 'text-slate-900' : 'text-slate-400'}`}>
                                                    {t('launch_preparing')}
                                                </div>
                                                <div className={`text-sm font-bold truncate max-w-[180px] ${theme === 'white' ? 'text-slate-900' : 'text-white'}`}>
                                                    {launchStep || t('launch_status_init')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-emerald-500 font-mono font-bold text-sm">{Math.min(100, Math.max(0, launchProgress))}%</span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden relative z-10">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                                            style={{ width: `${Math.min(100, Math.max(2, launchProgress))}%` }}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={onStop}
                                    className="px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-red-500/10 hover:text-red-400 text-slate-400 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border border-white/5 hover:border-red-500/30 flex items-center gap-2"
                                >
                                    <X size={12} /> {t('launch_btn_cancel')}
                                </button>
                            </div>
                        ) : (
                            // RUNNING STATE
                            <div className="w-full max-w-sm flex items-stretch gap-2">
                                {/* Main 'Game Open' Button */}
                                <button
                                    onClick={() => {
                                        if (window.electronAPI?.focusGame) {
                                            window.electronAPI.focusGame(selectedInstance.path);
                                        }
                                    }}
                                    className="flex-1 btn-premium-emerald text-white transition-all rounded-2xl font-extrabold text-lg flex items-center justify-center gap-3 py-4 uppercase tracking-wider"
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                    GAME OPEN
                                </button>

                                {/* Launch Different Profile Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowLaunchMenu(!showLaunchMenu)}
                                        className="h-full px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all flex items-center justify-center"
                                        title="Launch another instance"
                                    >
                                        <Plus size={20} />
                                    </button>

                                    {/* Dropdown */}
                                    {showLaunchMenu && (
                                        <div className="absolute bottom-full right-0 mb-3 w-64 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 backdrop-blur-xl">
                                            <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-800/50">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Launch a New Game as...</span>
                                            </div>
                                            <div className="py-1 max-h-48 overflow-y-auto">
                                                {accounts.map(acc => (
                                                    <button
                                                        key={acc.uuid || acc.name}
                                                        disabled={launchStatus === 'launching' || launchCooldown}
                                                        onClick={() => {
                                                            onPlay(selectedInstance, null, acc);
                                                            setShowLaunchMenu(false);
                                                        }}
                                                        className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${launchStatus === 'launching' || launchCooldown ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
                                                    >
                                                        <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src={`https://minotar.net/avatar/${acc.name}/64`}
                                                                alt=""
                                                                className="w-full h-full"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                            <User size={12} className="text-slate-500" />
                                                        </div>
                                                        <span className="text-sm font-medium truncate">{acc.name}</span>
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => {
                                                        // Redirect to add account? Or just close
                                                        setShowLaunchMenu(false);
                                                        // Maybe trigger add account modal if passed?
                                                    }}
                                                    className="w-full px-3 py-2 text-center text-xs text-slate-500 hover:text-slate-300 border-t border-slate-800/50 mt-1"
                                                >
                                                    Manage Accounts
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Active Instances Menu */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowRunningMenu(!showRunningMenu)}
                                        className={`h-full px-4 rounded-xl border transition-all flex items-center justify-center shrink-0 ${showRunningMenu ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                                        title="View Running Instances"
                                    >
                                        <Activity size={20} className={showRunningMenu ? 'animate-pulse' : ''} />
                                        {runningInstances.length > 1 && (
                                            <span className="ml-2 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                {runningInstances.length}
                                            </span>
                                        )}
                                    </button>

                                    {showRunningMenu && (
                                        <div className="absolute bottom-full right-0 mb-3 w-72 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 backdrop-blur-xl">
                                            <div className="px-3 py-2 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Instances</span>
                                                {runningInstances.length > 0 && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-[10px] font-bold text-emerald-500 uppercase">{runningInstances.length} Active</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
                                                {runningInstances.length === 0 ? (
                                                    <div className="px-4 py-8 text-center">
                                                        <p className="text-xs text-slate-500 italic">No instances running</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {runningInstances.map(inst => (
                                                            <div key={inst.id} className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors group">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div className="w-8 h-8 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5">
                                                                        {inst.username ? (
                                                                            <img
                                                                                src={`https://minotar.net/avatar/${inst.username}/64`}
                                                                                alt=""
                                                                                className="w-full h-full"
                                                                            />
                                                                        ) : inst.icon ? (
                                                                            <img src={inst.icon} alt="" className="w-full h-full" />
                                                                        ) : (
                                                                            <User size={16} className="text-slate-500" />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-sm font-bold text-slate-200 truncate">{inst.name}</span>
                                                                        <span className="text-[10px] text-emerald-400 font-medium truncate">as {inst.username || 'Unknown'}</span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        window.electronAPI.stopGame(inst.id);
                                                                    }}
                                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                                    title="Kill Process"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {runningInstances.length > 1 && (
                                                            <button
                                                                onClick={() => {
                                                                    onStop();
                                                                    setShowRunningMenu(false);
                                                                }}
                                                                className="w-full text-center py-2.5 text-[10px] font-bold text-red-400 border-t border-white/5 hover:bg-red-500/10 transition-colors uppercase tracking-[0.2em] mt-1"
                                                            >
                                                                Terminate All
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Close Running Menu if clicking outside */}
                                {showRunningMenu && (
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowRunningMenu(false)}
                                    />
                                )}

                                {/* Close Launch Menu if clicking outside */}
                                {showLaunchMenu && (
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowLaunchMenu(false)}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Last Played - Only for Simple/Vanilla layout as it's inline for Horizontal Modded */}
                    {!isHorizontalLayout && (
                        <p className="mt-6 text-slate-500 text-sm font-medium">
                            {t('home_last_harvested')} {lastPlayedText}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InstanceHero;
