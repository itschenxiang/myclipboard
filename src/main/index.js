const { app } = require('electron');

app.whenReady().then(() => {
  console.log('MyClipboard started');
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
