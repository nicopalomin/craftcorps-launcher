import { useState, useEffect } from 'react';

export function useAutoUpdate() {
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, downloading, downloaded, error
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(null);

    useEffect(() => {
        if (!window.electronAPI?.onUpdateStatus) return;

        const handleStatus = (data) => {
            console.log('[AutoUpdate] Status:', data);
            setUpdateStatus(data.status);

            if (data.status === 'available') {
                setUpdateInfo(data.info);
                console.log(`[AutoUpdate] Update available: ${data.info?.version}. Auto-downloading...`);
            } else if (data.status === 'downloading') {
                setDownloadProgress(data.progress);
            } else if (data.status === 'downloaded') {
                setUpdateInfo(data.info);
                console.log('[AutoUpdate] Update downloaded. Restarting...');
            } else if (data.status === 'error') {
                console.error('[AutoUpdate] Update error:', data.error);
            }
        };

        window.electronAPI.onUpdateStatus(handleStatus);

        // Check for updates immediately on startup
        if (window.electronAPI?.checkForUpdates) {
            window.electronAPI.checkForUpdates().catch(err =>
                console.error('[AutoUpdate] Failed to check for updates:', err)
            );
        }

        return () => {
            if (window.electronAPI?.removeUpdateListener) {
                window.electronAPI.removeUpdateListener();
            }
        };
    }, []);

    // True when we should block the UI with the update overlay
    const isUpdating = updateStatus === 'downloading' || updateStatus === 'downloaded';

    return {
        updateStatus,
        updateInfo,
        downloadProgress,
        isUpdating
    };
}
