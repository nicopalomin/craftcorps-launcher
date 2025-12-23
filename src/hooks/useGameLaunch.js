import { useState, useEffect, useCallback } from 'react';

export const useGameLaunch = (selectedInstance, ram, activeAccount, updateLastPlayed) => {
    const [launchStatus, setLaunchStatus] = useState('idle'); // idle, launching, running
    const [launchProgress, setLaunchProgress] = useState(0);
    const [launchStep, setLaunchStep] = useState('Initializing...');
    const [launchFeedback, setLaunchFeedback] = useState(null); // null | 'cancelled' | 'error'
    const [showConsole, setShowConsole] = useState(false);
    const [logs, setLogs] = useState([]);

    const handlePlay = useCallback(() => {
        if (launchStatus !== 'idle') return;

        setLaunchStatus('launching');
        setLaunchProgress(0);
        setLaunchStep("Initializing...");
        setLaunchFeedback(null);
        setShowConsole(false);
        setLogs([]);

        if (window.electronAPI) {
            window.electronAPI.removeLogListeners();

            window.electronAPI.onGameLog((log) => {
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                setLogs(prev => [...prev, { ...log, time: timeStr }]);

                if (log.message.includes('Downloading assets')) {
                    // Handled by progress event
                } else if (log.message.includes('Starting MCLC')) {
                    setLaunchStep("Preparing version manifest...");
                } else if (log.message.includes('Game process started')) {
                    setLaunchStep("Game started!");
                    setLaunchProgress(100);

                    if (updateLastPlayed) {
                        updateLastPlayed();
                    }

                    setTimeout(() => {
                        setLaunchStatus('running');
                    }, 500);
                } else {
                    if (log.message && log.message.length < 50 && !log.message.includes('DEBUG')) {
                        setLaunchStep(log.message);
                    }
                }
            });

            window.electronAPI.onGameProgress((data) => {
                setLaunchProgress(data.percent);
                setLaunchStep(`Downloading ${data.type} (${data.percent}%)`);
            });

            window.electronAPI.onGameExit((code) => {
                setLaunchStatus('idle');
                setLaunchStep("Game exited.");
                setLogs(prev => [...prev, { time: "Now", type: "INFO", message: `Process exited with code ${code}` }]);
                // If it exited immediately/prematurely during launch, we might want to flag it?
                // But usually this means user closed game or it crashed.
            });

            window.electronAPI.launchGame({
                version: selectedInstance.version,
                maxMem: ram * 1024,
                username: activeAccount.name,
                uuid: activeAccount.uuid,
                useDefaultPath: true,
            });
        } else {
            setLogs([{ time: "Now", type: "ERROR", message: "Electron API not found. Cannot launch native process." }]);
        }
    }, [launchStatus, selectedInstance, ram, activeAccount, updateLastPlayed]);

    const handleStop = useCallback(() => {
        if (launchStatus === 'launching') {
            setLaunchFeedback('cancelled');
            setTimeout(() => setLaunchFeedback(null), 1500);
        }

        if (window.electronAPI) {
            window.electronAPI.stopGame();
        }
        setLaunchStatus('idle');
    }, [launchStatus]);

    return {
        launchStatus,
        launchProgress,
        launchStep,
        launchFeedback,
        showConsole,
        setShowConsole,
        logs,
        handlePlay,
        handleStop
    };
};
