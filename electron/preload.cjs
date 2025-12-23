const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded'); // DEBUG LOG

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    launchGame: (options) => ipcRenderer.send('launch-game', options),
    stopGame: () => ipcRenderer.send('stop-game'),
    onGameLog: (callback) => ipcRenderer.on('game-log', (_event, value) => callback(value)),
    onGameProgress: (callback) => ipcRenderer.on('game-progress', (_event, value) => callback(value)),
    onGameExit: (callback) => ipcRenderer.on('game-exit', (_event, value) => callback(value)),
    removeLogListeners: () => {
        ipcRenderer.removeAllListeners('game-log');
        ipcRenderer.removeAllListeners('game-progress');
    },
});
