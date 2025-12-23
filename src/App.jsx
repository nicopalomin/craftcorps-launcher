import React, { useState, useEffect } from 'react';
import { Terminal, Maximize2, Minimize2, X, User } from 'lucide-react';

import Sidebar from './components/layout/Sidebar';
import ConsoleOverlay from './components/common/ConsoleOverlay';
import LaunchOverlay from './components/common/LaunchOverlay';
import LoadingScreen from './components/common/LoadingScreen';
import CropModal from './components/modals/CropModal';
import LoginModal from './components/modals/LoginModal';

import HomeView from './views/HomeView';
import InstancesView from './views/InstancesView';
import WardrobeView from './views/WardrobeView';
import SettingsView from './views/SettingsView';
import ModsView from './views/ModsView';

import { SKINS } from './data/mockData';

import { useGameLaunch } from './hooks/useGameLaunch';
import { useInstances } from './hooks/useInstances';
import { useAccounts } from './hooks/useAccounts';

function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [ram, setRam] = useState(4);
    const [hideOnLaunch, setHideOnLaunch] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    // Simulate app initialization
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

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

    const {
        launchStatus,
        launchProgress,
        launchStep,
        launchFeedback,
        showConsole,
        setShowConsole,
        logs,
        handlePlay,
        handleStop
    } = useGameLaunch(selectedInstance, ram, activeAccount, () => updateLastPlayed(selectedInstance?.id), hideOnLaunch);

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">

            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                accounts={accounts}
                activeAccount={activeAccount}
                onSwitchAccount={handleAccountSwitch}
                onAddAccount={() => { setShowLoginModal(true); setShowProfileMenu(false); }}
                showProfileMenu={showProfileMenu}
                setShowProfileMenu={setShowProfileMenu}
                onLogout={handleLogout}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative overflow-hidden">

                {/* Custom Window Title Bar (Drag Region) */}
                <header className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4 z-50 select-none drag">
                    <div className="flex items-center gap-2 text-xs text-slate-500 no-drag">
                        <span>CraftCrops Launcher v1.0.2</span>
                        {launchStatus === 'running' && <span className="text-emerald-500 flex items-center gap-1">● Game Running</span>}
                    </div>
                    <div className="flex items-center gap-4 no-drag">
                        {launchStatus !== 'idle' && (
                            <button
                                onClick={() => setShowConsole(true)}
                                className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
                            >
                                <Terminal size={12} /> Console
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
                <div className="flex-1 flex flex-col relative pt-10"> {/* Added pt-10 for header space */}

                    {activeTab === 'home' && (
                        !activeAccount ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                <User size={48} className="mb-4 opacity-50" />
                                <p>No account selected.</p>
                                <button
                                    onClick={() => setShowLoginModal(true)}
                                    className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-500 transition-colors"
                                >
                                    Sign In
                                </button>
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
                            />
                        )
                    )}
                    {activeTab === 'instances' && (
                        <InstancesView
                            instances={instances}
                            onSelectInstance={(inst) => { setSelectedInstance(inst); setActiveTab('home'); }}
                            onEditCrop={handleEditCrop}
                            onDeleteCrop={handleDeleteCrop}
                            onNewCrop={handleNewCrop}
                            onReorder={reorderInstances}
                        />
                    )}
                    {activeTab === 'wardrobe' && <WardrobeView skins={SKINS} />}
                    {activeTab === 'settings' && <SettingsView ram={ram} setRam={setRam} hideOnLaunch={hideOnLaunch} setHideOnLaunch={setHideOnLaunch} />}
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
                onAddAccount={handleAddAccount}
            />

            {/* Crop (Edit/Create) Modal */}
            <CropModal
                isOpen={showCropModal}
                onClose={() => setShowCropModal(false)}
                onSave={handleSaveCrop}
                editingCrop={editingCrop}
            />

        </div>
    );
}

export default App;
