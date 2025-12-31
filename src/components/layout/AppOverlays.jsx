import React from 'react';
import ConsoleOverlay from '../common/ConsoleOverlay';
import LaunchOverlay from '../common/LaunchOverlay';
import LoginModal from '../modals/LoginModal';
import CropModal from '../modals/CropModal';
import JavaInstallModal from '../modals/JavaInstallModal';
import ErrorModal from '../modals/ErrorModal';

const AppOverlays = ({
    // Console
    logs, showConsole, setShowConsole,
    // Launch
    launchStatus, launchStep, launchProgress, selectedInstance, handleStop,
    // Login
    showLoginModal, setShowLoginModal, onAddAccountWithToast, isRefreshing,
    // Crop
    showCropModal, setShowCropModal, onSaveCropWithToast, editingCrop,
    // Java
    showJavaModal, setShowJavaModal, handleJavaInstallComplete, refreshJavas, requiredJavaVersion,
    // Error
    errorModal, setErrorModal
}) => {
    return (
        <>
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
                isAutoRefreshing={isRefreshing}
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
        </>
    );
};

export default AppOverlays;
