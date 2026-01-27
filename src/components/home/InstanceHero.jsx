import React, { useEffect, useState } from 'react';
import {
    Box, X, Play, Clock, Activity, Paintbrush, Settings, Folder, ExternalLink, Power, Plus
} from 'lucide-react';
import { formatLastPlayed } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { telemetry } from '../../services/TelemetryService';

const formatPlayTime = (ms) => {
    if (!ms) return '0m';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
};

const InstanceHero = React.memo(({
    selectedInstance,
    launchStatus,
    launchStep,
    launchProgress,
    onPlay,
    onStop,
    isAdvanced = false,
    setShowAdvanced,
    onEditCrop,
    launchCooldown = false,
    modCount = 0,
    runningInstances = [],
    accounts = []
}) => {
    const { t } = useTranslation();
    const [playTime, setPlayTime] = useState(0);
    const [showRunningPopover, setShowRunningPopover] = useState(false);
    const [showLaunchAsPopover, setShowLaunchAsPopover] = useState(false);
    const popoverRef = React.useRef(null);
    const launchAsRef = React.useRef(null);

    const heroBg = '/images/hero-bg.png';

    // Close popover on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setShowRunningPopover(false);
            }
            if (launchAsRef.current && !launchAsRef.current.contains(event.target)) {
                setShowLaunchAsPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        let active = true;
        const fetchTime = () => {
            if (selectedInstance) {
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
    }, [selectedInstance?.id, launchStatus]);

    const timeString = formatPlayTime(playTime);
    const isModdedContent = selectedInstance.loader !== 'Vanilla';
    const lastPlayedText = selectedInstance.lastPlayed ? formatLastPlayed(selectedInstance.lastPlayed) : 'Never';

    return (
        <div className="flex flex-col items-start w-full py-4">
            {/* "Greetings!" Header */}
            <div className="mb-6 flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-white tracking-tight">Greetings!</h1>
                <p className="text-slate-400 text-sm">Here are your worlds/servers enjoy!</p>
            </div>

            {/* The Main Card Widget - Dashboard Style */}
            <div
                className="relative w-full h-[352px] rounded-[2rem] overflow-hidden shadow-2xl group border border-white/10 transition-all duration-300 bg-slate-900"
            >
                {/* Background Image Layer */}
                <div
                    className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                    style={{
                        backgroundImage: `url(${heroBg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />

                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent opacity-80" />

                {/* Content Container */}
                <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">

                    {/* Header Section */}
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                {isModdedContent && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/10">
                                        {selectedInstance.loader}
                                    </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-wider border border-white/5">
                                    {selectedInstance.version}
                                </span>
                            </div>
                            <h2 className="text-4xl font-extrabold text-white leading-none tracking-tight shadow-black drop-shadow-lg">
                                {selectedInstance.name}
                            </h2>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mt-1">
                                <span>Last played: {lastPlayedText}</span>
                            </div>
                        </div>

                        {/* Top Right Cluster within card */}
                        <div className="flex flex-col items-end gap-3">
                            {launchStatus === 'running' && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border bg-emerald-500/20 border-emerald-500/30 text-emerald-400">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase">Running</span>
                                </div>
                            )}

                            {/* Control Cluster */}
                            <div className="flex gap-2">
                                {isModdedContent && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowAdvanced(!isAdvanced); }}
                                        className={`p-3 rounded-xl border transition-all group ${isAdvanced ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:text-indigo-400'}`}
                                        title="Toggle Details"
                                    >
                                        <Settings size={16} className={`opacity-70 group-hover:opacity-100 ${isAdvanced ? 'text-indigo-400' : ''}`} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEditCrop(selectedInstance); }}
                                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:text-emerald-400 transition-all group"
                                    title="Customize"
                                >
                                    <Paintbrush size={16} className="opacity-70 group-hover:opacity-100" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Stats */}
                    <div className="flex items-end gap-12 mb-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Playtime</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white font-mono">{timeString}</span>
                            </div>
                        </div>

                        {isModdedContent && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Mods Loaded</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-white font-mono">{modCount}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Row */}
                    <div className="flex items-center justify-between w-full gap-4">
                        {/* Left Group: Play & Secondary Actions */}
                        <div className="flex items-center gap-3">
                            {/* Main Play / Launch Button */}
                            <div className="max-w-sm flex flex-col gap-2 min-w-[320px]">
                                {(launchStatus === 'launching' || launchStatus === 'loading_window') ? (
                                    <div className="w-full flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                                        {/* Progress Card */}
                                        <div className="w-full bg-slate-800/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl relative overflow-hidden">
                                            {/* Shimmer Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />

                                            <div className="flex items-center gap-4 relative z-10 w-full">
                                                {/* Spinner */}
                                                <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                                                    <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
                                                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                                                </div>

                                                {/* Text Info */}
                                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        Preparing Game Environment
                                                    </span>
                                                    <div className="flex items-baseline justify-between w-full">
                                                        <span className="text-sm font-bold text-white truncate pr-2">
                                                            {launchStep || 'Initializing...'}
                                                        </span>
                                                        <span className="text-sm font-bold text-emerald-500 font-mono">
                                                            {Math.round(launchProgress || 0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden relative z-10">
                                                <div
                                                    className="h-full bg-emerald-500 transition-all duration-300 ease-out flex items-center justify-end relative"
                                                    style={{ width: `${launchProgress || 0}%` }}
                                                >
                                                    <div className="h-full w-4 bg-white/20 absolute right-0" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cancel Button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onStop(); }}
                                            className="w-full py-2 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 text-xs font-bold uppercase tracking-widest transition-all"
                                        >
                                            Cancel Launch
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        disabled={launchCooldown}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (launchStatus === 'running') {
                                                onStop();
                                            } else {
                                                telemetry.track('CLICK_PLAY', { instanceId: selectedInstance.id });
                                                onPlay(selectedInstance);
                                            }
                                        }}
                                        className={`w-full h-[71px] rounded-2xl font-extrabold text-xl flex items-center justify-center gap-4 transition-all duration-500 shadow-xl overflow-hidden group ${launchStatus === 'running'
                                            ? 'btn-premium-red'
                                            : (launchCooldown ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'btn-premium-emerald text-white')
                                            }`}
                                    >
                                        <div className="flex items-center gap-4 z-10 relative">
                                            {launchStatus === 'running' ? (
                                                <>
                                                    <X size={28} strokeWidth={3} />
                                                    <span className="flex flex-col items-start leading-none tracking-wider">
                                                        <span>STOP</span>
                                                        <span className="text-[10px] font-bold text-red-100/70 font-sans tracking-[0.1em] mt-1 uppercase">Running Now</span>
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    {launchCooldown ? <Clock size={28} className="animate-spin" /> : <Play size={28} fill="currentColor" strokeWidth={3} />}
                                                    <span className="flex flex-col items-start leading-none tracking-wider">
                                                        <span>{launchCooldown ? 'COOLDOWN' : 'PLAY NOW'}</span>
                                                        {!launchCooldown && (
                                                            <span className="text-[10px] font-bold text-emerald-50/70 font-sans tracking-[0.1em] mt-1 uppercase group-hover:text-white transition-colors text-left">
                                                                Start your harvest
                                                            </span>
                                                        )}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                )}
                            </div>

                            {/* Launch As Button */}
                            <div className="relative" ref={launchAsRef}>
                                <button
                                    onClick={() => setShowLaunchAsPopover(!showLaunchAsPopover)}
                                    className={`w-[71px] h-[71px] rounded-2xl border transition-all hover:scale-105 flex flex-col items-center justify-center gap-1 ${showLaunchAsPopover ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                    title="Launch As..."
                                >
                                    <Plus size={24} />
                                </button>

                                {showLaunchAsPopover && (
                                    <div className="absolute bottom-full left-0 mb-3 w-64 bg-[#0F172A]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                        <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Launch a new game as...</span>
                                        </div>
                                        <div className="p-2 max-h-64 overflow-y-auto flex flex-col gap-1">
                                            {accounts.filter(acc => acc.type === 'microsoft' || acc.type === 'offline').map((acc) => (
                                                <button
                                                    key={acc.id}
                                                    onClick={() => {
                                                        onPlay(selectedInstance, null, acc);
                                                        setShowLaunchAsPopover(false);
                                                    }}
                                                    className="w-full p-2 rounded-xl hover:bg-white/10 flex items-center gap-3 transition-colors text-left group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-white/10">
                                                        <img
                                                            src={`https://mc-heads.net/avatar/${acc.uuid || acc.name}/64`}
                                                            alt={acc.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.target.src = 'https://mc-heads.net/avatar/Steve/64'; }}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-bold text-white truncate group-hover:text-indigo-400 transition-colors">{acc.name}</span>
                                                        <span className="text-[10px] text-slate-500 truncate capitalize">{acc.type} Account</span>
                                                    </div>
                                                </button>
                                            ))}
                                            <div className="my-1 h-px bg-white/5" />
                                            <button
                                                className="w-full p-2 rounded-xl text-center text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                Manage Accounts
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 relative" ref={popoverRef}>
                                {/* Running Instances Badge */}
                                <button
                                    onClick={() => setShowRunningPopover(!showRunningPopover)}
                                    className={`w-[71px] h-[71px] rounded-2xl border transition-all hover:scale-105 relative flex flex-col items-center justify-center gap-1 ${showRunningPopover ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                    title="Active Instances"
                                >
                                    <Activity size={24} className={runningInstances.length > 0 ? 'animate-pulse' : ''} />
                                    {runningInstances.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-lg border-2 border-slate-900 animate-in zoom-in duration-300">
                                            {runningInstances.length}
                                        </span>
                                    )}
                                </button>

                                {/* Popover */}
                                {showRunningPopover && (
                                    <div className="absolute bottom-full left-0 mb-3 w-72 bg-[#0F172A]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                        <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Instances</span>
                                            {runningInstances.length > 0 && (
                                                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                    {runningInstances.length} Running
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-2 max-h-64 overflow-y-auto">
                                            {runningInstances.length === 0 ? (
                                                <div className="py-8 px-4 flex flex-col items-center justify-center gap-2 opacity-50">
                                                    <Activity size={32} className="text-slate-600" />
                                                    <span className="text-sm font-medium text-slate-400 whitespace-nowrap">No active instances</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    {runningInstances.map((inst) => (
                                                        <div key={inst.id || inst.gameDir} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 transition-all flex items-center justify-between group">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                    {inst.icon ? (
                                                                        <img src={inst.icon} alt={inst.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <Box size={16} className="text-slate-600" />
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-xs font-bold text-white truncate">{inst.name}</span>
                                                                    <span className="text-[10px] text-slate-500 truncate">{inst.username} • {inst.version}</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); window.electronAPI?.focusGame(inst.gameDir); }}
                                                                    className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                                                                    title="Focus Game"
                                                                >
                                                                    <ExternalLink size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); window.electronAPI?.stopGame(inst.id || inst.gameDir); }}
                                                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                                                    title="Stop Instance"
                                                                >
                                                                    <Power size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Group: Final Actions */}
                        <div className="flex items-center">
                            {/* Folder Button */}
                            <button
                                onClick={() => window.electronAPI.openPath(selectedInstance.path)}
                                className="w-[71px] h-[71px] rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-all hover:scale-105"
                                title="Open Folder"
                            >
                                <Folder size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
});

export default InstanceHero;
