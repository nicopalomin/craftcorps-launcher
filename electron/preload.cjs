const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded'); // DEBUG LOG

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    hide: () => ipcRenderer.send('window-hide'),
    show: () => ipcRenderer.send('window-show'),


    microsoftLogin: (consent) => ipcRenderer.invoke('microsoft-login', consent),
    microsoftRefresh: (refreshToken) => ipcRenderer.invoke('refresh-microsoft-token', refreshToken),
    linkProfile: (payload) => ipcRenderer.invoke('link-profile', payload),
    selectFile: () => ipcRenderer.invoke('select-file'),
    openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
    openPath: (path) => ipcRenderer.invoke('open-path', path),
    log: (level, message) => ipcRenderer.send('renderer-log', { level, message }),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    storeGet: (key) => ipcRenderer.invoke('store-get', key),
    storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'), // [NEW]
    getDeviceId: () => ipcRenderer.invoke('get-device-id'), // [NEW]
    installJava: (version) => ipcRenderer.invoke('install-java', version),
    getAvailableJavas: () => ipcRenderer.invoke('get-available-javas'),
    cancelJavaInstall: () => ipcRenderer.invoke('cancel-java-install'),
    pauseJavaInstall: () => ipcRenderer.invoke('pause-java-install'),
    resumeJavaInstall: () => ipcRenderer.invoke('resume-java-install'),
    onJavaProgress: (callback) => ipcRenderer.on('java-progress', (_event, value) => callback(value)),
    onJavaPathUpdated: (callback) => ipcRenderer.on('java-path-updated', (_event, value) => callback(value)),
    removeJavaPathListener: () => ipcRenderer.removeAllListeners('java-path-updated'),


    launchGame: (options) => ipcRenderer.send('launch-game', options),
    getNewInstancePath: (name) => ipcRenderer.invoke('get-new-instance-path', name),
    deleteInstanceFolder: (path) => ipcRenderer.invoke('delete-instance-folder', path),
    stopGame: () => ipcRenderer.send('stop-game'),
    onGameLog: (callback) => ipcRenderer.on('game-log', (_event, value) => callback(value)),
    onGameProgress: (callback) => ipcRenderer.on('game-progress', (_event, value) => callback(value)),
    onGameExit: (callback) => ipcRenderer.on('game-exit', (_event, value) => callback(value)),
    onLaunchError: (callback) => ipcRenderer.on('launch-error', (_event, value) => callback(value)),
    onGameCrashDetected: (callback) => ipcRenderer.on('game-crash-detected', (_event, value) => callback(value)),
    removeGameExitListener: () => ipcRenderer.removeAllListeners('game-exit'),
    uploadLogsManually: () => ipcRenderer.invoke('upload-logs-manually'),
    removeLogListeners: () => {
        ipcRenderer.removeAllListeners('game-log');
        ipcRenderer.removeAllListeners('game-progress');
    },

    // Discord RPC
    setDiscordActivity: (activity) => ipcRenderer.invoke('discord-set-activity', activity),
    clearDiscordActivity: () => ipcRenderer.invoke('discord-clear-activity'),

    // Modrinth
    modrinthSearch: (params) => ipcRenderer.invoke('modrinth-search', params),
    modrinthGetProject: (projectId) => ipcRenderer.invoke('modrinth-get-project', { projectId }),
    modrinthGetProjects: (projectIds) => ipcRenderer.invoke('modrinth-get-projects', { projectIds }),
    modrinthGetVersions: (params) => ipcRenderer.invoke('modrinth-get-versions', params),
    onInstallProgress: (callback) => ipcRenderer.on('install-progress', (event, data) => callback(data)),
    removeInstallProgressListeners: () => ipcRenderer.removeAllListeners('install-progress'),
    modrinthGetTags: (type) => ipcRenderer.invoke('modrinth-get-tags', { type }),
    modrinthInstallMod: (params) => ipcRenderer.invoke('modrinth-install-mod', params),
    getInstanceMods: (instancePath) => ipcRenderer.invoke('get-instance-mods', instancePath),
    onInstanceModsUpdated: (callback) => ipcRenderer.on('instance-mods-updated', (_event, value) => callback(value)),
    removeInstanceModsListener: () => ipcRenderer.removeAllListeners('instance-mods-updated'),
    deleteMod: (filePath) => ipcRenderer.invoke('delete-mod', filePath),
    addInstanceMods: async (instancePath, filePaths) => {
        console.log('[Preload] Invoking add-instance-mods', { instancePath, count: filePaths?.length });
        try {
            const result = await ipcRenderer.invoke('add-instance-mods', { instancePath, filePaths });
            console.log('[Preload] Result from add-instance-mods', result);
            return result;
        } catch (e) {
            console.error('[Preload] Error invoking add-instance-mods', e);
            throw e;
        }
    },
    selectModFiles: () => ipcRenderer.invoke('select-mod-files'),
    modrinthInstallModpack: (params) => ipcRenderer.invoke('modrinth-install-modpack', params),
    modrinthCancelInstall: (projectId) => ipcRenderer.invoke('modrinth-cancel-install', { projectId }),
    getInstanceResourcePacks: (instancePath) => ipcRenderer.invoke('get-instance-resource-packs', instancePath),
    selectResourcePackFiles: () => ipcRenderer.invoke('select-resource-pack-files'),
    addInstanceResourcePacks: async (instancePath, filePaths) => {
        console.log('[Preload] Invoking add-instance-resource-packs', { instancePath, count: filePaths?.length });
        try {
            const result = await ipcRenderer.invoke('add-instance-resource-packs', { instancePath, filePaths });
            console.log('[Preload] Result from add-instance-resource-packs', result);
            return result;
        } catch (e) {
            console.error('[Preload] Error invoking add-instance-resource-packs', e);
            throw e;
        }
    },
    deleteResourcePack: (filePath) => ipcRenderer.invoke('delete-resource-pack', filePath),

    // Instances
    getInstances: () => ipcRenderer.invoke('get-instances'),
    getInstanceByPath: (path) => ipcRenderer.invoke('get-instance-by-path', path),
    saveInstance: (data) => ipcRenderer.invoke('save-instance', data),
    getInstancePlayTime: (instanceId) => ipcRenderer.invoke('get-instance-playtime', instanceId), // [NEW]

    // Import
    importInstanceDialog: () => ipcRenderer.invoke('import-instance-dialog'),
    performImportInstance: (path) => ipcRenderer.invoke('perform-import-instance', path),

    // Discovery
    getDiscoverServers: (params) => ipcRenderer.invoke('get-discover-servers', params),
    getDiscoverCategories: () => ipcRenderer.invoke('get-discover-categories'),
    getDiscoverMetadata: () => ipcRenderer.invoke('get-discover-metadata'),
    joinServer: (payload) => ipcRenderer.invoke('join-server', payload),
    smartJoinServer: (payload) => ipcRenderer.invoke('smart-join-server', payload),
    on: (channel, callback) => {
        const validChannels = ['smart-join-progress'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (_event, ...args) => callback(...args));
        }
    },
    removeListener: (channel, callback) => {
        const validChannels = ['smart-join-progress'];
        if (validChannels.includes(channel)) {
            ipcRenderer.removeListener(channel, callback);
        }
    },

    // Auto Update
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
    removeUpdateListener: () => ipcRenderer.removeAllListeners('update-status'),

    // Marketing
    subscribeToNewsletter: (email) => ipcRenderer.invoke('subscribe-newsletter', email),

    // Unified Telemetry
    trackTelemetryEvent: (type, metadata) => ipcRenderer.invoke('track-telemetry-event', { type, metadata }),
    getAuthUserId: () => ipcRenderer.invoke('get-auth-user-id'), // Returns authenticated backend user ID
});
