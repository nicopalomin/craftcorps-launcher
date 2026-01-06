import React, { useState, useEffect } from 'react';

import Sidebar from './components/layout/Sidebar';
import TitleBar from './components/layout/TitleBar';
import AppContent from './components/layout/AppContent';
import AppOverlays from './components/layout/AppOverlays';

import { useGameLaunch } from './hooks/useGameLaunch';
import { useInstances } from './hooks/useInstances';
import { useAccounts } from './hooks/useAccounts';
import { useAppSettings } from './hooks/useAppSettings';
import { useToast } from './contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { telemetry } from './services/TelemetryService';

function App() {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('home');

    // Initialize Telemetry
    useEffect(() => {
        if (window.electronAPI) {
            const storeWrapper = {
                get: (key) => window.electronAPI?.storeGet?.(key),
                set: (key, val) => window.electronAPI?.storeSet?.(key, val)
            };

            telemetry.init(storeWrapper).then(() => {
                telemetry.track('APP_OPEN');
                telemetry.sendHardwareInfo();
            });
        }
    }, []);

    // Hooks
    const {
        ram, setRam,
        javaPath, setJavaPath,
        hideOnLaunch, setHideOnLaunch,
        disableAnimations, setDisableAnimations,
        enableDiscordRPC, setEnableDiscordRPC,
        theme, setTheme,
        availableJavas,
        refreshJavas
    } = useAppSettings();

    const {
        accounts,
        activeAccount,
        showProfileMenu,
        setShowProfileMenu,
        showLoginModal,
        setShowLoginModal,
        handleAccountSwitch,
        handleAddAccount,
        handleLogout,
        isRefreshing,
        authError
    } = useAccounts();

    const {
        instances,
        selectedInstance,
        setSelectedInstance,
        editingCrop,
        // setEditingCrop, // Not needed with the modal managed in layout? Actually AppOverlays needs it.
        // Wait, AppOverlays needs editingCrop to pass to CropModal?  Yes.
        // But useInstances should return it.
        // Let's check useInstances return values from previous file content.
        // Yes, it returns editingCrop.
        setEditingCrop, // Needed? useInstances handles this. 
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
        if (activeAccount?.id === account.id) return;
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
        setErrorModal,
        crashModal,
        setCrashModal
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
            case 'home': stateText = 'Dashboard'; break;
            case 'instances': stateText = 'Managing Instances'; break;
            case 'wardrobe': stateText = 'Changing Skin'; break;
            case 'settings': stateText = 'Configuring Settings'; break;
            case 'mods': stateText = 'Browsing Mods'; break;
            default: stateText = 'Idling';
        }

        window.electronAPI.setDiscordActivity({
            details: detailsText,
            state: stateText,
            largeImageKey: 'icon',
            largeImageText: 'CraftCorps Launcher',
            instance: false,
        });

    }, [activeTab, launchStatus, enableDiscordRPC]);

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative overflow-hidden">
                <TitleBar
                    launchStatus={launchStatus}
                    isRefreshing={isRefreshing}
                    authError={authError}
                    onOpenConsole={() => setShowConsole(true)}
                />

                <AppContent
                    activeTab={activeTab} setActiveTab={setActiveTab}
                    activeAccount={activeAccount} setShowLoginModal={setShowLoginModal} disableAnimations={disableAnimations}
                    selectedInstance={selectedInstance} launchStatus={launchStatus} launchFeedback={launchFeedback} handlePlay={handlePlay} handleStop={handleStop} isRefreshing={isRefreshing}
                    instances={instances} setSelectedInstance={setSelectedInstance} handleNewCrop={handleNewCrop} handleEditCrop={handleEditCrop}
                    accounts={accounts} onAccountSwitchWithToast={onAccountSwitchWithToast} showProfileMenu={showProfileMenu} setShowProfileMenu={setShowProfileMenu} onLogoutWithToast={onLogoutWithToast}
                    onDeleteCropWithToast={onDeleteCropWithToast} reorderInstances={reorderInstances}
                    ram={ram} setRam={setRam} javaPath={javaPath} setJavaPath={setJavaPath} hideOnLaunch={hideOnLaunch} setHideOnLaunch={setHideOnLaunch} setDisableAnimations={setDisableAnimations} availableJavas={availableJavas} enableDiscordRPC={enableDiscordRPC} setEnableDiscordRPC={setEnableDiscordRPC}
                    theme={theme} setTheme={setTheme}
                    onSaveCropWithToast={onSaveCropWithToast}
                />
            </main>

            {/* Overlays */}
            <AppOverlays
                logs={logs} showConsole={showConsole} setShowConsole={setShowConsole}
                launchStatus={launchStatus} launchStep={launchStep} launchProgress={launchProgress} selectedInstance={selectedInstance} handleStop={handleStop}
                showLoginModal={showLoginModal} setShowLoginModal={setShowLoginModal} onAddAccountWithToast={onAddAccountWithToast} isRefreshing={isRefreshing}
                showCropModal={showCropModal} setShowCropModal={setShowCropModal} onSaveCropWithToast={onSaveCropWithToast} editingCrop={editingCrop}
                showJavaModal={showJavaModal} setShowJavaModal={setShowJavaModal} handleJavaInstallComplete={handleJavaInstallComplete} refreshJavas={refreshJavas} requiredJavaVersion={requiredJavaVersion}
                errorModal={errorModal} setErrorModal={setErrorModal}
                crashModal={crashModal} setCrashModal={setCrashModal}
            />
        </div>
    );
}

export default App;
