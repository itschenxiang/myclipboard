const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { Storage } = require('./storage');
const { ClipboardMonitor } = require('./clipboard');
const { TrayManager } = require('./tray');
const { registerIpcHandlers } = require('./ipc');

let storage;
let clipboardMonitor;
let trayManager;
let panelWindow;

function createPanelWindow() {
  const win = new BrowserWindow({
    width: 360,
    maxHeight: 600,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    type: process.platform === 'darwin' ? 'panel' : 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.on('blur', () => {
    win.hide();
  });

  return win;
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

app.whenReady().then(async () => {
  // Custom protocol for serving local images to renderer
  protocol.handle('media', (request) => {
    try {
      const parsed = new URL(request.url);
      const relativePath = decodeURIComponent(parsed.pathname);
      const dataDir = path.join(app.getPath('userData'), 'myclipboard');
      const filePath = path.join(dataDir, relativePath);

      const normalized = path.normalize(filePath);
      if (!normalized.startsWith(dataDir)) {
        return new Response('Forbidden', { status: 403 });
      }

      return net.fetch(pathToFileURL(normalized).toString());
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  const dataDir = path.join(app.getPath('userData'), 'myclipboard');
  storage = new Storage(dataDir);
  await storage.init();

  panelWindow = createPanelWindow();
  registerIpcHandlers(storage, panelWindow);

  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  trayManager = new TrayManager(panelWindow, iconPath);
  trayManager.create();

  clipboardMonitor = new ClipboardMonitor(storage);
  clipboardMonitor._onNewEntry = () => {
    panelWindow.webContents.send('entries:updated');
  };
  clipboardMonitor.start();

  console.log('MyClipboard started');
}).catch((err) => {
  console.error('Failed to start:', err);
  app.quit();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (clipboardMonitor) clipboardMonitor.stop();
});
