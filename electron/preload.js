const { contextBridge } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

contextBridge.exposeInMainWorld('tweaklens', {
  version: '1.0.0',
  webviewPreload: pathToFileURL(path.join(__dirname, 'webview-preload.js')).href
});
