import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';

export const useAppSettings = () => {
    const { addToast } = useToast();
    const { t } = useTranslation();

    const [ram, setRam] = useState(() => parseFloat(localStorage.getItem('settings_ram')) || 4);
    const [javaPath, setJavaPath] = useState(() => localStorage.getItem('settings_javaPath') || "C:\\Program Files\\Java\\jdk-17.0.2\\bin\\javaw.exe");
    const [hideOnLaunch, setHideOnLaunch] = useState(() => localStorage.getItem('settings_hideOnLaunch') === 'true');
    const [disableAnimations, setDisableAnimations] = useState(() => localStorage.getItem('settings_disableAnimations') === 'true');
    const [theme, setTheme] = useState(() => localStorage.getItem('settings_theme') || 'classic');

    const [enableDiscordRPC, setEnableDiscordRPC] = useState(() => {
        const stored = localStorage.getItem('settings_enableDiscordRPC');
        return stored !== null ? stored === 'true' : true;
    });
    const [availableJavas, setAvailableJavas] = useState([]);

    const refreshJavas = async () => {
        if (window.electronAPI) {
            try {
                const javas = await window.electronAPI.getAvailableJavas();
                setAvailableJavas(javas);
            } catch (e) {
                console.error("Failed to list Javas", e);
            }
        }
    };

    // Use ref to track current path for event listener without re-running effect
    const javaPathRef = useRef(javaPath);
    useEffect(() => { javaPathRef.current = javaPath; }, [javaPath]);

    useEffect(() => {
        const init = async () => {
            await refreshJavas();
            if (window.electronAPI) {
                window.electronAPI.onJavaPathUpdated((newPath) => {
                    // Only toast if path actually changed
                    if (newPath && newPath !== javaPathRef.current) {
                        console.log("Received Java Path Update:", newPath);
                        setJavaPath(newPath);
                        addToast(t('toast_java_updated', { defaultValue: "Java path updated automatically" }), 'info');
                        refreshJavas();
                    }
                });
            }
        };
        init();
        return () => {
            if (window.electronAPI?.removeJavaPathListener) {
                window.electronAPI.removeJavaPathListener();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        localStorage.setItem('settings_ram', ram);
        localStorage.setItem('settings_javaPath', javaPath);
        localStorage.setItem('settings_hideOnLaunch', hideOnLaunch);
        localStorage.setItem('settings_disableAnimations', disableAnimations);
        localStorage.setItem('settings_enableDiscordRPC', enableDiscordRPC);
        localStorage.setItem('settings_theme', theme);
    }, [ram, javaPath, hideOnLaunch, disableAnimations, enableDiscordRPC, theme]);

    useEffect(() => {
        // Apply theme to html tag using data-theme attribute
        document.documentElement.setAttribute('data-theme', theme);
        // Also keep body class for backward compatibility or specific selectors if needed, 
        // but data-theme is usually enough. Let's start clean.
        // document.body.className = ''; 
        // document.body.classList.add(`theme-${theme}`);
    }, [theme]);

    return {
        ram, setRam,
        javaPath, setJavaPath,
        hideOnLaunch, setHideOnLaunch,
        disableAnimations, setDisableAnimations,
        enableDiscordRPC, setEnableDiscordRPC,
        theme, setTheme,
        availableJavas,
        refreshJavas
    };
};
