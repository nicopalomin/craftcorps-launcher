import React, { useState, useEffect, useCallback } from 'react';
import { telemetry } from '../services/TelemetryService';

export const useGameLaunch = (selectedInstance, ram, activeAccount, updateLastPlayed, hideOnLaunch, javaPath, setJavaPath) => {
    const [launchStatus, setLaunchStatus] = useState('idle'); // idle, launching, running
    const [launchProgress, setLaunchProgress] = useState(0);
    const [launchStep, setLaunchStep] = useState('Initializing...');
    const [launchFeedback, setLaunchFeedback] = useState(null); // null | 'cancelled' | 'error'
    const [showConsole, setShowConsole] = useState(false);
    const [logs, setLogs] = useState([]);

    const [requiredJavaVersion, setRequiredJavaVersion] = useState(17);
    const [showJavaModal, setShowJavaModal] = useState(false);
    const [errorModal, setErrorModal] = useState(null); // { summary, advice }
    const [crashModal, setCrashModal] = useState(null); // { code, crashReport }

    // Determine Java Version based on selected instance
    useEffect(() => {
        if (selectedInstance?.version) {
            // Simple heuristic: < 1.17 -> 8, >= 1.17 -> 17
            // "1.20.4"
            const parts = selectedInstance.version.split('.');
            if (parts.length >= 2) {
                const minor = parseInt(parts[1]);
                let patch = 0;
                if (parts.length > 2) {
                    patch = parseInt(parts[2]);
                }

                if (minor >= 21) {
                    setRequiredJavaVersion(21);
                } else if (minor === 20) {
                    if (patch >= 5) setRequiredJavaVersion(21);
                    else setRequiredJavaVersion(17);
                } else if (minor >= 17) {
                    setRequiredJavaVersion(17);
                } else {
                    setRequiredJavaVersion(8);
                }
            } else {
                setRequiredJavaVersion(17); // Default
            }
        }
    }, [selectedInstance]);

    // Use ref to track status inside callbacks safely without dependency issues
    const launchStatusRef = React.useRef(launchStatus);

    useEffect(() => {
        launchStatusRef.current = launchStatus;
    }, [launchStatus]);

    const handlePlay = useCallback(() => {
        if (launchStatus !== 'idle') return;

        setLaunchStatus('launching');
        launchStatusRef.current = 'launching'; // Sync ref
        setLaunchProgress(0);
        setLaunchStep("Initializing...");
        setLaunchFeedback(null);
        setErrorModal(null);
        setShowConsole(false);
        setLogs([]);

        if (updateLastPlayed) {
            updateLastPlayed();
        }

        if (window.electronAPI && window.electronAPI.log) {
            window.electronAPI.log('info', `[UI] User clicked Play for instance: ${selectedInstance?.name} (Version: ${selectedInstance?.version})`);
        } else {
            console.log('[UI] User clicked Play');
        }

        telemetry.track('GAME_LAUNCH', {
            version: selectedInstance?.version,
            loader: selectedInstance?.loader,
            ram: ram,
            javaVersion: requiredJavaVersion
        }, true);

        if (window.electronAPI) {
            window.electronAPI.removeLogListeners();
            window.electronAPI.log('info', '[UI] Registering game event listeners...');

            window.electronAPI.onLaunchError((err) => {
                console.error("Launch Error received:", err);
                setLaunchStatus('idle');
                setLaunchFeedback('error');

                // Check if error is related to Java
                const isJavaError = (err.summary && err.summary.toLowerCase().includes('java')) ||
                    (err.advice && err.advice.toLowerCase().includes('java'));

                if (isJavaError) {
                    setShowJavaModal(true);
                    setErrorModal(null); // specific modal handles it
                } else {
                    setErrorModal(err);
                }

                const timeStr = new Date().toLocaleTimeString();
                setLogs(prev => [...prev, { time: timeStr, type: "ERROR", message: err.summary }]);
                if (err.advice) {
                    setLogs(prev => [...prev, { time: timeStr, type: "WARN", message: `Advice: ${err.advice} ` }]);
                }
            });

            window.electronAPI.onGameLog((log) => {
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} `;
                setLogs(prev => [...prev, { ...log, time: timeStr }]);

                if (log.message.includes('Downloading assets')) {
                    // Handled by progress event
                } else if (log.message.includes('Starting MCLC')) {
                    setLaunchStep("Preparing version manifest...");
                } else if (log.message.includes('Game process started')) {
                    setLaunchStep("Game started!");
                    setLaunchProgress(100);

                    if (hideOnLaunch && window.electronAPI) {
                        window.electronAPI.hide();
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
                const exitMsg = `Process exited with code ${code} `;
                setLogs(prev => [...prev, { time: "Now", type: "INFO", message: exitMsg }]);

                if (window.electronAPI) {
                    window.electronAPI.show();
                }

                if (launchStatusRef.current === 'launching' && code !== 0 && code !== -1) {
                    // Only generic fail if we didn't already get a specific error modal
                    setLaunchFeedback((prev) => prev === 'error' ? 'error' : 'error');
                    setLaunchStep("Launch Failed.");

                    // Show console if we don't have a specific modal
                    // We can check errorModal state but inside callback it's stale.
                    // Rely on user seeing "Launch Failed" and clicking logs if no modal appeared.
                    // Actually, if code=1 and no errorModal, it might be the generic one.

                    if (code !== 1) {
                        setShowConsole(true);
                    }
                    setTimeout(() => setLaunchFeedback(null), 3000);
                }
            });

            window.electronAPI.launchGame({
                version: selectedInstance.version,
                maxMem: ram * 1024,
                username: activeAccount.name,
                uuid: activeAccount.uuid,
                accessToken: activeAccount.accessToken,
                userType: activeAccount.type,
                useDefaultPath: !selectedInstance.path,
                gameDir: selectedInstance.path || null,
                server: selectedInstance.autoConnect ? selectedInstance.serverAddress : null,
                javaPath: javaPath,
                loader: selectedInstance.loader,
                loaderVersion: selectedInstance.loaderVersion
            });

            if (window.electronAPI.log) {
                window.electronAPI.log('info', `[UI] Launch command sent to backend.RAM: ${ram} GB, User: ${activeAccount?.name}, Java: ${javaPath} `);
            }
            // Check for crash
            window.electronAPI.onGameCrashDetected((data) => {
                // data = { code, crashReport }
                setCrashModal(data);
                telemetry.track('GAME_CRASH', {
                    code: data.code,
                    hasReport: !!data.crashReport
                });
            });

        } else {
            setLogs([{ time: "Now", type: "ERROR", message: "Electron API not found. Cannot launch native process." }]);
        }
    }, [launchStatus, selectedInstance, ram, activeAccount, updateLastPlayed, hideOnLaunch, javaPath]);

    const handleStop = useCallback(() => {
        launchStatusRef.current = 'idle'; // Update ref immediately to prevent race conditions with onGameExit

        if (launchStatus === 'launching') {
            setLaunchFeedback('cancelled');
            // Clear the cancelled message after a short delay
            setTimeout(() => {
                setLaunchFeedback(prev => prev === 'cancelled' ? null : prev);
            }, 2000);
        }

        try {
            if (window.electronAPI) {
                window.electronAPI.stopGame();
            }
        } catch (error) {
            console.error("Error stopping game:", error);
        }
        setLaunchStatus('idle');
    }, [launchStatus]);

    const handleJavaInstallComplete = (newPath) => {
        if (setJavaPath) {
            setJavaPath(newPath);
            setShowJavaModal(false);
            setLaunchStatus('idle');
            setLaunchFeedback(null);
        }
    };

    return {
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
    };
};
