const { contextBridge } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('tweaklens', {
  version: '1.0.0',
  webviewPreload: path.join(__dirname, 'webview-preload.js')
});
