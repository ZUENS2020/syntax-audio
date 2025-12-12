import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url)
});
