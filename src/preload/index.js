const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myClipboard', {
  getEntries: (filter) => ipcRenderer.invoke('entries:get', filter),
  copyEntry: (id) => ipcRenderer.invoke('entries:copy', id),
  deleteEntry: (id) => ipcRenderer.invoke('entries:delete', id),
  updateEntry: (id, changes) => ipcRenderer.invoke('entries:update', id, changes),
  clearAll: () => ipcRenderer.invoke('entries:clear-all'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (s) => ipcRenderer.invoke('settings:update', s),
  openURL: (url) => ipcRenderer.invoke('shell:open-url', url),
  getImageData: (id) => ipcRenderer.invoke('image:get-data', id),
  onEntriesUpdated: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('entries:updated', handler);
    return () => ipcRenderer.removeListener('entries:updated', handler);
  },
});
