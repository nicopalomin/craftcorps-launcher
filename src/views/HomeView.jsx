import React, { useState, useEffect } from 'react';
import { Paintbrush, Box, Layers, Settings, Aperture, Globe, Pencil } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

// Imported Sub-components
import AccountProfile from '../components/home/AccountProfile';
import InstanceHero from '../components/home/InstanceHero';
import ModsList from '../components/home/ModsList';
import ResourcePacksList from '../components/home/ResourcePacksList';
import ShadersList from '../components/home/ShadersList';
import EmptyState from '../components/home/EmptyState';
import QuickSwitchPanel from '../components/home/QuickSwitchPanel';
import ServerSwitchPanel from '../components/home/ServerSwitchPanel';
import HomeSkeleton from '../components/home/HomeSkeleton';
import { useWardrobe } from '../hooks/useWardrobe';
import Cape2DRender from '../components/common/Cape2DRender';

const HomeView = ({
    selectedInstance,
    launchStatus,
    launchStep,
    launchProgress,
    launchFeedback,
    onPlay,
    onStop,
    activeAccount,
    instances,
    onManageAll,
    setSelectedInstance,
    onNewCrop,
    onEditCrop,
    onBrowseMods, // New prop
    onBrowseShaders, // New prop
    // Account System Props
    accounts,
    onSwitchAccount,
    onAddAccount,
    onLogout,
    showProfileMenu,
    setShowProfileMenu,
    disableAnimations,
    theme,
    isLoadingInstances,
    runningInstances,
    launchCooldown,
    onSaveCrop,
    setActiveTab
}) => {
    const { t } = useTranslation();
    const { addToast: showToast } = useToast();
    const { activeCosmetics, isLoadingCosmetics, refreshCosmetics } = useWardrobe(activeAccount);

    useEffect(() => {
        // Give time for backend caches and auth state to settle
        const timer = setTimeout(() => {
            if (activeAccount) {
                refreshCosmetics();
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [activeAccount]);

    const [installedMods, setInstalledMods] = useState([]);
    const [isLoadingMods, setIsLoadingMods] = useState(false);
    const [resourcePacks, setResourcePacks] = useState(null);
    const [isLoadingResourcePacks, setIsLoadingResourcePacks] = useState(false);
    const [installedShaders, setInstalledShaders] = useState(null);
    const [isLoadingShaders, setIsLoadingShaders] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('mods');
    const [showQuickSwitch, setShowQuickSwitch] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(() => {
        const saved = localStorage.getItem('home_showAdvanced');
        return saved === 'true';
    });
    const lastScrollY = React.useRef(0);

    // Persist showAdvanced
    useEffect(() => {
        localStorage.setItem('home_showAdvanced', showAdvanced);
    }, [showAdvanced]);

    // Handlers
    const handleAddMods = async (filePaths = null) => {
        if (!selectedInstance?.path || !window.electronAPI) {
            showToast(t('Error: Configuration missing'), 'error');
            return;
        }

        let files = filePaths;
        if (!files) {
            try {
                files = await window.electronAPI.selectModFiles();
            } catch (err) {
                console.error(err);
                return;
            }
        }

        if (files && Array.isArray(files) && files.length > 0) {
            showToast(t('Adding mods...'), 'info');

            try {
                const result = await window.electronAPI.addInstanceMods(selectedInstance.path, files);

                if (result.success) {
                    if (result.added > 0) {
                        showToast(t('Successfully added {{count}} mods', { count: result.added }), 'success');
                    }

                    // Optimistic update
                    if (result.addedMods && Array.isArray(result.addedMods)) {
                        setInstalledMods(prev => {
                            if (!Array.isArray(prev)) return result.addedMods;
                            const prevPaths = new Set(prev.map(m => m.path));
                            const newMods = result.addedMods.filter(m => !prevPaths.has(m.path));
                            return [...newMods, ...prev];
                        });
                    }
                } else {
                    showToast(result.error || t('Failed to add mods'), 'error');
                }

                if (result.errors && result.errors.length > 0) {
                    result.errors.slice(0, 3).forEach(err => showToast(`Skipped: ${err}`, 'warning'));
                    if (result.errors.length > 3) {
                        showToast(`${result.errors.length} files skipped (check console)`, 'warning');
                    }
                }

            } catch (e) {
                console.error(e);
                showToast(e.message || t('Error adding mods'), 'error');
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
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!window.electronAPI || !window.electronAPI.getPathForFile) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files)
                .map(f => window.electronAPI.getPathForFile(f))
                .filter(p => p && p.toLowerCase().endsWith('.jar'));

            if (files.length > 0) {
                handleAddMods(files);
            } else {
                showToast('Please drop .jar files', 'warning');
            }
        }
    };

    const handleAddResourcePacks = async (filePaths = null) => {
        if (!selectedInstance?.path || !window.electronAPI) {
            showToast(t('Error: Configuration missing'), 'error');
            return;
        }

        let files = filePaths;
        if (!files) {
            try {
                files = await window.electronAPI.selectResourcePackFiles();
            } catch (err) {
                console.error(err);
                return;
            }
        }

        if (files && Array.isArray(files) && files.length > 0) {
            showToast('Adding resource packs...', 'info');

            try {
                const result = await window.electronAPI.addInstanceResourcePacks(selectedInstance.path, files);

                if (result.success) {
                    if (result.added > 0) {
                        showToast(`Successfully added ${result.added} resource packs`, 'success');
                    }

                    // Optimistic update
                    if (result.addedPacks && Array.isArray(result.addedPacks)) {
                        setResourcePacks(prev => {
                            if (!Array.isArray(prev)) return result.addedPacks;
                            const prevPaths = new Set(prev.map(p => p.path));
                            const newPacks = result.addedPacks.filter(p => !prevPaths.has(p.path));
                            return [...newPacks, ...prev];
                        });
                    }
                } else {
                    showToast(result.error || 'Failed to add resource packs', 'error');
                }

                if (result.errors && result.errors.length > 0) {
                    result.errors.slice(0, 3).forEach(err => showToast(err, 'warning'));
                    if (result.errors.length > 3) {
                        showToast(`${result.errors.length} file skipped (check console)`, 'warning');
                    }
                }

            } catch (e) {
                console.error(e);
                showToast(e.message || 'Error adding resource packs', 'error');
            }
        }
    };

    const handleResourcePackDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!window.electronAPI || !window.electronAPI.getPathForFile) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files)
                .map(f => window.electronAPI.getPathForFile(f))
                .filter(p => p && p.toLowerCase().endsWith('.zip'));

            if (files.length > 0) {
                handleAddResourcePacks(files);
            } else {
                showToast('Please drop .zip files for resource packs', 'warning');
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

    const handleDeleteResourcePack = async (pack) => {
        if (!pack.path || !window.electronAPI) return;

        try {
            const result = await window.electronAPI.deleteResourcePack(pack.path);
            if (result.success) {
                setResourcePacks(prev => (prev || []).filter(p => p.path !== pack.path));
                showToast('Resource pack deleted', 'success');
            } else {
                showToast(result.error || 'Failed to delete resource pack', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error deleting resource pack', 'error');
        }
    };

    // Shaders Handlers
    const handleAddShaders = async (filePaths = null) => {
        if (!selectedInstance?.path || !window.electronAPI) {
            showToast(t('Error: Configuration missing'), 'error');
            return;
        }

        let files = filePaths;
        if (!files) {
            try {
                files = await window.electronAPI.selectShaderFiles();
            } catch (err) {
                console.error(err);
                return;
            }
        }

        if (files && Array.isArray(files) && files.length > 0) {
            showToast('Adding shaders...', 'info');

            try {
                const result = await window.electronAPI.addInstanceShaders(selectedInstance.path, files);

                if (result.success) {
                    if (result.added > 0) {
                        showToast(`Successfully added ${result.added} shaders`, 'success');
                    }
                    // Optimistic update
                    if (result.addedShaders && Array.isArray(result.addedShaders)) {
                        setInstalledShaders(prev => {
                            if (!Array.isArray(prev)) return result.addedShaders;
                            const prevPaths = new Set(prev.map(p => p.path));
                            const newShaders = result.addedShaders.filter(p => !prevPaths.has(p.path));
                            return [...newShaders, ...prev];
                        });
                    }
                } else {
                    showToast(result.error || 'Failed to add shaders', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast(e.message || 'Error adding shaders', 'error');
            }
        }
    };

    const handleRefreshShaders = async () => {
        if (!selectedInstance?.path || !window.electronAPI) return;
        setIsLoadingShaders(true);
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timed out')), 5000));
            const shaders = await Promise.race([
                window.electronAPI.getInstanceShaders(selectedInstance.path),
                timeoutPromise
            ]);
            setInstalledShaders(shaders);
        } catch (e) {
            console.error(e);
            showToast('Failed to refresh shaders', 'error');
        } finally {
            setIsLoadingShaders(false);
        }
    };

    const handleDeleteShader = async (shader) => {
        if (!shader.path || !window.electronAPI) return;
        try {
            const result = await window.electronAPI.deleteShader(shader.path);
            if (result.success) {
                setInstalledShaders(prev => (prev || []).filter(p => p.path !== shader.path));
                showToast('Shader deleted', 'success');
            } else {
                showToast(result.error || 'Failed to delete shader', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error deleting shader', 'error');
        }
    };

    const handleShaderDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!window.electronAPI || !window.electronAPI.getPathForFile) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files)
                .map(f => window.electronAPI.getPathForFile(f))
                .filter(p => p && p.toLowerCase().endsWith('.zip'));

            if (files.length > 0) {
                handleAddShaders(files);
            } else {
                showToast('Please drop .zip files for shaders', 'warning');
            }
        }
    };

    const handleScroll = (e) => {
        const currentScrollY = e.target.scrollTop;

        // Show if at the very top or scrolling up
        if (currentScrollY < 50 || currentScrollY < lastScrollY.current) {
            setShowQuickSwitch(true);
        } else if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
            // Hide if scrolling down and past the top area
            setShowQuickSwitch(false);
        }

        lastScrollY.current = currentScrollY;
    };

    // Lazy Load Mods on Scroll
    const modsSectionRef = React.useRef(null);
    const [hasLoadedMods, setHasLoadedMods] = useState(false);

    useEffect(() => {
        setInstalledMods([]);
        setResourcePacks([]);
        setInstalledShaders([]);
        setHasLoadedMods(false);

        // Immediately trigger metadata load for modded instances to avoid "0 mods" text
        if (selectedInstance && selectedInstance.loader !== 'Vanilla') {
            handleRefreshMods();
            // We can keep these lazy or trigger them too
            handleRefreshResourcePacks();
            handleRefreshShaders();
            setHasLoadedMods(true);
        }
    }, [selectedInstance]); // No need to add handleRefresh... because they are stable or we want them fresh

    useEffect(() => {
        if (!selectedInstance || selectedInstance.loader === 'Vanilla' || hasLoadedMods) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                // Trigger load
                setHasLoadedMods(true);
                handleRefreshMods();
                handleRefreshResourcePacks();
                handleRefreshShaders();
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        if (modsSectionRef.current) {
            observer.observe(modsSectionRef.current);
        }

        return () => observer.disconnect();
    }, [selectedInstance, hasLoadedMods]);

    // Listener for background updates (Lazy Load)
    useEffect(() => {
        if (!selectedInstance || !window.electronAPI) return;

        const handleUpdate = (data) => {
            if (data.instancePath === selectedInstance.path) {
                console.log('[Home] Background mods updated');
                setInstalledMods(data.mods);
            }
        };

        if (window.electronAPI.onInstanceModsUpdated) {
            window.electronAPI.onInstanceModsUpdated(handleUpdate);
        }

        return () => {
            if (window.electronAPI.removeInstanceModsListener) {
                window.electronAPI.removeInstanceModsListener();
            }
        };
    }, [selectedInstance]);

    const isModded = selectedInstance && selectedInstance.loader !== 'Vanilla';

    return (
        <div className={`flex-1 flex flex-col select-none overflow-hidden h-full`}>

            {/* Top Section: Content & Backgrounds */}
            <div className={`flex-1 flex relative overflow-hidden ${isModded && showAdvanced ? 'justify-start' : 'justify-center'}`}>
                {/* Voxel Blueprint Layer */}
                <div className="isometric-grid opacity-60" />

                {/* Background Depth */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(30,41,59,0.4),_transparent_70%)] pointer-events-none" />

                {/* Top Right Control Cluster (Account + Actions) */}
                <div className="absolute top-8 right-8 flex flex-col items-end gap-3 z-50 pointer-events-none">
                    {/* Profile Widget */}
                    <div className="glass-spotlight p-2 rounded-2xl shadow-2xl relative z-[100] pointer-events-auto">
                        <AccountProfile
                            activeAccount={activeAccount}
                            accounts={accounts}
                            showProfileMenu={showProfileMenu}
                            setShowProfileMenu={setShowProfileMenu}
                            onSwitchAccount={onSwitchAccount}
                            onAddAccount={onAddAccount}
                            onLogout={onLogout}
                        />
                    </div>
                </div>

                {/* Main Content Area - Split View */}
                <div className="flex-1 flex overflow-hidden relative z-10 pt-12 pl-8">
                    {/* Left Column: Hero & Greetings */}
                    <div className="flex-1 flex flex-col items-start gap-6 min-w-0 pr-12 overflow-y-auto custom-scrollbar pb-12">
                        {selectedInstance ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                                <div className="flex flex-col gap-2 w-full">
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        Continue Playing
                                    </h4>
                                    <InstanceHero
                                        selectedInstance={selectedInstance}
                                        launchStatus={launchStatus}
                                        launchStep={launchStep}
                                        launchProgress={launchProgress}
                                        launchFeedback={launchFeedback}
                                        onPlay={onPlay}
                                        onStop={onStop}
                                        theme={theme}
                                        isAdvanced={showAdvanced}
                                        setShowAdvanced={setShowAdvanced}
                                        onEditCrop={onEditCrop}
                                        accounts={accounts}
                                        activeAccount={activeAccount}
                                        runningInstances={runningInstances}
                                        launchCooldown={launchCooldown}
                                        allowOverflow={false}
                                        modCount={installedMods?.length || 0}
                                        onSaveCrop={onSaveCrop}
                                        setShowProfileMenu={setShowProfileMenu}
                                    />
                                </div>

                                {/* Section: Server Bar */}
                                {!showAdvanced && (
                                    <div className="flex flex-col gap-4 w-full mt-3">
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <div className="flex flex-col gap-0.5">
                                                <h4 className="text-xl font-bold text-white tracking-tight">Continue on Servers</h4>
                                                <p className="text-sm text-slate-500 font-medium">
                                                    Join with <span className="font-bold text-slate-300">{selectedInstance?.name}</span> instance
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setActiveTab('discover')}
                                                className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-white/10 transition-all group"
                                            >
                                                <span className="text-xs font-bold uppercase tracking-wider">Show more on Discovery</span>
                                                <Globe size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                        </div>
                                        <ServerSwitchPanel
                                            selectedInstance={selectedInstance}
                                            onJoinServer={(server) => {
                                                const launchParams = { ...selectedInstance, autoConnect: true, serverAddress: server.ip };
                                                onPlay(launchParams);
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                )}

                                {/* Section: Active Cosmetics */}
                                {!showAdvanced && selectedInstance && (
                                    <div className="flex flex-col gap-4 w-full mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <div className="flex flex-col gap-0.5">
                                                <h4 className="text-xl font-bold text-white tracking-tight">Active Cosmetics</h4>
                                                <p className="text-sm text-slate-500 font-medium">Customize how others see you!</p>
                                            </div>
                                            <button
                                                onClick={() => setActiveTab('wardrobe')}
                                                className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-white/10 transition-all group"
                                            >
                                                <span className="text-xs font-bold uppercase tracking-wider">Customize in Wardrobe</span>
                                                <Pencil size={14} className="group-hover:scale-110 transition-transform" />
                                            </button>
                                        </div>

                                        {/* The Widget Card */}
                                        <div className="bg-slate-900/30 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                                                {isLoadingCosmetics ? (
                                                    // Loading Skeletons
                                                    [...Array(4)].map((_, i) => (
                                                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/20 border border-white/5 animate-pulse">
                                                            <div className="w-12 h-12 rounded-xl bg-slate-800/50 shrink-0" />
                                                            <div className="flex flex-col gap-2 flex-1">
                                                                <div className="h-4 w-24 bg-slate-800/50 rounded" />
                                                                <div className="h-3 w-16 bg-slate-800/30 rounded" />
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (activeCosmetics && activeCosmetics.length > 0 ? (
                                                    activeCosmetics.map(cosmetic => (
                                                        <div
                                                            key={cosmetic.id}
                                                            className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:border-emerald-500/30 transition-all group relative overflow-hidden"
                                                        >
                                                            <div className="w-12 h-12 rounded-xl bg-slate-950/60 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
                                                                {cosmetic.texture ? (
                                                                    (cosmetic.type || '').toLowerCase() === 'cape' ? (
                                                                        <Cape2DRender
                                                                            capeUrl={cosmetic.texture}
                                                                            scale={3}
                                                                            className="w-auto h-full drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                                                                        />
                                                                    ) : (
                                                                        <img src={cosmetic.texture} alt={cosmetic.name} className="w-full h-full object-contain" />
                                                                    )
                                                                ) : (
                                                                    <Box size={24} className="text-slate-600" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-sm font-bold text-white truncate leading-tight mb-0.5">{cosmetic.name}</span>
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{cosmetic.type || 'Cosmetic'}</span>
                                                            </div>
                                                            <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />

                                                            {/* Subtle Background Glow on Hover */}
                                                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div
                                                        className="col-span-full flex items-center gap-6 p-10 rounded-3xl bg-white/5 border border-dashed border-white/10 group hover:border-white/20 transition-all cursor-pointer"
                                                        onClick={() => setActiveTab('wardrobe')}
                                                    >
                                                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-all">
                                                            <Box size={28} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <p className="text-lg font-bold text-slate-400 group-hover:text-slate-200 transition-colors">No active cosmetics</p>
                                                            <p className="text-sm text-slate-500">Equip items in the wardrobe to see them here.</p>
                                                        </div>
                                                        <div className="ml-auto text-xs font-bold text-emerald-500/60 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                            Open Wardrobe →
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Modded Details Section */}
                                <div className={`w-full transition-all duration-700 ease-in-out ${isModded && showAdvanced ? 'opacity-100 max-h-[2000px] translate-y-0' : 'opacity-0 max-h-0 translate-y-20 overflow-hidden'}`}>
                                    {isModded && (
                                        <div ref={modsSectionRef} className="w-full mt-4">
                                            <div className="flex flex-col h-[750px] overflow-hidden relative bg-slate-900/50 border border-white/5 shadow-xl rounded-3xl">
                                                <div className="flex items-center justify-start px-6 pt-6 pb-4 border-b border-white/5">
                                                    <div className="flex gap-4">
                                                        {['mods', 'resourcepacks', 'shaders'].map(tab => (
                                                            <button
                                                                key={tab}
                                                                onClick={() => setActiveSubTab(tab)}
                                                                className={`text-sm font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors ${activeSubTab === tab ? 'text-white border-white' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                                            >
                                                                {tab}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex-1 overflow-hidden relative">
                                                    {activeSubTab === 'mods' && <ModsList installedMods={installedMods} selectedInstance={selectedInstance} isLoading={isLoadingMods} onRefresh={handleRefreshMods} onAdd={handleAddMods} onBrowse={onBrowseMods} onDelete={handleDeleteMod} isDraggingGlobal={isDragging} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} theme={theme} className="!bg-transparent !border-none !rounded-none !shadow-none !h-full !p-6" />}
                                                    {activeSubTab === 'resourcepacks' && <ResourcePacksList resourcePacks={resourcePacks} selectedInstance={selectedInstance} isLoading={isLoadingResourcePacks} onRefresh={handleRefreshResourcePacks} onAdd={handleAddResourcePacks} onDelete={handleDeleteResourcePack} isDraggingGlobal={isDragging} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleResourcePackDrop} theme={theme} className="!bg-transparent !border-none !rounded-none !shadow-none !h-full !p-6" />}
                                                    {activeSubTab === 'shaders' && <ShadersList shaders={installedShaders} selectedInstance={selectedInstance} isLoading={isLoadingShaders} onRefresh={handleRefreshShaders} onAdd={handleAddShaders} onBrowse={onBrowseShaders} onDelete={handleDeleteShader} isDraggingGlobal={isDragging} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleShaderDrop} theme={theme} className="!bg-transparent !border-none !rounded-none !shadow-none !h-full !p-6" />}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            isLoadingInstances ? null : <EmptyState onNewCrop={onNewCrop} />
                        )}
                    </div>
                </div>
            </div>

            {/* Baked Quick Switch at Bottom - Persistent Footer */}
            {selectedInstance && !showAdvanced && (
                <div className="flex-none z-[100]">
                    <QuickSwitchPanel
                        instances={instances}
                        selectedInstance={selectedInstance}
                        setSelectedInstance={setSelectedInstance}
                        onManageAll={onManageAll}
                        onNewCrop={onNewCrop}
                        className="w-full bg-slate-900/40 backdrop-blur-2xl shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.5)] border-t border-white/20 rounded-t-[2.5rem] rounded-b-none pt-8 pb-6 px-12 ring-1 ring-inset ring-white/5"
                    />
                </div>
            )}
        </div>
    );
};

export default HomeView;
