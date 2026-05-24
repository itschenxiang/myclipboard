const { app, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  // Register handler AFTER app is ready
  protocol.handle('media', (request) => {
    try {
      const parsed = new URL(request.url);
      const relativePath = decodeURIComponent(parsed.pathname);
      const dataDir = path.join(app.getPath('userData'), 'myclipboard');
      const filePath = path.join(dataDir, relativePath);

      // Prevent path traversal
      const normalized = path.normalize(filePath);
      if (!normalized.startsWith(dataDir)) {
        return new Response('Forbidden', { status: 403 });
      }

      return net.fetch(pathToFileURL(normalized).toString());
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  console.log('MyClipboard started');
}).catch((err) => {
  console.error('Failed to start:', err);
  app.quit();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
