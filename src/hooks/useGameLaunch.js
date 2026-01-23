import React, { useState, useEffect, useCallback } from 'react';
import { telemetry } from '../services/TelemetryService';
import AccountManager from '../utils/AccountManager';

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
    const [launchCooldown, setLaunchCooldown] = useState(false);

    const [runningInstances, setRunningInstances] = useState([]);

    // Sync Running Instances
    useEffect(() => {
        if (!window.electronAPI) return;

        const handleRunningUpdate = (instances) => {
            setRunningInstances(instances || []);
        };

        window.electronAPI.getRunningInstances().then(handleRunningUpdate);
        window.electronAPI.onRunningInstancesChanged(handleRunningUpdate);

        return () => window.electronAPI.removeRunningInstancesListener?.();
    }, []);

    // Sync Launch Status with Selection & Running State
    useEffect(() => {
        if (!selectedInstance) return;

        if (runningInstances.some(i => i.gameDir === selectedInstance.path)) {
            // Only auto-switch to 'running' if we aren't currently in the middle of a 'launching' sequence
            setLaunchStatus(prev => prev === 'launching' ? 'launching' : 'running');
        } else {
            // If we were 'running' but now it's not in the list, go to idle.
            // If we are 'launching', DO NOT reset to idle, wait for event failure or success.
            setLaunchStatus(prev => prev === 'running' ? 'idle' : prev);
        }
    }, [selectedInstance, runningInstances]);


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
    const launchStartTimeRef = React.useRef(0); // [TELEMETRY] Track start time

    useEffect(() => {
        launchStatusRef.current = launchStatus;
    }, [launchStatus]);

    // --- Game Event Listeners (Active Tab) ---
    useEffect(() => {
        if (!window.electronAPI || !selectedInstance) return;

        // Cleanup previous if any (though `useEffect` handles it)
        // Note: removeLogListeners might affect other components if any, but we assume single-view.
        window.electronAPI.removeLogListeners();

        const handleLaunchError = (err) => {
            if (err.gameDir && err.gameDir !== selectedInstance.path) return;

            console.error("Launch Error received:", err);
            // setLaunchStatus('idle'); // Force idle on error even if other instances might be running? 
            // Actually if we have 2 instances and 1 fails, we might still be running.
            // But this hook tracks the "Action" often.
            // For now, let's just show the error.
            if (runningInstances.some(i => i.gameDir === selectedInstance.path)) {
                setLaunchStatus('running');
            } else {
                setLaunchStatus('idle');
            }

            setLaunchFeedback('error');

            const isJavaError = (err.summary && err.summary.toLowerCase().includes('java')) ||
                (err.advice && err.advice.toLowerCase().includes('java'));

            if (isJavaError) {
                setShowJavaModal(true);
                setErrorModal(null);
                telemetry.track('JAVA_MISSING', { error: err.summary });
            } else {
                setErrorModal(err);
                telemetry.track('LAUNCH_ERROR', { error: err.summary, code: err.code || 'unknown' });
            }

            const timeStr = new Date().toLocaleTimeString();
            setLogs(prev => [...prev, { time: timeStr, type: "ERROR", message: err.summary }]);
            if (err.advice) {
                setLogs(prev => [...prev, { time: timeStr, type: "WARN", message: `Advice: ${err.advice} ` }]);
            }
        };

        const handleGameLog = (log) => {
            if (log.gameDir && log.gameDir !== selectedInstance.path) return;

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

                // [TELEMETRY] Track Duration
                if (launchStartTimeRef.current > 0) {
                    const duration = Date.now() - launchStartTimeRef.current;
                    telemetry.track('GAME_LAUNCH_DURATION', { durationMs: duration });
                    launchStartTimeRef.current = 0; // Reset
                }

                if (hideOnLaunch && window.electronAPI) {
                    window.electronAPI.hide();
                }

                // Status update handled by runningInstances sync usually, but immediate feedback is good
                setLaunchStatus('running');
            } else {
                if (log.message && log.message.length < 50 && !log.message.includes('DEBUG')) {
                    setLaunchStep(log.message);
                }
            }
        };

        const handleGameProgress = (data) => {
            if (data.gameDir && data.gameDir !== selectedInstance.path) return;
            setLaunchProgress(data.percent);
            setLaunchStep(`Downloading ${data.type} (${data.percent}%)`);
        };

        const handleGameExit = (data) => {
            let code = data;
            let gameDir = null;
            if (typeof data === 'object' && data !== null) {
                code = data.code;
                gameDir = data.gameDir;
            }

            if (gameDir && gameDir !== selectedInstance.path) return;

            // setLaunchStatus('idle'); // Handled by runningInstances mostly
            setLaunchStep("Game exited.");
            const exitMsg = `Process exited with code ${code} `;
            setLogs(prev => [...prev, { time: "Now", type: "INFO", message: exitMsg }]);

            if (window.electronAPI) {
                window.electronAPI.show();
            }

            if (launchStatusRef.current === 'launching' && code !== 0 && code !== -1) {
                setLaunchFeedback((prev) => prev === 'error' ? 'error' : 'error');
                setLaunchStep("Launch Failed.");

                if (code !== 1) {
                    setShowConsole(true);
                }
                setTimeout(() => setLaunchFeedback(null), 3000);
            }
        };

        const handleCrash = (data) => {
            if (data.gameDir && data.gameDir !== selectedInstance.path) return;
            setCrashModal(data);
            telemetry.track('GAME_CRASH', {
                code: data.code,
                hasReport: !!data.crashReport
            });
        };

        window.electronAPI.onLaunchError(handleLaunchError);
        window.electronAPI.onGameLog(handleGameLog);
        window.electronAPI.onGameProgress(handleGameProgress);
        window.electronAPI.onGameExit(handleGameExit);
        window.electronAPI.onGameCrashDetected(handleCrash);

        return () => {
            // Cleanup if needed, but removeLogListeners kills all.
            // We rely on new effect execution to re-bind.
            // window.electronAPI.removeLogListeners(); 
        };
    }, [selectedInstance, runningInstances, hideOnLaunch]); // Re-bind if selection changes or hideOnLaunch changes


    const handlePlay = useCallback((instanceOverride = null, serverOverride = null, accountOverride = null) => {
        const instance = instanceOverride || selectedInstance;
        const server = serverOverride || (instance?.autoConnect ? instance?.serverAddress : null);
        const accountToUse = accountOverride || activeAccount;

        if (!instance) {
            console.error('No instance to launch');
            return;
        }

        // Prevent double-launching while already preparing
        // Prevent double-launching while already preparing or in cooldown
        if (launchStatusRef.current === 'launching' || launchCooldown) {
            console.warn('Launch already in progress or in cooldown, ignoring request');
            return;
        }

        setLaunchCooldown(true);
        setTimeout(() => setLaunchCooldown(false), 5000);

        setLaunchStatus('launching');
        launchStatusRef.current = 'launching';
        launchStartTimeRef.current = Date.now();
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
            window.electronAPI.log('info', `[UI] Launching instance: ${instance?.name} (Version: ${instance?.version}) with ${accountToUse?.name}`);
        }

        telemetry.track('GAME_LAUNCH', {
            version: instance?.version,
            loader: instance?.loader,
            ram: ram,
            javaVersion: requiredJavaVersion
        }, true);

        // Listeners are already active via useEffect

        // Use AccountManager to build launch options for consistency
        (async () => {
            try {
                if (!window.electronAPI) {
                    setLogs([{ time: "Now", type: "ERROR", message: "Electron API not found. Cannot launch native process." }]);
                    setLaunchStatus('idle');
                    return;
                }

                // Calculate effective RAM
                const effectiveRam = (instance?.ramOverride && instance?.ram) ? instance.ram : ram;

                const launchOptions = await AccountManager.buildLaunchOptions(
                    instance,
                    effectiveRam,
                    server,
                    javaPath,
                    accountToUse // Passing the specific account
                );

                // Attach gameDir for backend identification
                launchOptions.gameDir = instance.path;

                window.electronAPI.launchGame(launchOptions);
                window.electronAPI.log('info', `[UI] Launch command sent to backend. RAM: ${effectiveRam} GB (Override: ${!!instance?.ramOverride}), User: ${launchOptions.username}, Java: ${javaPath}`);
            } catch (error) {
                console.error("Failed to build launch options or send launch command:", error);
                setLogs(prev => [...prev, { time: "Now", type: "ERROR", message: `Launch initialization failed: ${error.message}` }]);
                setLaunchStatus('idle');
                setLaunchStep("Launch Failed");
                setLaunchFeedback('error');
            }
        })();

    }, [selectedInstance, ram, activeAccount, updateLastPlayed, hideOnLaunch, javaPath, requiredJavaVersion]);

    const handleStop = useCallback(() => {
        launchStatusRef.current = 'idle'; // Update ref immediately

        if (launchStatus === 'launching') {
            setLaunchFeedback('cancelled');
            setTimeout(() => {
                setLaunchFeedback(prev => prev === 'cancelled' ? null : prev);
            }, 2000);
        }

        try {
            if (window.electronAPI) {
                // Pass the specific instance path to stop only this game
                window.electronAPI.stopGame(selectedInstance?.path);
            }
        } catch (error) {
            console.error("Error stopping game:", error);
        }
        setLaunchStatus('idle');
    }, [launchStatus, selectedInstance]);

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
        setCrashModal,
        runningInstances,
        launchCooldown
    };
};


