/**
 * Webview preload — bridges messages from the guest app (creatorbiotree) back
 * to the TweakLens host renderer via ipcRenderer.sendToHost().
 *
 * Loaded ONLY inside the <webview> guest context (isolated world).
 * The guest page posts window.postMessage({ type: 'TWEAKLENS_SELECT', payload });
 * this script listens and forwards via IPC.
 */
const { ipcRenderer } = require('electron');

window.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || typeof data.type !== 'string') return;

  // Forward element-selection events from the injected inspector to the host
  if (data.type === 'TWEAKLENS_SELECT') {
    ipcRenderer.sendToHost('tweaklens-select', data.payload);
  }
  // Forward hover events (optional — useful for live cursor sync later)
  if (data.type === 'TWEAKLENS_HOVER') {
    ipcRenderer.sendToHost('tweaklens-hover', data.payload);
  }
});
