const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url)
});

// Catch unhandled errors in renderer and report to main
window.addEventListener('error', (e) => {
  try { ipcRenderer.send('renderer-error', { type: 'error', message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, stack: (e.error && e.error.stack) || null }); } catch (err) {}
});

window.addEventListener('unhandledrejection', (e) => {
  try { ipcRenderer.send('renderer-error', { type: 'unhandledrejection', reason: (e.reason && e.reason.stack) || String(e.reason) }); } catch (err) {}
});
