import React, { useState, useEffect } from 'react';
import { Edit3 } from 'lucide-react';
import BackgroundBlobs from '../components/common/BackgroundBlobs';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

// Imported Sub-components
import AccountProfile from '../components/home/AccountProfile';
import InstanceHero from '../components/home/InstanceHero';
import ModsList from '../components/home/ModsList';
import ResourcePacksList from '../components/home/ResourcePacksList';
import EmptyState from '../components/home/EmptyState';
import QuickSwitchPanel from '../components/home/QuickSwitchPanel';

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
    onBrowseMods, // New prop
    // Account System Props
    accounts,
    onSwitchAccount,
    onAddAccount,
    onLogout,
    showProfileMenu,
    setShowProfileMenu,
    disableAnimations,
    theme
}) => {
    const { t } = useTranslation();
    const { addToast: showToast } = useToast();

    const [installedMods, setInstalledMods] = useState([]);
    const [isLoadingMods, setIsLoadingMods] = useState(false);
    const [resourcePacks, setResourcePacks] = useState(null);
    const [isLoadingResourcePacks, setIsLoadingResourcePacks] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).map(f => f.path).filter(p => p.endsWith('.jar'));
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).map(f => f.path).filter(p => p.endsWith('.zip'));
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
                setInstalledMods([]);
            }
        }
    }, [selectedInstance]);

    if (!selectedInstance) {
        return <EmptyState onNewCrop={onNewCrop} />;
    }

    const isModded = selectedInstance.loader !== 'Vanilla';

    return (
        <div className={`flex-1 flex flex-col relative animate-in fade-in zoom-in-95 duration-500 select-none overflow-hidden ${isModded ? 'justify-start' : 'justify-center'}`}>
            {/* Dynamic Background */}
            {/* Dynamic Background */}
            {!['midnight', 'white'].includes(theme) && (
                <div
                    className={`absolute inset-0 bg-gradient-to-br ${selectedInstance.bgGradient} transition-colors duration-1000`}
                />
            )}
            <div className="absolute inset-0 bg-[url('/cubes.png')] opacity-5" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />

            {/* Animated Blobs */}
            <BackgroundBlobs disabled={disableAnimations || isModded || ['midnight', 'white'].includes(theme)} />

            {/* Account Pill & System - Top Right */}
            <AccountProfile
                activeAccount={activeAccount}
                accounts={accounts}
                showProfileMenu={showProfileMenu}
                setShowProfileMenu={setShowProfileMenu}
                onSwitchAccount={onSwitchAccount}
                onAddAccount={onAddAccount}
                onLogout={onLogout}
            />

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

                <InstanceHero
                    selectedInstance={selectedInstance}
                    launchStatus={launchStatus}
                    launchFeedback={launchFeedback}
                    onPlay={onPlay}
                    onStop={onStop}
                    theme={theme}
                />

                {/* Modded Details Section */}
                {isModded && (
                    <div className="w-full max-w-7xl mx-auto px-8 pb-32 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-100">

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
                        />

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
                        />
                    </div>
                )}
            </div>
            {/* Quick Switch Panel */}
            <QuickSwitchPanel
                instances={instances}
                selectedInstance={selectedInstance}
                setSelectedInstance={setSelectedInstance}
                onManageAll={onManageAll}
                onNewCrop={onNewCrop}
            />
        </div>
    );
};

export default HomeView;
