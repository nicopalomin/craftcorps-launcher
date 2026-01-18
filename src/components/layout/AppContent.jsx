import React from 'react';
import WelcomeView from '../../views/WelcomeView';
import HomeView from '../../views/HomeView';
import InstancesView from '../../views/InstancesView';
import WardrobeView from '../../views/WardrobeView';
import SettingsView from '../../views/SettingsView';
import ModsView from '../../views/ModsView';
import MarketView from '../../views/MarketView';
import BetaRewardsView from '../../views/BetaRewardsView';
import DiscoverView from '../../views/DiscoverView';
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
    onSaveCropWithToast,
    isLoadingInstances
}) => {
    const { addToast } = useToast();
    const [hasOpenedMods, setHasOpenedMods] = React.useState(false);

    // Track if mods tab has been opened to keep it alive
    React.useEffect(() => {
        if (activeTab === 'mods' && !hasOpenedMods) {
            setHasOpenedMods(true);
        }
    }, [activeTab, hasOpenedMods]);

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
                        onBrowseMods={() => setActiveTab('mods')}
                        // Account System Props
                        accounts={accounts}
                        onSwitchAccount={onAccountSwitchWithToast}
                        onAddAccount={() => { setShowLoginModal(true); setShowProfileMenu(false); }}
                        onLogout={onLogoutWithToast}
                        showProfileMenu={showProfileMenu}
                        setShowProfileMenu={setShowProfileMenu}
                        disableAnimations={disableAnimations}
                        theme={theme}
                        isLoadingInstances={isLoadingInstances}
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
            {activeTab === 'wardrobe' && <WardrobeView skins={SKINS} theme={theme} />}
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
            {/* Mods View - Keep Alive to prevent lag on re-open */}
            {(activeTab === 'mods' || hasOpenedMods) && (
                <div className={`flex-1 flex-col h-full overflow-hidden ${activeTab === 'mods' ? 'flex' : 'hidden'}`}>
                    <ModsView
                        selectedInstance={selectedInstance}
                        instances={instances}
                        onInstanceCreated={(newInstance) => {
                            onSaveCropWithToast(newInstance);
                            setSelectedInstance(newInstance);
                            setActiveTab('home');
                        }}
                        onSwitchInstance={() => setActiveTab('instances')}
                    />
                </div>
            )}
            {activeTab === 'discover' && <DiscoverView selectedInstance={selectedInstance} activeAccount={activeAccount} />}
            {activeTab === 'market' && <MarketView />}
            {activeTab === 'rewards' && <BetaRewardsView theme={theme} selectedInstance={selectedInstance} />}
        </div>
    );
};

export default AppContent;
