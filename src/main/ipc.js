const { ipcMain, clipboard, nativeImage, shell } = require('electron');

function registerIpcHandlers(storage, panelWindow) {
  ipcMain.handle('entries:get', (_event, filter) => {
    try {
      return storage.getEntries(filter || {});
    } catch (err) {
      console.error('entries:get error:', err);
      return [];
    }
  });

  ipcMain.handle('entries:copy', async (_event, id) => {
    try {
      const entries = storage.getEntries();
      const entry = entries.find(e => e.id === id);
      if (!entry) return false;

      if (entry.type === 'text') {
        clipboard.writeText(entry.content);
      } else if (entry.type === 'image') {
        const imgPath = storage.getImagePath(id);
        if (imgPath) {
          clipboard.writeImage(nativeImage.createFromPath(imgPath));
        } else {
          return false;
        }
      }

      await storage.updateEntry(id, {});
      panelWindow.hide();
      notifyRenderer();
      return true;
    } catch (err) {
      console.error('entries:copy error:', err);
      return false;
    }
  });

  ipcMain.handle('entries:delete', async (_event, id) => {
    try {
      await storage.deleteEntry(id);
      notifyRenderer();
    } catch (err) {
      console.error('entries:delete error:', err);
    }
  });

  ipcMain.handle('entries:update', async (_event, id, changes) => {
    try {
      const result = await storage.updateEntry(id, changes);
      notifyRenderer();
      return result;
    } catch (err) {
      console.error('entries:update error:', err);
      return null;
    }
  });

  ipcMain.handle('tags:get-all', () => {
    try {
      return storage.getAllTags();
    } catch (err) {
      console.error('tags:get-all error:', err);
      return [];
    }
  });

  ipcMain.handle('entries:clear-all', async () => {
    try {
      await storage.clearAll();
      notifyRenderer();
    } catch (err) {
      console.error('entries:clear-all error:', err);
    }
  });

  ipcMain.handle('settings:get', () => {
    try {
      return storage.getSettings();
    } catch (err) {
      console.error('settings:get error:', err);
      return { maxEntries: 500 };
    }
  });

  ipcMain.handle('settings:update', async (_event, settings) => {
    try {
      await storage.updateSettings(settings);
    } catch (err) {
      console.error('settings:update error:', err);
    }
  });

  ipcMain.handle('shell:open-url', async (_event, url) => {
    try {
      await shell.openExternal(url);
    } catch (err) {
      console.error('shell:open-url error:', err);
    }
  });

  function notifyRenderer() {
    panelWindow.webContents.send('entries:updated');
  }
}

module.exports = { registerIpcHandlers };
