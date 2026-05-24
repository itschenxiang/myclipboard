const { app, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Register custom protocol for serving local images to renderer BEFORE app.whenReady
protocol.handle('media', (request) => {
  const relativePath = request.url.slice('media://'.length);
  const dataDir = path.join(app.getPath('userData'), 'myclipboard');
  const filePath = path.join(dataDir, relativePath);
  return net.fetch(pathToFileURL(filePath).toString());
});

app.whenReady().then(() => {
  console.log('MyClipboard started');
}).catch((err) => {
  console.error('Failed to start:', err);
  app.quit();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
