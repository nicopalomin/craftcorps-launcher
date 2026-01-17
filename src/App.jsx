import React, { useState, useEffect } from 'react';

import Sidebar from './components/layout/Sidebar';
import TitleBar from './components/layout/TitleBar';
import AppContent from './components/layout/AppContent';
const AppOverlays = React.lazy(() => import('./components/layout/AppOverlays'));

import { useGameLaunch } from './hooks/useGameLaunch';
import { useInstances } from './hooks/useInstances';
import { useAccounts } from './hooks/useAccounts';
import { useAppSettings } from './hooks/useAppSettings';
import { useToast } from './contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { telemetry } from './services/TelemetryService';
import { discovery } from './services/DiscoveryService';
import { useAutoUpdate } from './hooks/useAutoUpdate';

function App() {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('home');

    // Initialize Telemetry (Delayed)
    useEffect(() => {
        const initTimer = setTimeout(() => {
            if (window.electronAPI) {
                const storeWrapper = {
                    get: (key) => window.electronAPI?.storeGet?.(key),
                    set: (key, val) => window.electronAPI?.storeSet?.(key, val)
                };

                discovery.init(storeWrapper);
                telemetry.init(storeWrapper).then(() => {
                    telemetry.track('APP_OPEN');
                    // Defer hardware info to avoid startup slowdown
                    setTimeout(() => {
                        telemetry.sendHardwareInfo();
                    }, 15000);
                });
            }
        }, 5000);

        return () => clearTimeout(initTimer);
    }, []);

    // Track Page Views
    useEffect(() => {
        telemetry.trackPage(activeTab);
    }, [activeTab]);



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

    // Track Theme Changes
    useEffect(() => {
        if (theme) telemetry.trackThemeChange(theme);
    }, [theme]);

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
        reorderInstances,
        isLoading: isLoadingInstances
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

        // Track First Login
        if (!localStorage.getItem('has_sent_first_login')) {
            telemetry.track('FIRST_LOGIN', { authType: account.type || 'microsoft' });
            localStorage.setItem('has_sent_first_login', 'true');
        }
    };

    const onLogoutWithToast = () => {
        handleLogout();
        addToast(t('toast_logout'), 'info');
    };

    const onAccountSwitchWithToast = (account) => {
        if (activeAccount?.id === account.id) return;
        handleAccountSwitch(account);
        addToast(`Switched to ${account.name}`, 'info');
        telemetry.track('ACCOUNT_SWITCH', { accountId: account.id });
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

    // Auto Update
    const { updateStatus, updateInfo, downloadProgress, downloadUpdate, quitAndInstall } = useAutoUpdate();
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    // Silently auto-download significant updates (Major or Minor version bump)
    useEffect(() => {
        if (updateStatus === 'available' && updateInfo?.version) {
            try {
                const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

                // Parse versions (handling potential non-semver strings gracefully)
                const parseVer = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
                const [curMajor, curMinor] = parseVer(currentVersion);
                const [newMajor, newMinor] = parseVer(updateInfo.version);

                // Check if update is at least 0.1.0 difference (Major different or Minor different)
                const isSignificant = newMajor > curMajor || (newMajor === curMajor && newMinor > curMinor);

                if (isSignificant) {
                    console.log(`[AutoUpdate] Significant update detected (${currentVersion} -> ${updateInfo.version}). Auto-downloading...`);
                    downloadUpdate();
                }
            } catch (e) {
                console.error('[AutoUpdate] Failed to compare versions:', e);
            }
        }
    }, [updateStatus, updateInfo, downloadUpdate]);



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

    const getThemeBackground = () => {
        switch (theme) {
            case 'white': return 'bg-slate-50 text-slate-900';
            case 'midnight': return 'bg-[#050505] text-slate-200';
            default: return 'bg-slate-900 text-slate-200'; // Classic: Slate 900 (was 950)
        }
    };

    return (
        <div className={`flex h-screen font-sans selection:bg-emerald-500/30 ${getThemeBackground()}`}>
            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                theme={theme}
            />

            {/* Main Content Area */}
            <main className={`flex-1 flex flex-col min-w-0 relative overflow-hidden ${theme === 'white' ? 'bg-slate-50' : (theme === 'midnight' ? 'bg-[#050505]' : 'bg-slate-900')}`}>
                <TitleBar
                    launchStatus={launchStatus}
                    isRefreshing={isRefreshing}
                    authError={authError}
                    onOpenConsole={() => setShowConsole(true)}
                    updateStatus={updateStatus}
                    updateInfo={updateInfo}
                    onOpenUpdateModal={() => setShowUpdateModal(true)}
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
                    isLoadingInstances={isLoadingInstances}
                />
            </main>

            {/* Overlays */}
            <React.Suspense fallback={null}>
                <AppOverlays
                    logs={logs} showConsole={showConsole} setShowConsole={setShowConsole}
                    launchStatus={launchStatus} launchStep={launchStep} launchProgress={launchProgress} selectedInstance={selectedInstance} handleStop={handleStop}
                    showLoginModal={showLoginModal} setShowLoginModal={setShowLoginModal} onAddAccountWithToast={onAddAccountWithToast} isRefreshing={isRefreshing}
                    showCropModal={showCropModal} setShowCropModal={setShowCropModal} onSaveCropWithToast={onSaveCropWithToast} editingCrop={editingCrop} onDeleteCropWithToast={onDeleteCropWithToast}
                    showJavaModal={showJavaModal} setShowJavaModal={setShowJavaModal} handleJavaInstallComplete={handleJavaInstallComplete} refreshJavas={refreshJavas} requiredJavaVersion={requiredJavaVersion}
                    errorModal={errorModal} setErrorModal={setErrorModal}
                    crashModal={crashModal} setCrashModal={setCrashModal}
                    showUpdateModal={showUpdateModal} setShowUpdateModal={setShowUpdateModal}
                    updateStatus={updateStatus} updateInfo={updateInfo} downloadProgress={downloadProgress}
                    onDownloadUpdate={() => {
                        downloadUpdate();
                        // Modal stays open to show progress usually, or we can close it and let user re-open via titlebar (if we add button there)
                        // For now, keep open so they see progress bar
                    }}
                    onInstallUpdate={quitAndInstall}
                />
            </React.Suspense>
        </div>
    );
}

export default App;
