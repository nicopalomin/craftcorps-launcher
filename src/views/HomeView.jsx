import React, { useRef, useEffect, useState } from 'react';
import { Sprout, Play, Loader2, X, ChevronRight, Plus, Edit3, Server, LogOut, PlusCircle, Check, Box, Layers, Cpu, CheckCircle, RefreshCw } from 'lucide-react';
import QuickSelectCard from '../components/common/QuickSelectCard';
import BackgroundBlobs from '../components/common/BackgroundBlobs';
import PlayerAvatar from '../components/common/PlayerAvatar';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { formatLastPlayed } from '../utils/dateUtils';

const HomeView = ({
    selectedInstance,
    launchStatus,
    launchFeedback,
    onPlay,
    onStop,
    activeAccount,
    instances,
    onManageAll,
    setSelectedInstance,
    onNewCrop,
    onEditCrop,
    // Account System Props
    accounts,
    onSwitchAccount,
    onAddAccount,
    onLogout,
    showProfileMenu,
    setShowProfileMenu,
    disableAnimations
}) => {
    const { t } = useTranslation();
    const profileMenuRef = useRef(null);

    // Close profile menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setShowProfileMenu]);

    const { showToast } = useToast();
    const [installedMods, setInstalledMods] = useState([]);
    const [isLoadingMods, setIsLoadingMods] = useState(false);
    const [resourcePacks, setResourcePacks] = useState(null);
    const [isLoadingResourcePacks, setIsLoadingResourcePacks] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleAddMods = async (filePaths = null) => {
        if (!selectedInstance?.path || !window.electronAPI) return;

        let files = filePaths;
        if (!files) {
            files = await window.electronAPI.selectModFiles();
        }

        if (files && files.length > 0) {
            setIsLoadingMods(true);
            showToast(t('Adding mods...'), 'info');
            try {
                // Timeout logic to prevent hanging
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), 15000));

                const result = await Promise.race([
                    window.electronAPI.addInstanceMods(selectedInstance.path, files),
                    timeoutPromise
                ]);

                if (result.success) {
                    showToast(t('Successfully added {{count}} mods', { count: result.added }), 'success');
                    if (result.addedMods && result.addedMods.length > 0) {
                        setInstalledMods(prev => {
                            const prevWithoutNew = prev.filter(existing => !result.addedMods.some(newMod => newMod.path === existing.path));
                            return [...result.addedMods, ...prevWithoutNew];
                        });
                    }
                } else {
                    showToast(result.error || t('Failed to add mods'), 'error');
                }

                if (result.errors && result.errors.length > 0) {
                    showToast(result.errors[0], 'warning');
                }
            } catch (e) {
                console.error(e);
                showToast(e.message || t('Error adding mods'), 'error');
            } finally {
                setIsLoadingMods(false);
            }
        }
    };

    const handleRefreshMods = async () => {
        if (!selectedInstance?.path || !window.electronAPI) return;
        setIsLoadingMods(true);
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timed out')), 5000));
            const mods = await Promise.race([
                window.electronAPI.getInstanceMods(selectedInstance.path),
                timeoutPromise
            ]);
            setInstalledMods(mods);
        } catch (e) {
            console.error(e);
            showToast(t('Failed to refresh mods'), 'error');
        } finally {
            setIsLoadingMods(false);
        }
    };

    const handleRefreshResourcePacks = async () => {
        if (!selectedInstance?.path || !window.electronAPI) return;
        setIsLoadingResourcePacks(true);
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timed out')), 5000));
            const packs = await Promise.race([
                window.electronAPI.getInstanceResourcePacks(selectedInstance.path),
                timeoutPromise
            ]);
            setResourcePacks(packs);
        } catch (e) {
            console.error(e);
            showToast(t('Failed to refresh resource packs'), 'error');
        } finally {
            setIsLoadingResourcePacks(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        // Check if we really left the main container or entered a child (not reliable with just leave)
        // Usually safer to use a backdrop, but simple toggle often works if carefully placed.
        // Actually, reliable drag leave usually requires counting enters/leaves or checking relatedTarget.
        // For now simple toggle:
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).map(f => f.path).filter(p => p.endsWith('.jar'));
            if (files.length > 0) {
                handleAddMods(files);
            } else {
                showToast('Please drop .jar files', 'warning');
            }
        }
    };

    const handleDeleteMod = async (mod) => {
        if (!mod.path || !window.electronAPI) return;

        try {
            const result = await window.electronAPI.deleteMod(mod.path);
            if (result.success) {
                setInstalledMods(prev => prev.filter(m => m.path !== mod.path));
                showToast(t('Mod deleted'), 'success');
            } else {
                showToast(result.error || t('Failed to delete mod'), 'error');
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (selectedInstance && selectedInstance.loader !== 'Vanilla') {
            if (window.electronAPI && selectedInstance.path) {
                setIsLoadingMods(true);
                window.electronAPI.getInstanceMods(selectedInstance.path)
                    .then(mods => setInstalledMods(mods))
                    .catch(err => {
                        console.error("Failed to load mods:", err);
                        setInstalledMods([]);
                    })
                    .finally(() => setIsLoadingMods(false));

                setIsLoadingResourcePacks(true);
                window.electronAPI.getInstanceResourcePacks(selectedInstance.path)
                    .then(packs => setResourcePacks(packs))
                    .catch(err => {
                        console.error("Failed to load resource packs:", err);
                        setResourcePacks([]);
                    })
                    .finally(() => setIsLoadingResourcePacks(false));
            } else {
                setInstalledMods([]); // No path or no API -> use fallback/mock
            }
        }
    }, [selectedInstance]);

    if (!selectedInstance) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Sprout size={48} className="mb-4 opacity-50" />
                <p>{t('home_no_crops')}</p>
                <button onClick={onNewCrop} className="mt-4 text-emerald-500 hover:underline">
                    {t('home_btn_create_first')}
                </button>
            </div>
        );
    }

    const isModded = selectedInstance.loader !== 'Vanilla';

    return (
        <div className={`flex-1 flex flex-col relative animate-in fade-in zoom-in-95 duration-500 select-none overflow-hidden ${isModded ? 'justify-start' : 'justify-center'}`}>
            {/* Dynamic Background */}
            <div
                className={`absolute inset-0 bg-gradient-to-br ${selectedInstance.bgGradient} transition-colors duration-1000`}
            />
            <div className="absolute inset-0 bg-[url('/cubes.png')] opacity-5" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />

            {/* Animated Blobs */}
            <BackgroundBlobs disabled={disableAnimations || isModded} />

            {/* Account Pill & System - Top Right */}
            <div className="absolute top-8 right-8 z-50 pointer-events-auto" ref={profileMenuRef}>
                <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className={`flex items-center gap-3.5 bg-slate-950/80 backdrop-blur-xl border transition-all duration-300 cursor-pointer group pl-1.5 pr-5 py-1.5 rounded-full shadow-2xl shadow-black/40 ${showProfileMenu
                        ? 'border-emerald-500/50 ring-4 ring-emerald-500/10'
                        : 'border-white/10 hover:border-emerald-500/40 hover:bg-slate-900/90'
                        }`}
                >
                    <div className={`w-10 h-10 rounded-full ${activeAccount?.avatarColor || 'bg-slate-600'} flex items-center justify-center shadow-inner relative ring-2 ring-white/5 group-hover:ring-emerald-500/30 transition-all`}>
                        <PlayerAvatar name={activeAccount?.name} uuid={activeAccount?.uuid} />
                        {/* Status Dot */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-[2.5px] border-slate-900 rounded-full shadow-sm"></div>
                    </div>

                    <div className="flex flex-col items-start gap-0.5">
                        <span className="font-bold text-[15px] text-slate-100 group-hover:text-white transition-colors leading-none tracking-tight">
                            {activeAccount?.name}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded leading-none border border-emerald-500/10">
                            {activeAccount?.type}
                        </span>
                    </div>

                    <ChevronRight
                        size={14}
                        className={`text-slate-500 group-hover:text-slate-300 transition-transform duration-300 ml-1 ${showProfileMenu ? 'rotate-90' : ''}`}
                    />
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Account List */}
                        <div className="p-2 space-y-1">
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                Login Identities
                                <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded text-[10px]">
                                    {accounts?.length || 0}
                                </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {accounts?.map(acc => (
                                    <button
                                        key={acc.id}
                                        onClick={() => { onSwitchAccount(acc); setShowProfileMenu(false); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${activeAccount?.id === acc.id
                                            ? 'bg-emerald-600 text-white shadow-emerald-900/20 shadow-lg'
                                            : 'hover:bg-slate-800 text-slate-300'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded-full ${acc.avatarColor} flex items-center justify-center text-[10px] font-bold shadow-sm relative`}>
                                            <PlayerAvatar name={acc.name} uuid={acc.uuid} size={32} />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="truncate text-sm font-medium">{acc.name}</div>
                                        </div>
                                        {activeAccount?.id === acc.id && <Check size={14} className="text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-2 bg-slate-950/50 border-t border-slate-800 space-y-1">
                            <button
                                onClick={() => { onAddAccount(); setShowProfileMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-medium group"
                            >
                                <PlusCircle size={14} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                Add Another Account
                            </button>
                            <button
                                onClick={() => { onLogout(); setShowProfileMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium group"
                            >
                                <LogOut size={14} className="text-slate-500 group-hover:text-red-400 transition-colors" />
                                Log Out
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Button - positioned under profile */}
            <button
                onClick={() => onEditCrop(selectedInstance)}
                className="absolute top-24 right-8 flex items-center gap-2 px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent hover:border-slate-700 transition-all backdrop-blur-sm z-40 group"
                title={t('home_edit_crop')}
            >
                <Edit3 size={18} className="group-hover:text-emerald-400 transition-colors" />
                <span className="font-medium text-sm">{t('home_edit_crop')}</span>
            </button>

            {/* Main Content Scrollable Area */}
            <div className={`relative z-10 flex-1 w-full overflow-y-auto custom-scrollbar ${isModded ? '' : 'flex flex-col items-center justify-center'}`}>

                {/* Hero Section */}
                <div className={`flex flex-col items-center text-center w-full px-8 pb-8 ${isModded ? 'pt-16 max-w-7xl mx-auto' : 'max-w-4xl'}`}>

                    {/* Horizontal Hero for Modded */}
                    <div className={`${isModded ? 'flex items-start gap-12 w-full text-left bg-slate-900/40 p-10 rounded-3xl border border-white/5 backdrop-blur-sm shadow-xl' : 'contents'}`}>

                        {/* Instance Icon */}
                        <div
                            className={`${isModded ? 'w-32 h-32 shrink-0' : 'w-32 h-32 mb-8'} rounded-3xl ${selectedInstance.iconColor} flex items-center justify-center text-slate-900 shadow-2xl shadow-black/50 transform hover:scale-105 transition-transform duration-300 ring-4 ring-white/10`}
                        >
                            <Sprout size={64} />
                        </div>

                        {/* Info & Play */}
                        <div className={isModded ? 'flex-1 min-w-0' : 'contents'}>
                            {/* Title */}
                            <h1 className={`${isModded ? 'text-4xl mb-4' : 'text-5xl mb-2'} font-bold text-white tracking-tight drop-shadow-lg truncate`}>
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
                                        <button
                                            onClick={onPlay}
                                            className={`group relative w-full max-w-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-[0_0_40px_rgba(5,150,105,0.4)] hover:shadow-[0_0_60px_rgba(5,150,105,0.6)] transform hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-[transform,box-shadow,background-color] duration-200 overflow-hidden flex items-center ring-offset-2 ring-offset-transparent group-hover:ring-2 group-hover:ring-emerald-400/30 ${isModded ? 'py-5 text-2xl justify-between text-left px-8' : 'py-6 text-2xl justify-center gap-3'}`}
                                        >
                                            {/* Shiny Edge Overlay */}
                                            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 group-hover:ring-white/30 transition-all pointer-events-none" />

                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                            <span className="flex items-center gap-4">
                                                <Play size={isModded ? 28 : 32} fill="currentColor" />
                                                <span className="flex flex-col items-start leading-none gap-1">
                                                    <span>{t('home_playing')}</span>
                                                    {isModded && <span className="text-xs font-medium text-emerald-200 opacity-80 font-sans tracking-wide">Last Played: {formatLastPlayed(selectedInstance.lastPlayed, t)}</span>}
                                                </span>
                                            </span>
                                            {isModded && <ChevronRight size={24} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
                                        </button>
                                    )
                                ) : (
                                    <button
                                        onClick={onStop}
                                        className="w-full max-w-sm bg-slate-800 border-2 border-slate-700 text-slate-300 hover:text-white hover:border-red-500/50 hover:bg-red-500/10 py-5 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3"
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

                {/* Modded Details Section */}
                {isModded && (
                    <div className="w-full max-w-7xl mx-auto px-8 pb-32 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-100">

                        {/* Mods Box */}
                        <div
                            className={`bg-slate-900/40 border transition-colors rounded-3xl p-6 backdrop-blur-sm flex flex-col h-[500px] relative ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5'}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                        <Box size={20} />
                                    </div>
                                    Installed Mods
                                    <span className="text-xs font-medium bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
                                        {isLoadingMods ? '...' : (installedMods.length > 0 ? installedMods.length : (selectedInstance.mods?.length || 0))}
                                    </span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleRefreshMods}
                                        className={`p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors ${isLoadingMods ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title="Refresh Mods"
                                        disabled={isLoadingMods}
                                    >
                                        <RefreshCw size={20} className={isLoadingMods ? 'animate-spin' : ''} />
                                    </button>
                                    <button
                                        onClick={() => handleAddMods(null)}
                                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/30 rounded-xl transition-all active:scale-95 flex items-center justify-center"
                                        title="Add Mod"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 relative">
                                {isLoadingMods ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                                        <span className="text-sm font-medium">Scanning mods...</span>
                                    </div>
                                ) : (
                                    <>
                                        {(() => {
                                            const mods = installedMods.length > 0 ? installedMods : (selectedInstance.mods || []);
                                            return mods.length > 0 ? (
                                                mods.map((mod, idx) => (
                                                    <div key={idx} className="bg-slate-950/50 hover:bg-slate-900/80 border border-white/5 p-3 rounded-xl flex items-center justify-between transition-colors group">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${mod.enabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-600'}`}>
                                                                <Cpu size={16} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className={`font-medium text-sm truncate ${mod.enabled ? 'text-slate-200' : 'text-slate-500 decoration-slate-600 line-through'}`}>{mod.name}</div>
                                                                {mod.version && <div className="text-xs text-slate-500 font-mono truncate mr-2">{mod.version}</div>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                            {mod.enabled ? <span className="text-emerald-500 text-xs font-medium bg-emerald-500/10 px-2 py-0.5 rounded">Enabled</span> : <span className="text-slate-500 text-xs">Disabled</span>}
                                                            {mod.path && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteMod(mod);
                                                                    }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                    title="Delete Mod"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center text-slate-500 py-12 flex flex-col items-center gap-2">
                                                    <Box size={32} className="opacity-20" />
                                                    <p>No mods detected</p>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>

                            {isDragging && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 rounded-3xl backdrop-blur-sm pointer-events-none border-2 border-indigo-500 border-dashed">
                                    <div className="flex flex-col items-center gap-4 text-indigo-400">
                                        <PlusCircle size={48} />
                                        <span className="text-xl font-bold">Drop JARs to Install</span>
                                    </div>
                                </div>
                            )}
                        </div>


                        {/* Resource Packs Box */}
                        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm flex flex-col h-[500px]">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                                        <Layers size={20} />
                                    </div>
                                    Resource Packs
                                    <span className="text-xs font-medium bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
                                        {isLoadingResourcePacks ? '...' : (resourcePacks !== null ? resourcePacks.length : (selectedInstance.resourcePacks?.length || 0))}
                                    </span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleRefreshResourcePacks}
                                        className={`p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors ${isLoadingResourcePacks ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title="Refresh Resource Packs"
                                        disabled={isLoadingResourcePacks}
                                    >
                                        <RefreshCw size={20} className={isLoadingResourcePacks ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 relative">
                                {isLoadingResourcePacks ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                                        <Loader2 size={32} className="animate-spin text-pink-500" />
                                        <span className="text-sm font-medium">Scanning packs...</span>
                                    </div>
                                ) : (
                                    <>
                                        {(() => {
                                            const packs = resourcePacks !== null ? resourcePacks : (selectedInstance.resourcePacks || []);
                                            return packs.length > 0 ? (
                                                packs.map((pack, idx) => (
                                                    <div key={idx} className="bg-slate-950/50 hover:bg-slate-900/80 border border-white/5 p-3 rounded-xl flex items-center justify-between transition-colors group">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="w-12 h-12 shrink-0 rounded-lg bg-slate-800 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-cover flex items-center justify-center opacity-80 border border-white/5 overflow-hidden">
                                                                {pack.icon ? (
                                                                    <img src={pack.icon} alt={pack.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Layers size={20} className="text-slate-600" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className={`font-medium text-sm truncate ${pack.enabled ? 'text-slate-200' : 'text-slate-400'}`}>{pack.name}</div>
                                                                <div className="text-xs text-slate-500 truncate">{pack.description || (pack.enabled ? 'Active' : 'Inactive')}</div>
                                                            </div>
                                                        </div>
                                                        {pack.enabled && <CheckCircle size={16} className="text-emerald-500 shrink-0" />}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center text-slate-500 py-12 flex flex-col items-center gap-2">
                                                    <Layers size={32} className="opacity-20" />
                                                    <p>No resource packs</p>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        </div>

                    </div >
                )}
            </div >

            {/* Quick Switcher Carousel */}
            < div className="absolute bottom-8 left-0 right-0 px-8 z-20 pointer-events-none" >
                <div className="max-w-4xl mx-auto pointer-events-auto bg-slate-900/50 backdrop-blur-md p-3 rounded-3xl border border-white/10 shadow-2xl transition-all hover:bg-slate-900/70">
                    <div className="flex items-center justify-between mb-3 px-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('home_quick_switch')}
                        </span>
                        <button
                            onClick={onManageAll}
                            className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                        >
                            {t('home_manage_all')} <ChevronRight size={12} />
                        </button>
                    </div>

                    <div
                        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mask-linear-fade w-full snap-x snap-mandatory"
                        onWheel={(e) => {
                            if (e.deltaY !== 0) {
                                e.currentTarget.scrollLeft += e.deltaY;
                            }
                        }}
                    >
                        {instances?.map((inst) => (
                            <QuickSelectCard
                                key={inst.id}
                                instance={inst}
                                isSelected={selectedInstance?.id === inst.id}
                                onClick={() => setSelectedInstance(inst)}
                            />
                        ))}

                        {launchStatus === 'running' ? (
                            <button
                                onClick={onStop}
                                className="w-full py-4 rounded-xl bg-red-500/10 border border-red-500/50 hover:bg-red-500/20 text-red-500 font-bold uppercase tracking-wide transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-500/10 flex items-center justify-center gap-2"
                            >
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                {t('home_stop_game')}
                            </button>
                        ) : (
                            <button
                                onClick={onNewCrop}
                                className="flex-shrink-0 w-12 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-slate-900 transition-colors"
                                aria-label="Create new crop"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div >
        </div >
    );

};

export default HomeView;
