const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

contextBridge.exposeInMainWorld('tweaklens', {
  version: '1.0.0',
  webviewPreload: pathToFileURL(path.join(__dirname, 'webview-preload.js')).href,
  // CDP device emulation — call from renderer with the webview's webContentsId
  emulate: (wcId, params) => ipcRenderer.invoke('tl:emulate', wcId, params),
  clearEmulation: (wcId) => ipcRenderer.invoke('tl:clearEmulation', wcId)
});
