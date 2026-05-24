const { Tray } = require('electron');
const { createTrayIcon } = require('./tray-icon');

class TrayManager {
  constructor(panelWindow, iconPath) {
    this.panelWindow = panelWindow;
    this.iconPath = iconPath;
    this.tray = null;
  }

  create() {
    const icon = createTrayIcon();
    this.tray = new Tray(icon);

    this.tray.on('click', () => {
      if (this.panelWindow.isVisible()) {
        this.panelWindow.hide();
      } else {
        this._showPanel();
      }
    });
  }

  _showPanel() {
    const trayBounds = this.tray.getBounds();
    const panelSize = this.panelWindow.getSize();

    let x = Math.round(trayBounds.x + trayBounds.width / 2 - panelSize[0] / 2);
    const y = process.platform === 'darwin'
      ? Math.round(trayBounds.y + trayBounds.height)
      : Math.round(trayBounds.y - panelSize[1]);

    this.panelWindow.setPosition(x, y);
    this.panelWindow.show();
    this.panelWindow.focus();
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { TrayManager };
