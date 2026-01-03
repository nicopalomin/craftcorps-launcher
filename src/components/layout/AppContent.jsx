import React from 'react';
import WelcomeView from '../../views/WelcomeView';
import HomeView from '../../views/HomeView';
import InstancesView from '../../views/InstancesView';
import WardrobeView from '../../views/WardrobeView';
import SettingsView from '../../views/SettingsView';
import ModsView from '../../views/ModsView';
import { SKINS } from '../../data/mockData';
import { useToast } from '../../contexts/ToastContext';

const AppContent = ({
    activeTab, setActiveTab,
    activeAccount, setShowLoginModal, disableAnimations,
    selectedInstance, launchStatus, launchFeedback, handlePlay, handleStop, isRefreshing,
    instances, setSelectedInstance, handleNewCrop, handleEditCrop,
    accounts, onAccountSwitchWithToast, showProfileMenu, setShowProfileMenu, onLogoutWithToast,
    onDeleteCropWithToast, reorderInstances,
    ram, setRam, javaPath, setJavaPath, hideOnLaunch, setHideOnLaunch, setDisableAnimations, availableJavas, enableDiscordRPC, setEnableDiscordRPC,
    theme, setTheme,
    onSaveCropWithToast
}) => {
    const { addToast } = useToast();

    // Wrapper for Play to check refreshing
    const onPlayWrapper = () => {
        if (isRefreshing) {
            addToast("Please wait for account refresh to finish.", "error");
            return;
        }
        handlePlay();
    };

    return (
        <div className="flex-1 flex flex-col relative pt-10 overflow-hidden">
            {activeTab === 'home' && (
                !activeAccount ? (
                    <WelcomeView
                        onConnect={() => setShowLoginModal(true)}
                        disableAnimations={disableAnimations}
                    />
                ) : (
                    <HomeView
                        selectedInstance={selectedInstance}
                        launchStatus={launchStatus}
                        launchFeedback={launchFeedback}
                        onPlay={onPlayWrapper}
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
                        theme={theme}
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
                    ram={ram} setRam={setRam}
                    javaPath={javaPath} setJavaPath={setJavaPath}
                    hideOnLaunch={hideOnLaunch} setHideOnLaunch={setHideOnLaunch}
                    disableAnimations={disableAnimations} setDisableAnimations={setDisableAnimations}
                    availableJavas={availableJavas}
                    enableDiscordRPC={enableDiscordRPC} setEnableDiscordRPC={setEnableDiscordRPC}
                    theme={theme} setTheme={setTheme}
                />
            )}
            {activeTab === 'mods' && (
                <ModsView
                    selectedInstance={selectedInstance}
                    instances={instances}
                    onInstanceCreated={(newInstance) => {
                        onSaveCropWithToast(newInstance);
                        setSelectedInstance(newInstance);
                        setActiveTab('home');
                    }}
                />
            )}
        </div>
    );
};

export default AppContent;
