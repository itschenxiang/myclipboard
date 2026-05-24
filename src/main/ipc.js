const { ipcMain, clipboard, shell } = require('electron');
const path = require('path');

function registerIpcHandlers(storage, panelWindow) {
  ipcMain.handle('entries:get', (_event, filter) => {
    return storage.getEntries(filter || {});
  });

  ipcMain.handle('entries:copy', (_event, id) => {
    const entries = storage.getEntries();
    const entry = entries.find(e => e.id === id);
    if (!entry) return false;

    if (entry.type === 'text') {
      clipboard.writeText(entry.content);
    } else if (entry.type === 'image') {
      const imgPath = storage.getImagePath(id);
      if (imgPath) {
        const { nativeImage } = require('electron');
        clipboard.writeImage(nativeImage.createFromPath(imgPath));
      }
    }

    // Update timestamp and bump to top
    storage.updateEntry(id, {});
    panelWindow.hide();
    notifyRenderer();
    return true;
  });

  ipcMain.handle('entries:delete', async (_event, id) => {
    await storage.deleteEntry(id);
    notifyRenderer();
  });

  ipcMain.handle('entries:update', async (_event, id, changes) => {
    const result = await storage.updateEntry(id, changes);
    notifyRenderer();
    return result;
  });

  ipcMain.handle('tags:get-all', () => {
    return storage.getAllTags();
  });

  ipcMain.handle('entries:clear-all', async () => {
    await storage.clearAll();
    notifyRenderer();
  });

  ipcMain.handle('settings:get', () => {
    return storage.getSettings();
  });

  ipcMain.handle('settings:update', async (_event, settings) => {
    await storage.updateSettings(settings);
  });

  ipcMain.handle('shell:open-url', (_event, url) => {
    shell.openExternal(url);
  });

  function notifyRenderer() {
    panelWindow.webContents.send('entries:updated');
  }
}

module.exports = { registerIpcHandlers };
