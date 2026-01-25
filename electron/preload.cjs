const { contextBridge, ipcRenderer, webUtils } = require('electron');


contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    hide: () => ipcRenderer.send('window-hide'),
    show: () => ipcRenderer.send('window-show'),


    // Auth
    register: (payload) => ipcRenderer.invoke('register', payload),
    login: (payload) => ipcRenderer.invoke('login', payload),
    logout: () => ipcRenderer.invoke('logout'),
    linkCredentials: (payload) => ipcRenderer.invoke('link-credentials', payload),
    linkMicrosoftAccount: (consent) => ipcRenderer.invoke('link-microsoft', consent),
    getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
    linkDiscord: () => ipcRenderer.invoke('link-discord'),
    getInviteCode: () => ipcRenderer.invoke('get-invite-code'),

    microsoftLogin: (consent) => ipcRenderer.invoke('microsoft-login', consent),
    microsoftRefresh: (refreshToken) => ipcRenderer.invoke('refresh-microsoft-token', refreshToken),
    refreshBackendSession: () => ipcRenderer.invoke('refresh-backend-session'),
    getBackendToken: () => ipcRenderer.invoke('get-backend-token'),
    detectLocalAccounts: () => ipcRenderer.invoke('detect-local-accounts'),
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
    stopGame: (gameDir) => ipcRenderer.send('stop-game', gameDir),
    focusGame: (gameDir) => ipcRenderer.send('focus-game', gameDir),
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
        try {
            return await ipcRenderer.invoke('add-instance-mods', { instancePath, filePaths });
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
        try {
            return await ipcRenderer.invoke('add-instance-resource-packs', { instancePath, filePaths });
        } catch (e) {
            console.error('[Preload] Error invoking add-instance-resource-packs', e);
            throw e;
        }
    },
    deleteResourcePack: (filePath) => ipcRenderer.invoke('delete-resource-pack', filePath),

    // Shaders
    getInstanceShaders: (instancePath) => ipcRenderer.invoke('get-instance-shaders', instancePath),
    selectShaderFiles: () => ipcRenderer.invoke('select-shader-files'),
    addInstanceShaders: async (instancePath, filePaths) => {
        try {
            return await ipcRenderer.invoke('add-instance-shaders', { instancePath, filePaths });
        } catch (e) {
            console.error('[Preload] Error invoking add-instance-shaders', e);
            throw e;
        }
    },
    deleteShader: (filePath) => ipcRenderer.invoke('delete-shader', filePath),

    // Instances
    getInstances: () => ipcRenderer.invoke('get-instances'),
    getRunningInstances: () => ipcRenderer.invoke('get-running-instances'),
    onRunningInstancesChanged: (callback) => ipcRenderer.on('running-instances-changed', (_event, value) => callback(value)),
    removeRunningInstancesListener: () => ipcRenderer.removeAllListeners('running-instances-changed'),
    getInstanceByPath: (path) => ipcRenderer.invoke('get-instance-by-path', path),
    saveInstance: (data) => ipcRenderer.invoke('save-instance', data),
    getInstancePlayTime: (instanceId) => ipcRenderer.invoke('get-instance-playtime', instanceId),
    getTotalPlayTime: () => ipcRenderer.invoke('get-total-playtime'),
    getPlaytimeBreakdown: () => ipcRenderer.invoke('get-playtime-breakdown'),
    getPlaytimeHistory: (start, end) => ipcRenderer.invoke('get-playtime-history', start, end),
    getPlaytimeDetailed: () => ipcRenderer.invoke('get-playtime-detailed'),
    getPlaytimeDaily: (date) => ipcRenderer.invoke('get-playtime-daily', date),
    syncPlaytime: () => ipcRenderer.invoke('sync-playtime'),
    onPlaytimeUpdated: (callback) => ipcRenderer.on('playtime-updated', (_event, value) => callback(value)),
    removePlaytimeListener: () => ipcRenderer.removeAllListeners('playtime-updated'),

    // Import
    importInstanceDialog: () => ipcRenderer.invoke('import-instance-dialog'),
    performImportInstance: (path) => ipcRenderer.invoke('perform-import-instance', path),

    // Discovery
    getDiscoverServers: (params) => ipcRenderer.invoke('get-discover-servers', params),
    getDiscoverCategories: () => ipcRenderer.invoke('get-discover-categories'),
    getDiscoverMetadata: () => ipcRenderer.invoke('get-discover-metadata'),
    joinServer: (payload) => ipcRenderer.invoke('join-server', payload),
    smartJoinServer: (payload) => ipcRenderer.invoke('smart-join-server', payload),
    createServer: (payload) => ipcRenderer.invoke('create-server', payload),
    verifyServer: (payload) => ipcRenderer.invoke('verify-server', payload),
    voteServer: (payload) => ipcRenderer.invoke('vote-server', payload),
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

    // Skin
    getMinecraftSkin: (username) => ipcRenderer.invoke('get-minecraft-skin', username),
    uploadMinecraftSkin: (token, filePath, variant) => ipcRenderer.invoke('upload-minecraft-skin', { token, filePath, variant }),
    readSkinFile: (filePath) => ipcRenderer.invoke('read-skin-file', filePath),

    // Dialogs
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

    // Unified Telemetry
    trackTelemetryEvent: (type, metadata) => ipcRenderer.invoke('track-telemetry-event', { type, metadata }),
    getAuthUserId: () => ipcRenderer.invoke('get-auth-user-id'), // Returns authenticated backend user ID

    // Internal Tools
    captureMarketingShot: () => ipcRenderer.invoke('capture-marketing-shot'),
    getPathForFile: (file) => webUtils.getPathForFile(file),

    // System/App Settings
    getStartOnStartup: () => ipcRenderer.invoke('get-start-on-startup'),
    setStartOnStartup: (value) => ipcRenderer.invoke('set-start-on-startup', value),
});
