import React, { useState, useEffect } from 'react';
import { Terminal, Maximize2, Minimize2, X } from 'lucide-react';

import Sidebar from './components/layout/Sidebar';
import ConsoleOverlay from './components/common/ConsoleOverlay';
import CropModal from './components/modals/CropModal';
import LoginModal from './components/modals/LoginModal';

import HomeView from './views/HomeView';
import InstancesView from './views/InstancesView';
import WardrobeView from './views/WardrobeView';
import SettingsView from './views/SettingsView';
import ModsView from './views/ModsView';

import { INITIAL_INSTANCES, MOCK_ACCOUNTS } from './data/mockData';

function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [instances, setInstances] = useState(INITIAL_INSTANCES);
    const [selectedInstance, setSelectedInstance] = useState(INITIAL_INSTANCES[0]);
    const [launchStatus, setLaunchStatus] = useState('idle'); // idle, launching, running
    const [showConsole, setShowConsole] = useState(false);
    const [logs, setLogs] = useState([]);
    const [ram, setRam] = useState(4);

    // Account State
    const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
    const [activeAccount, setActiveAccount] = useState(MOCK_ACCOUNTS[0]);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Edit Crop State
    const [showCropModal, setShowCropModal] = useState(false);
    const [editingCrop, setEditingCrop] = useState(null);

    // Sync selected instance status if it was edited
    useEffect(() => {
        // Only attempt to sync if we have a selected instance
        if (selectedInstance && instances.length > 0) {
            const updatedSelected = instances.find(i => i.id === selectedInstance.id);
            if (updatedSelected) {
                setSelectedInstance(updatedSelected);
            }
        }
    }, [instances, selectedInstance]);

    // Simulation for Launching
    const handlePlay = () => {
        if (launchStatus !== 'idle') return;

        setLaunchStatus('launching');
        setShowConsole(true);
        setLogs([]);

        const steps = [
            { msg: `Authenticating as ${activeAccount.name}...`, type: "INFO", delay: 200 },
            { msg: "Authentication successful (Session ID: 8f9a...)", type: "INFO", delay: 500 },
            { msg: "Loading libraries...", type: "INFO", delay: 800 },
            { msg: "Verifying assets for " + selectedInstance.version, type: "INFO", delay: 1200 },
            { msg: "Downloading missing dependencies...", type: "INFO", delay: 2000 },
            { msg: "Allocating 4096MB RAM...", type: "WARN", delay: 2800 },
            { msg: "Starting Java Runtime Environment", type: "INFO", delay: 3500 },
            { msg: "Constructing mods...", type: "INFO", delay: 4200 },
            { msg: "Sound engine started", type: "INFO", delay: 4800 },
            { msg: "Rendering setup complete", type: "INFO", delay: 5500 },
            { msg: "GAME WINDOW OPENED", type: "INFO", delay: 6000 },
        ];

        let currentStep = 0;

        const interval = setInterval(() => {
            if (currentStep >= steps.length) {
                clearInterval(interval);
                setLaunchStatus('running');
                return;
            }
            const step = steps[currentStep];
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

            setLogs(prev => [...prev, { time: timeStr, type: step.type, message: step.msg }]);
            currentStep++;
        }, 600);
    };

    const handleStop = () => {
        setLaunchStatus('idle');
        setLogs(prev => [...prev, { time: "Now", type: "INFO", message: "Process terminated by user." }]);
        setTimeout(() => setShowConsole(false), 1000);
    };

    const handleAccountSwitch = (account) => {
        setActiveAccount(account);
        setShowProfileMenu(false);
    };

    const handleAddAccount = (newAccount) => {
        const updatedAccounts = [...accounts, { ...newAccount, id: `acc_${Date.now()}` }];
        setAccounts(updatedAccounts);
        setActiveAccount(updatedAccounts[updatedAccounts.length - 1]);
        setShowLoginModal(false);
    };

    const handleSaveCrop = (cropData) => {
        if (editingCrop) {
            // Update existing
            setInstances(prev => prev.map(inst => inst.id === cropData.id ? { ...inst, ...cropData } : inst));
        } else {
            // Create new
            setInstances(prev => [...prev, cropData]);
        }
    };

    const handleDeleteCrop = (id) => {
        const newInstances = instances.filter(i => i.id !== id);
        setInstances(newInstances);

        // If we deleted the currently selected one, fallback to first available or null
        if (selectedInstance && selectedInstance.id === id) {
            setSelectedInstance(newInstances.length > 0 ? newInstances[0] : null);
        }
    };

    const handleNewCrop = () => {
        setEditingCrop(null);
        setShowCropModal(true);
    };

    const handleEditCrop = (inst) => {
        setEditingCrop(inst);
        setShowCropModal(true);
    };

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
                onLogout={() => { /* Implement Logout logic */ }}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative overflow-hidden">

                {/* Custom Window Title Bar (Drag Region) */}
                <header className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4 z-50 select-none pointer-events-none">
                    <div className="flex items-center gap-2 text-xs text-slate-500 pointer-events-auto">
                        <span>CraftCrops Launcher v1.0.2</span>
                        {launchStatus === 'running' && <span className="text-emerald-500 flex items-center gap-1">● Game Running</span>}
                    </div>
                    <div className="flex items-center gap-4 pointer-events-auto">
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
                        <HomeView
                            selectedInstance={selectedInstance}
                            launchStatus={launchStatus}
                            onPlay={handlePlay}
                            onStop={handleStop}
                            activeAccount={activeAccount}
                            instances={instances}
                            onManageAll={() => setActiveTab('instances')}
                            setSelectedInstance={setSelectedInstance}
                            onNewCrop={handleNewCrop}
                        />
                    )}

                    {activeTab === 'instances' && (
                        <InstancesView
                            instances={instances}
                            onEditCrop={handleEditCrop}
                            onDeleteCrop={handleDeleteCrop}
                            onSelectInstance={(inst) => { setSelectedInstance(inst); setActiveTab('home'); }}
                            onNewCrop={handleNewCrop}
                        />
                    )}

                    {activeTab === 'wardrobe' && <WardrobeView />}

                    {activeTab === 'settings' && <SettingsView ram={ram} setRam={setRam} />}

                    {activeTab === 'mods' && <ModsView />}

                </div>
            </main>

            {/* Console Overlay */}
            <ConsoleOverlay
                isOpen={showConsole}
                onClose={() => setShowConsole(false)}
                logs={logs}
            />

            {/* Login Modal */}
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
