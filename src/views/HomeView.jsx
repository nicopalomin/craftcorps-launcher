import React, { useState, useEffect } from 'react';
import { Paintbrush, Box, Layers, Settings, Aperture } from 'lucide-react';
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
import HomeSkeleton from '../components/home/HomeSkeleton';

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
    launchCooldown
}) => {
    const { t } = useTranslation();
    const { addToast: showToast } = useToast();

    const [installedMods, setInstalledMods] = useState([]);
    const [isLoadingMods, setIsLoadingMods] = useState(false);
    const [resourcePacks, setResourcePacks] = useState(null);
    const [isLoadingResourcePacks, setIsLoadingResourcePacks] = useState(false);
    const [installedShaders, setInstalledShaders] = useState(null);
    const [isLoadingShaders, setIsLoadingShaders] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState('mods');
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
        // We preserve showAdvanced state across instance switches
    }, [selectedInstance]);

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
        <div className={`flex-1 flex flex-col relative select-none overflow-hidden ${isModded && showAdvanced ? 'justify-start' : 'justify-center'}`}>

            {/* Top Right Control Cluster (Account + Actions) */}
            <div className="absolute top-8 right-8 flex flex-col items-end gap-3 z-50">
                {/* Profile Widget */}
                <div className="glass-spotlight p-2 rounded-full shadow-2xl relative z-[100]">
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

                {/* Actions Widget */}
                {selectedInstance && (
                    <div className="glass-spotlight p-2 rounded-2xl flex flex-col gap-1 w-48 shadow-2xl relative z-0">
                        <button
                            onClick={() => onEditCrop(selectedInstance)}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
                            title={t('customize', 'Customize')}
                        >
                            <span className="font-bold text-[11px] uppercase tracking-[0.15em]">Customize</span>
                            <Paintbrush size={14} className="group-hover:text-emerald-400 transition-colors opacity-70 group-hover:opacity-100" />
                        </button>

                        {isModded && (
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-all group ${showAdvanced
                                    ? 'text-white bg-indigo-500/20 border border-indigo-500/30'
                                    : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                                title={showAdvanced ? t('Hide Advanced') : t('Advanced Settings')}
                            >
                                <span className="font-bold text-[11px] uppercase tracking-[0.15em]">Edit</span>
                                <Settings size={14} className={`transition-colors opacity-70 group-hover:opacity-100 ${showAdvanced ? 'text-indigo-400' : 'group-hover:text-indigo-400'}`} />
                            </button>
                        )}
                    </div>
                )}

                {/* Quick Switch Panel - Right Side Vertical */}
                <QuickSwitchPanel
                    instances={instances}
                    selectedInstance={selectedInstance}
                    setSelectedInstance={setSelectedInstance}
                    onManageAll={onManageAll}
                    onNewCrop={onNewCrop}
                    className="mt-4"
                />
            </div>

            {/* Main Content Scrollable Area */}
            <div
                className="relative z-10 flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center transition-all duration-500"
                onScroll={handleScroll}
            >
                {/* Top Spacer - animates flex-grow to slide content up */}
                <div className={`w-full transition-all duration-500 ease-in-out ${(!isModded || !showAdvanced) ? 'flex-1 min-h-[10%]' : 'flex-none h-0'}`} />

                {selectedInstance ? (
                    <>
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
                            accounts={accounts}
                            runningInstances={runningInstances}
                            launchCooldown={launchCooldown}
                        />

                        {/* Modded Details Section */}
                        <div className={`w-full transition-all duration-700 ease-in-out ${isModded && showAdvanced ? 'opacity-100 max-h-[2000px] translate-y-0' : 'opacity-0 max-h-0 translate-y-20 overflow-hidden'}`}>
                            {isModded && (
                                <div ref={modsSectionRef} className="w-full max-w-7xl mx-auto px-8 pb-8 mt-4 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-100">
                                    {/* Unified Glass Card */}
                                    <div
                                        className={`flex flex-col h-[750px] overflow-hidden relative transition-all duration-300 ${theme === 'white' ? 'bg-white/90 border border-white/50 shadow-xl rounded-3xl' : 'bg-slate-950/80 border border-slate-800/50 shadow-2xl rounded-[2rem]'}`}
                                    >

                                        {/* Internal Tab Switcher */}
                                        <div className={`flex items-center justify-center pt-6 pb-4 border-b ${theme === 'white' ? 'border-slate-200 bg-slate-50/50' : 'border-white/5 bg-white/[0.02]'}`}>
                                            <div className={`flex p-1 rounded-xl border relative ${theme === 'white' ? 'bg-slate-200/50 border-slate-300/50' : 'bg-slate-950/50 border-white/10'}`}>
                                                <button
                                                    onClick={() => setActiveTab('mods')}
                                                    className={`relative px-8 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 min-w-[140px] z-10 ${activeTab === 'mods'
                                                        ? 'text-white bg-indigo-600 shadow-lg shadow-indigo-500/20'
                                                        : (theme === 'white' ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                                                        }`}
                                                >
                                                    <Box size={16} />
                                                    <span>Mods</span>
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('resourcepacks')}
                                                    className={`relative px-8 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 min-w-[140px] z-10 ${activeTab === 'resourcepacks'
                                                        ? 'text-white bg-pink-600 shadow-lg shadow-pink-500/20'
                                                        : (theme === 'white' ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                                                        }`}
                                                >
                                                    <Layers size={16} />
                                                    <span>Resource Packs</span>
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('shaders')}
                                                    className={`relative px-8 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 min-w-[140px] z-10 ${activeTab === 'shaders'
                                                        ? 'text-white bg-cyan-600 shadow-lg shadow-cyan-500/20'
                                                        : (theme === 'white' ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                                                        }`}
                                                >
                                                    <Aperture size={16} />
                                                    <span>Shaders</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="flex-1 overflow-hidden relative">
                                            {activeTab === 'mods' && (
                                                <ModsList
                                                    installedMods={installedMods}
                                                    selectedInstance={selectedInstance}
                                                    isLoading={isLoadingMods}
                                                    onRefresh={handleRefreshMods}
                                                    onAdd={handleAddMods}
                                                    onBrowse={onBrowseMods}
                                                    onDelete={handleDeleteMod}
                                                    isDraggingGlobal={isDragging}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                    theme={theme}
                                                    className="!bg-transparent !border-none !rounded-none !shadow-none !h-full !p-6 animate-in fade-in duration-300"
                                                />
                                            )}
                                            {activeTab === 'resourcepacks' && (
                                                <ResourcePacksList
                                                    resourcePacks={resourcePacks}
                                                    selectedInstance={selectedInstance}
                                                    isLoading={isLoadingResourcePacks}
                                                    onRefresh={handleRefreshResourcePacks}
                                                    onAdd={handleAddResourcePacks}
                                                    onDelete={handleDeleteResourcePack}
                                                    isDraggingGlobal={isDragging}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleResourcePackDrop}
                                                    theme={theme}
                                                    className="!bg-transparent !border-none !rounded-none !shadow-none !h-full !p-6 animate-in fade-in duration-300"
                                                />
                                            )}
                                            {activeTab === 'shaders' && (
                                                <ShadersList
                                                    shaders={installedShaders}
                                                    selectedInstance={selectedInstance}
                                                    isLoading={isLoadingShaders}
                                                    onRefresh={handleRefreshShaders}
                                                    onAdd={handleAddShaders}
                                                    onBrowse={onBrowseShaders}
                                                    onDelete={handleDeleteShader}
                                                    isDraggingGlobal={isDragging}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleShaderDrop}
                                                    theme={theme}
                                                    className="!bg-transparent !border-none !rounded-none !shadow-none !h-full !p-6 animate-in fade-in duration-300"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    isLoadingInstances ? null : <EmptyState onNewCrop={onNewCrop} />
                )}

                {/* Bottom Spacer - animates flex-grow to slide content up */}
                <div className={`w-full transition-all duration-500 ease-in-out ${(!isModded || !showAdvanced) ? 'flex-1 min-h-[10%]' : 'flex-none h-0'}`} />
            </div>
        </div>
    );
};

export default HomeView;
