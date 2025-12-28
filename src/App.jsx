import React, { useState, useEffect } from 'react';
import { Terminal, Maximize2, Minimize2, X, User } from 'lucide-react';

import Sidebar from './components/layout/Sidebar';
import ConsoleOverlay from './components/common/ConsoleOverlay';
import LaunchOverlay from './components/common/LaunchOverlay';
import LoadingScreen from './components/common/LoadingScreen';
import BackgroundBlobs from './components/common/BackgroundBlobs';
import CropModal from './components/modals/CropModal';
import LoginModal from './components/modals/LoginModal';
import JavaInstallModal from './components/modals/JavaInstallModal';
import ErrorModal from './components/modals/ErrorModal';

import HomeView from './views/HomeView';
import InstancesView from './views/InstancesView';
import WardrobeView from './views/WardrobeView';
import SettingsView from './views/SettingsView';
import ModsView from './views/ModsView';

import { SKINS } from './data/mockData';

import { useGameLaunch } from './hooks/useGameLaunch';
import { useInstances } from './hooks/useInstances';
import { useAccounts } from './hooks/useAccounts';
import { useToast } from './contexts/ToastContext';
import { useTranslation } from 'react-i18next';

function App() {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('home');
    const [ram, setRam] = useState(() => {
        return parseFloat(localStorage.getItem('settings_ram')) || 4;
    });
    const [javaPath, setJavaPath] = useState(() => {
        return localStorage.getItem('settings_javaPath') || "C:\\Program Files\\Java\\jdk-17.0.2\\bin\\javaw.exe";
    });
    const [hideOnLaunch, setHideOnLaunch] = useState(() => {
        return localStorage.getItem('settings_hideOnLaunch') === 'true';
    });
    const [disableAnimations, setDisableAnimations] = useState(() => {
        return localStorage.getItem('settings_disableAnimations') === 'true';
    });
    const [enableDiscordRPC, setEnableDiscordRPC] = useState(() => {
        const stored = localStorage.getItem('settings_enableDiscordRPC');
        return stored !== null ? stored === 'true' : true; // Default true
    });
    const [availableJavas, setAvailableJavas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshJavas = async () => {
        if (window.electronAPI) {
            try {
                const javas = await window.electronAPI.getAvailableJavas();
                setAvailableJavas(javas);
            } catch (e) {
                console.error("Failed to list Javas", e);
            }
        }
    };

    // Simulate app initialization + Load Javas
    useEffect(() => {
        const init = async () => {
            await refreshJavas();

            if (window.electronAPI) {
                // Listen for auto-detected java updates
                window.electronAPI.onJavaPathUpdated((newPath) => {
                    console.log("Received Java Path Update:", newPath);
                    setJavaPath(newPath);
                    addToast(t('toast_java_updated', { defaultValue: "Java path updated automatically" }), 'info');
                    refreshJavas(); // Refresh list so the new path appears
                });
            }
            setTimeout(() => {
                setIsLoading(false);
            }, 1000);
        };
        init();

        return () => {
            if (window.electronAPI && window.electronAPI.removeJavaPathListener) {
                window.electronAPI.removeJavaPathListener();
            }
        };
    }, []);

    // Persist Settings
    useEffect(() => {
        localStorage.setItem('settings_ram', ram);
        localStorage.setItem('settings_javaPath', javaPath);
        localStorage.setItem('settings_hideOnLaunch', hideOnLaunch);
        localStorage.setItem('settings_disableAnimations', disableAnimations);
        localStorage.setItem('settings_enableDiscordRPC', enableDiscordRPC);
    }, [ram, javaPath, hideOnLaunch, disableAnimations, enableDiscordRPC]);



    // Hooks
    const {
        accounts,
        activeAccount,
        showProfileMenu,
        setShowProfileMenu,
        showLoginModal,
        setShowLoginModal,
        handleAccountSwitch,
        handleAddAccount,
        handleLogout
    } = useAccounts();

    const {
        instances,
        selectedInstance,
        setSelectedInstance,
        editingCrop,
        setEditingCrop,
        showCropModal,
        setShowCropModal,
        handleSaveCrop,
        handleDeleteCrop,
        handleNewCrop,
        handleEditCrop,
        updateLastPlayed,
        reorderInstances
    } = useInstances();

    // Wrapped Handlers for Toasts
    const onSaveCropWithToast = (crop) => {
        handleSaveCrop(crop);
        addToast(editingCrop ? t('toast_crop_updated') : t('toast_crop_created'), 'success');
    };

    const onDeleteCropWithToast = (id) => {
        handleDeleteCrop(id);
        addToast(t('toast_crop_deleted'), 'info');
    };

    const onAddAccountWithToast = (account) => {
        handleAddAccount(account);
        addToast(`${t('toast_welcome')}, ${account.name}!`, 'success');
    };

    const onLogoutWithToast = () => {
        handleLogout();
        addToast(t('toast_logout'), 'info');
    };

    const onAccountSwitchWithToast = (account) => {
        handleAccountSwitch(account);
        addToast(`Switched to ${account.name}`, 'info');
    }

    const {
        launchStatus,
        launchProgress,
        launchStep,
        launchFeedback,
        showConsole,
        setShowConsole,
        logs,
        handlePlay,
        handleStop,
        showJavaModal,
        setShowJavaModal,
        handleJavaInstallComplete,
        requiredJavaVersion,
        errorModal,
        setErrorModal
    } = useGameLaunch(selectedInstance, ram, activeAccount, () => updateLastPlayed(selectedInstance?.id), hideOnLaunch, javaPath, setJavaPath);

    // Update Discord RPC based on activeTab
    useEffect(() => {
        if (!window.electronAPI?.setDiscordActivity) return;

        // Don't update status from frontend if game is launching or running
        // The backend handles the "In Game" status
        if (launchStatus === 'launching' || launchStatus === 'running') return;

        if (!enableDiscordRPC) {
            window.electronAPI.clearDiscordActivity();
            return;
        }

        let stateText = 'Idling';
        let detailsText = 'In Launcher';

        switch (activeTab) {
            case 'home':
                stateText = 'Dashboard';
                break;
            case 'instances':
                stateText = 'Managing Instances';
                break;
            case 'wardrobe':
                stateText = 'Changing Skin';
                break;
            case 'settings':
                stateText = 'Configuring Settings';
                break;
            case 'mods':
                stateText = 'Browsing Mods';
                break;
            default:
                stateText = 'Idling';
        }

        window.electronAPI.setDiscordActivity({
            details: detailsText,
            state: stateText,
            largeImageKey: 'icon',
            largeImageText: 'CraftCorps Launcher',
            instance: false,
        });

    }, [activeTab, launchStatus, enableDiscordRPC]);

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">

            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative overflow-hidden">

                {/* Custom Window Title Bar (Drag Region) */}
                <header className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4 z-50 select-none drag">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>CraftCorps Launcher v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}</span>
                        {launchStatus === 'running' && <span className="text-emerald-500 flex items-center gap-1">● {t('top_bar_running')}</span>}
                    </div>
                    <div className="flex items-center gap-4 no-drag">
                        {launchStatus !== 'idle' && (
                            <button
                                onClick={() => setShowConsole(true)}
                                className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
                            >
                                <Terminal size={12} /> {t('top_bar_console')}
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => window.electronAPI?.minimize()}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400"
                            >
                                <Minimize2 size={14} />
                            </button>
                            <button
                                onClick={() => window.electronAPI?.maximize()}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400"
                            >
                                <Maximize2 size={14} />
                            </button>
                            <button
                                onClick={() => window.electronAPI?.close()}
                                className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-slate-400"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main View Container */}
                <div className="flex-1 flex flex-col relative pt-10 overflow-hidden"> {/* Added pt-10 for header space */}

                    {activeTab === 'home' && (
                        !activeAccount ? (
                            <div className="flex-1 flex flex-col items-center justify-center relative select-none overflow-hidden">
                                {/* Background */}
                                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
                                <BackgroundBlobs disabled={disableAnimations} />

                                {/* Content Card */}
                                <div className="relative z-10 w-full max-w-sm mx-auto p-8 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/5 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
                                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-6 rotate-6 transform hover:rotate-0 transition-all duration-500 group cursor-pointer">
                                        <User size={40} className="text-white drop-shadow-md" />
                                    </div>

                                    <h2 className="text-3xl font-bold text-white mb-3">{t('home_welcome_back')}</h2>
                                    <p className="text-slate-400 mb-8 leading-relaxed text-sm">
                                        {t('home_connect_identity')}
                                    </p>

                                    <button
                                        onClick={() => setShowLoginModal(true)}
                                        className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-500 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 group border border-emerald-500/50"
                                    >
                                        <div className="bg-emerald-700/50 p-1.5 rounded-lg group-hover:bg-emerald-600/50 transition-colors">
                                            <User size={18} className="text-emerald-100" />
                                        </div>
                                        <span>{t('home_btn_connect')}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <HomeView
                                selectedInstance={selectedInstance}
                                launchStatus={launchStatus}
                                launchFeedback={launchFeedback}
                                onPlay={handlePlay}
                                onStop={handleStop}
                                activeAccount={activeAccount}
                                instances={instances}
                                onManageAll={() => setActiveTab('instances')}
                                setSelectedInstance={setSelectedInstance}
                                onNewCrop={handleNewCrop}
                                onEditCrop={handleEditCrop}
                                // Account System Props
                                accounts={accounts}
                                onSwitchAccount={onAccountSwitchWithToast}
                                onAddAccount={() => { setShowLoginModal(true); setShowProfileMenu(false); }}
                                onLogout={onLogoutWithToast}
                                showProfileMenu={showProfileMenu}
                                setShowProfileMenu={setShowProfileMenu}
                                disableAnimations={disableAnimations}
                            />
                        )
                    )}
                    {activeTab === 'instances' && (
                        <InstancesView
                            instances={instances}
                            onSelectInstance={(inst) => { setSelectedInstance(inst); setActiveTab('home'); }}
                            onEditCrop={handleEditCrop}
                            onDeleteCrop={onDeleteCropWithToast}
                            onNewCrop={handleNewCrop}
                            onReorder={reorderInstances}
                        />
                    )}
                    {activeTab === 'wardrobe' && <WardrobeView skins={SKINS} />}
                    {activeTab === 'settings' && (
                        <SettingsView
                            ram={ram}
                            setRam={setRam}
                            javaPath={javaPath}
                            setJavaPath={setJavaPath}
                            hideOnLaunch={hideOnLaunch}
                            setHideOnLaunch={setHideOnLaunch}
                            disableAnimations={disableAnimations}
                            setDisableAnimations={setDisableAnimations}
                            availableJavas={availableJavas}
                            enableDiscordRPC={enableDiscordRPC}
                            setEnableDiscordRPC={setEnableDiscordRPC}
                        />
                    )}
                    {activeTab === 'mods' && <ModsView />}

                </div>
            </main>

            {/* Overlays */}
            <ConsoleOverlay
                logs={logs}
                isOpen={showConsole}
                onClose={() => setShowConsole(false)}
            />

            <LaunchOverlay
                isOpen={launchStatus === 'launching'}
                status={launchStep}
                progress={launchProgress}
                instanceName={selectedInstance?.name}
                onCancel={handleStop}
            />

            <LoginModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                onAddAccount={onAddAccountWithToast}
            />

            {/* Crop (Edit/Create) Modal */}
            <CropModal
                isOpen={showCropModal}
                onClose={() => setShowCropModal(false)}
                onSave={onSaveCropWithToast}
                editingCrop={editingCrop}
            />

            <JavaInstallModal
                isOpen={showJavaModal}
                onClose={() => setShowJavaModal(false)}
                onInstallComplete={(path) => {
                    handleJavaInstallComplete(path);
                    refreshJavas();
                }}
                version={requiredJavaVersion}
            />

            <ErrorModal
                isOpen={!!errorModal}
                onClose={() => setErrorModal(null)}
                error={errorModal}
            />
        </div>
    );
}

export default App;
