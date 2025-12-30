const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded'); // DEBUG LOG

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    hide: () => ipcRenderer.send('window-hide'),
    show: () => ipcRenderer.send('window-show'),


    microsoftLogin: () => ipcRenderer.invoke('microsoft-login'),
    microsoftRefresh: (refreshToken) => ipcRenderer.invoke('refresh-microsoft-token', refreshToken),
    selectFile: () => ipcRenderer.invoke('select-file'),
    openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
    openPath: (path) => ipcRenderer.invoke('open-path', path),
    log: (level, message) => ipcRenderer.send('renderer-log', { level, message }),
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
    modrinthInstallMod: (params) => ipcRenderer.invoke('modrinth-install-mod', params),
    getInstanceMods: (instancePath) => ipcRenderer.invoke('get-instance-mods', instancePath),
    deleteMod: (filePath) => ipcRenderer.invoke('delete-mod', filePath),
    addInstanceMods: (instancePath, filePaths) => ipcRenderer.invoke('add-instance-mods', { instancePath, filePaths }),
    selectModFiles: () => ipcRenderer.invoke('select-mod-files'),
    modrinthInstallModpack: (params) => ipcRenderer.invoke('modrinth-install-modpack', params),
    modrinthCancelInstall: (projectId) => ipcRenderer.invoke('modrinth-cancel-install', { projectId }),
    getInstanceResourcePacks: (instancePath) => ipcRenderer.invoke('get-instance-resource-packs', instancePath),
});
