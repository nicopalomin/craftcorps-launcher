import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';

export const useAppSettings = () => {
    const { addToast } = useToast();
    const { t } = useTranslation();

    const [ram, setRam] = useState(() => parseFloat(localStorage.getItem('settings_ram')) || 4);
    const [javaPath, setJavaPath] = useState(() => localStorage.getItem('settings_javaPath') || "C:\\Program Files\\Java\\jdk-17.0.2\\bin\\javaw.exe");
    const [hideOnLaunch, setHideOnLaunch] = useState(() => localStorage.getItem('settings_hideOnLaunch') === 'true');
    const [disableAnimations, setDisableAnimations] = useState(() => localStorage.getItem('settings_disableAnimations') === 'true');
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

    useEffect(() => {
        const init = async () => {
            await refreshJavas();
            if (window.electronAPI) {
                window.electronAPI.onJavaPathUpdated((newPath) => {
                    console.log("Received Java Path Update:", newPath);
                    setJavaPath(newPath);
                    addToast(t('toast_java_updated', { defaultValue: "Java path updated automatically" }), 'info');
                    refreshJavas();
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
    }, [ram, javaPath, hideOnLaunch, disableAnimations, enableDiscordRPC]);

    return {
        ram, setRam,
        javaPath, setJavaPath,
        hideOnLaunch, setHideOnLaunch,
        disableAnimations, setDisableAnimations,
        enableDiscordRPC, setEnableDiscordRPC,
        availableJavas,
        refreshJavas
    };
};
