const { clipboard } = require('electron');
const crypto = require('crypto');

class ClipboardMonitor {
  constructor(storage) {
    this.storage = storage;
    this.interval = 500;
    this.timer = null;
    this.lastText = '';
    this.lastImageHash = '';
  }

  start() {
    this.lastText = clipboard.readText() || '';
    const img = clipboard.readImage();
    if (!img.isEmpty()) {
      this.lastImageHash = crypto.createHash('md5').update(img.toPNG()).digest('hex');
    }

    this.timer = setInterval(() => this._check(), this.interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async _check() {
    try {
      const text = clipboard.readText();
      if (text && text !== this.lastText) {
        this.lastText = text;
        this.lastImageHash = '';
        const entry = await this.storage.addTextEntry(text);
        if (entry && this._onNewEntry) this._onNewEntry();
        return;
      }

      const img = clipboard.readImage();
      if (!img.isEmpty()) {
        const hash = crypto.createHash('md5').update(img.toPNG()).digest('hex');
        if (hash !== this.lastImageHash) {
          this.lastImageHash = hash;
          this.lastText = '';
          const entry = await this.storage.addImageEntry(img, hash);
          if (entry && this._onNewEntry) this._onNewEntry();
        }
      }
    } catch (err) {
      console.error('ClipboardMonitor check error:', err);
    }
  }
}

module.exports = { ClipboardMonitor };
