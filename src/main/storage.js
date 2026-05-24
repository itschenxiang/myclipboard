const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class Storage {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.historyPath = path.join(dataDir, 'history.json');
    this.imagesDir = path.join(dataDir, 'images');
    this.settingsPath = path.join(dataDir, 'settings.json');
    this.entries = [];
    this.settings = { maxEntries: 500 };
  }

  async init() {
    await fs.mkdir(this.imagesDir, { recursive: true });
    await this._loadHistory();
    await this._loadSettings();
  }

  async _loadHistory() {
    try {
      const raw = await fs.readFile(this.historyPath, 'utf-8');
      this.entries = JSON.parse(raw).entries || [];
    } catch {
      this.entries = [];
    }
  }

  async _saveHistory() {
    await fs.writeFile(this.historyPath, JSON.stringify({ version: 1, entries: this.entries }, null, 2));
  }

  async _loadSettings() {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8');
      this.settings = { ...this.settings, ...JSON.parse(raw) };
    } catch { /* use defaults */ }
  }

  async _saveSettings() {
    await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
  }

  getEntries(filter = {}) {
    let result = [...this.entries];

    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(e =>
        e.type === 'text' && e.content.toLowerCase().includes(q)
      );
    }

    if (filter.tag) {
      result = result.filter(e => e.tags.includes(filter.tag));
    }

    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    return result;
  }

  async addTextEntry(text) {
    const existing = this.entries.find(e => e.type === 'text' && e.content === text);
    if (existing) {
      existing.updatedAt = Date.now();
      await this._saveHistory();
      return existing;
    }

    const entry = {
      id: crypto.randomUUID(),
      type: 'text',
      content: text,
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.entries.unshift(entry);
    await this._enforceLimit();
    await this._saveHistory();
    return entry;
  }

  async addImageEntry(image, imageHash) {
    const existing = this.entries.find(e => e.type === 'image' && e.imageHash === imageHash);
    if (existing) {
      existing.updatedAt = Date.now();
      await this._saveHistory();
      return existing;
    }

    const id = crypto.randomUUID();
    const filename = `${id}.png`;
    const pngBuffer = image.toPNG();
    await fs.writeFile(path.join(this.imagesDir, filename), pngBuffer);

    const entry = {
      id,
      type: 'image',
      imagePath: `images/${filename}`,
      imageHash,
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.entries.unshift(entry);
    await this._enforceLimit();
    await this._saveHistory();
    return entry;
  }

  async deleteEntry(id) {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return;
    if (entry.type === 'image') {
      try { await fs.unlink(path.join(this.dataDir, entry.imagePath)); } catch {}
    }
    this.entries = this.entries.filter(e => e.id !== id);
    await this._saveHistory();
  }

  async updateEntry(id, changes) {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return null;
    if (changes.tags !== undefined) entry.tags = changes.tags;
    if (changes.pinned !== undefined) entry.pinned = changes.pinned;
    entry.updatedAt = Date.now();
    await this._saveHistory();
    return entry;
  }

  getAllTags() {
    const tagSet = new Set();
    for (const e of this.entries) {
      for (const t of e.tags) tagSet.add(t);
    }
    return [...tagSet].sort();
  }

  async clearAll(keepPinned = true) {
    const toRemove = keepPinned
      ? this.entries.filter(e => !e.pinned)
      : [...this.entries];

    for (const e of toRemove) {
      if (e.type === 'image') {
        try { await fs.unlink(path.join(this.dataDir, e.imagePath)); } catch {}
      }
    }

    if (keepPinned) {
      this.entries = this.entries.filter(e => e.pinned);
    } else {
      this.entries = [];
    }
    await this._saveHistory();
  }

  async _enforceLimit() {
    const max = this.settings.maxEntries || 500;
    if (this.entries.length <= max) return;

    const unpinned = this.entries
      .filter(e => !e.pinned)
      .sort((a, b) => a.createdAt - b.createdAt);

    const excess = this.entries.length - max;
    const toRemove = unpinned.slice(0, excess);

    for (const entry of toRemove) {
      if (entry.type === 'image') {
        try { await fs.unlink(path.join(this.dataDir, entry.imagePath)); } catch {}
      }
      this.entries = this.entries.filter(e => e.id !== entry.id);
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await this._saveSettings();
    await this._enforceLimit();
    await this._saveHistory();
  }

  getImagePath(entryId) {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry || entry.type !== 'image') return null;
    return path.join(this.dataDir, entry.imagePath);
  }
}

module.exports = { Storage };
