const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('tweaklens', {
  version: '1.0.0'
});
