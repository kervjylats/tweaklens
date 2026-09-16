const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // Required for embedding guest web apps
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// --------------------------------------------------------
// CDP DEVICE EMULATION — apply real device metrics via
// Chrome DevTools Protocol on a <webview>'s webContents.
// --------------------------------------------------------
async function applyEmulation(targetWcId, params) {
  const wc = webContents.fromId(targetWcId);
  if (!wc) return;

  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
    }
  } catch (err) {
    // Debugger already attached (e.g. DevTools open) — skip emulation
    console.warn('[tweaklens] Could not attach debugger for emulation:', err.message);
    return;
  }

  try {
    await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: params.width,
      height: params.height,
      deviceScaleFactor: params.dpr || 1,
      mobile: !!params.mobile
    });

    await wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: !!params.mobile
    });

    await wc.debugger.sendCommand('Emulation.setUserAgentOverride', {
      userAgent: params.ua || ''
    });

    // Emulate media features (hover, pointer, color scheme)
    const features = [];
    if (params.media) {
      if (params.media.hover) features.push({ name: 'hover', value: params.media.hover });
      if (params.media.pointer) features.push({ name: 'pointer', value: params.media.pointer });
      if (params.media.colorScheme) features.push({ name: 'prefers-color-scheme', value: params.media.colorScheme });
    }
    await wc.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features
    });
  } catch (err) {
    console.warn('[tweaklens] Emulation command failed:', err.message);
  }
}

async function clearEmulation(targetWcId) {
  const wc = webContents.fromId(targetWcId);
  if (!wc) return;

  try {
    if (wc.debugger.isAttached()) {
      await wc.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');
      await wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
      await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
      wc.debugger.detach();
    }
  } catch (_) {
    // Best-effort cleanup
  }
}

// IPC handlers
ipcMain.handle('tl:emulate', async (e, wcId, params) => {
  await applyEmulation(wcId, params);
});

ipcMain.handle('tl:clearEmulation', async (e, wcId) => {
  await clearEmulation(wcId);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
