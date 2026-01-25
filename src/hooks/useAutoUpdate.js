import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export function useAutoUpdate() {
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, downloading, downloaded, error
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(null);
    const { addToast } = useToast();

    useEffect(() => {
        if (!window.electronAPI?.onUpdateStatus) return;

        const handleStatus = (data) => {
            console.log('[AutoUpdate] Status:', data);
            setUpdateStatus(data.status);

            if (data.status === 'available') {
                setUpdateInfo(data.info);
                addToast(`Update available: ${data.info.version}`, 'info');
            } else if (data.status === 'downloading') {
                setDownloadProgress(data.progress);
            } else if (data.status === 'downloaded') {
                setUpdateInfo(data.info);
                addToast(`Update ready to install!`, 'success');
            } else if (data.status === 'error') {
                console.error('Update error:', data.error);
                // addToast(`Update error: ${data.error}`, 'error'); // Optional: hide error from user if frequent
            }
        };

        window.electronAPI.onUpdateStatus(handleStatus);

        // Defer update check to avoid startup contention
        const updateCheckTimeout = setTimeout(() => {
            if (window.electronAPI?.checkForUpdates) {
                window.electronAPI.checkForUpdates().catch(err => console.error("Failed to check for updates:", err));
            }
        }, 10000);

        return () => {
            clearTimeout(updateCheckTimeout);
            if (window.electronAPI?.removeUpdateListener) {
                window.electronAPI.removeUpdateListener();
            }
        };
    }, [addToast]);

    const downloadUpdate = async () => {
        // Prevent duplicate download calls
        if (updateStatus === 'downloading' || updateStatus === 'downloaded') {
            console.log('[AutoUpdate] Download already in progress or completed');
            return;
        }

        if (window.electronAPI) {
            try {
                await window.electronAPI.downloadUpdate();
            } catch (err) {
                console.error('[AutoUpdate] Failed to download update:', err);
                addToast('Failed to download update', 'error');
            }
        }
    };

    const quitAndInstall = async () => {
        if (window.electronAPI) {
            await window.electronAPI.quitAndInstall();
        }
    };

    return {
        updateStatus,
        updateInfo,
        downloadProgress,
        downloadUpdate,
        quitAndInstall
    };
}
