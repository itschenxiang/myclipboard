# MyClipboard 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 macOS 菜单栏剪贴板管理工具，支持文字/图片历史记录、去重、Pin、标签和搜索。

**Architecture:** Electron 主进程负责托盘管理、剪贴板监听和 JSON 文件存储，通过 IPC 向渲染进程暴露 API。渲染进程是一个无边框面板窗口，使用原生 HTML/CSS/JS 实现 UI。

**Tech Stack:** Electron (latest stable), vanilla HTML/CSS/JS, JSON 文件存储, electron-builder

---

### Task 1: 项目骨架

**Files:**
- Create: `package.json`
- Create: `electron-builder.yml`
- Create: `.gitignore`
- Create: `assets/icon.png` (placeholder)

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "myclipboard",
  "version": "1.0.0",
  "description": "A clipboard manager for macOS",
  "main": "src/main/index.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  }
}
```

- [ ] **Step 2: 创建 electron-builder.yml**

```yaml
appId: com.myclipboard.app
productName: MyClipboard
mac:
  category: public.app-category.utilities
  target: dmg
files:
  - src/**/*
  - assets/**/*
  - package.json
```

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 4: 生成菜单栏图标占位符**

使用 ImageMagick 或 sips 生成一个 18x18 的纯色 PNG 作为临时图标:

```bash
# macOS sips 无法直接生成新图片，创建一个简单的 1x1 占位符即可
# 先用代码生成（稍后在 Task 6 中会有一个简单的图标脚本）
mkdir -p assets
```

> 注: 正式图标在开发完成后替换。目前用一个简单的 PNG 占位。可以用 `nativeImage.createEmpty()` 在开发阶段创建内存图标，暂不依赖 assets 文件。

- [ ] **Step 5: 安装依赖**

```bash
cd /Users/itschenxiang/CommonProjects/myclipboard && npm install
```

Expected: `node_modules/` 目录被创建，Electron 安装成功。

- [ ] **Step 6: 验证 Electron 启动**

创建 `src/main/index.js`:

```js
const { app } = require('electron');

app.whenReady().then(() => {
  console.log('MyClipboard started');
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
```

Run: `npm start`

Expected: 应用启动无报错（控制台输出 "MyClipboard started"），手动 Cmd+Q 退出。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json electron-builder.yml .gitignore src/main/index.js assets/
git commit -m "feat: scaffold Electron project with electron-builder"
```

---

### Task 2: Storage 层

**Files:**
- Create: `src/main/storage.js`

- [ ] **Step 1: 实现 Storage 类基础框架**

```js
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
}

module.exports = { Storage };
```

- [ ] **Step 2: 实现 addTextEntry 和 addImageEntry**

在 `storage.js` 的 `Storage` 类中添加:

```js
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
    // image is a NativeImage from Electron clipboard
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
```

- [ ] **Step 3: 实现 deleteEntry, updateEntry, getAllTags, clearAll**

```js
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

  async clearAll() {
    for (const e of this.entries) {
      if (e.type === 'image') {
        try { await fs.unlink(path.join(this.dataDir, e.imagePath)); } catch {}
      }
    }
    this.entries = [];
    await this._saveHistory();
  }
```

- [ ] **Step 4: 实现 _enforceLimit, getSettings, updateSettings, getImagePath**

```js
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
    // No save here — caller saves
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
```

- [ ] **Step 5: 手动验证 Storage 层**

创建临时测试脚本 `src/main/storage_test.js`:

```js
const path = require('path');
const os = require('os');
const { Storage } = require('./storage');

async function test() {
  const tmpDir = path.join(os.tmpdir(), 'myclipboard-test-' + Date.now());
  const s = new Storage(tmpDir);
  await s.init();

  // Test add text
  const e1 = await s.addTextEntry('hello world');
  console.assert(e1.type === 'text', 'addTextEntry type');
  console.assert(e1.content === 'hello world', 'addTextEntry content');

  // Test dedup
  const e2 = await s.addTextEntry('hello world');
  console.assert(e2.id === e1.id, 'dedup: same id');
  console.assert(e2.updatedAt > e1.updatedAt, 'dedup: updatedAt increased');

  // Test add another entry
  await s.addTextEntry('second entry');
  const entries = s.getEntries();
  console.assert(entries.length === 2, 'getEntries count');
  console.assert(entries[0].content === 'hello world', 'sort: most recent first (dedup bumped)');

  // Test delete
  await s.deleteEntry(e1.id);
  console.assert(s.getEntries().length === 1, 'deleteEntry');

  // Test update tags
  await s.updateEntry(entries[0].id, { tags: ['test', 'demo'] });
  const updated = s.getEntries()[0];
  console.assert(updated.tags.includes('test'), 'updateEntry tags');

  // Test getAllTags
  const allTags = s.getAllTags();
  console.assert(allTags.includes('demo'), 'getAllTags');

  // Test pin
  await s.updateEntry(updated.id, { pinned: true });
  console.assert(s.getEntries()[0].pinned === true, 'pin entry');

  // Test search
  const searchResult = s.getEntries({ search: 'second' });
  console.assert(searchResult.length === 0, 'search: "second" not found after delete');

  // Test tag filter
  const e3 = await s.addTextEntry('another one');
  await s.updateEntry(e3.id, { tags: ['demo'] });
  const tagResult = s.getEntries({ tag: 'demo' });
  console.assert(tagResult.length === 1, 'tag filter: one match');

  // Test settings
  console.assert(s.getSettings().maxEntries === 500, 'default maxEntries');

  // Test clearAll
  await s.clearAll();
  console.assert(s.getEntries().length === 0, 'clearAll');

  // Cleanup
  const fs = require('fs').promises;
  await fs.rm(tmpDir, { recursive: true, force: true });

  console.log('All Storage tests passed!');
}

test().catch(console.error);
```

Run: `node src/main/storage_test.js`

Expected: `All Storage tests passed!`

删除测试脚本: `rm src/main/storage_test.js`

- [ ] **Step 6: Commit**

```bash
git add src/main/storage.js
git commit -m "feat: implement Storage layer with JSON persistence, dedup, and CRUD"
```

---

### Task 3: Preload + 图片协议

**Files:**
- Create: `src/preload/index.js`
- Modify: `src/main/index.js` (添加 custom protocol)

- [ ] **Step 1: 创建 preload 脚本**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myClipboard', {
  getEntries: (filter) => ipcRenderer.invoke('entries:get', filter),
  copyEntry: (id) => ipcRenderer.invoke('entries:copy', id),
  deleteEntry: (id) => ipcRenderer.invoke('entries:delete', id),
  updateEntry: (id, changes) => ipcRenderer.invoke('entries:update', id, changes),
  getAllTags: () => ipcRenderer.invoke('tags:get-all'),
  clearAll: () => ipcRenderer.invoke('entries:clear-all'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (s) => ipcRenderer.invoke('settings:update', s),
  openURL: (url) => ipcRenderer.invoke('shell:open-url', url),
  onEntriesUpdated: (cb) => {
    ipcRenderer.on('entries:updated', () => cb());
  },
});
```

- [ ] **Step 2: 注册图片 custom protocol**

在 `src/main/index.js` 中添加 `media://` 协议，使渲染进程可以加载本地图片文件:

```js
const { app, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// 在 app.whenReady 之前:
protocol.handle('media', (request) => {
  const relativePath = request.url.slice('media://'.length);
  const dataDir = path.join(app.getPath('userData'), 'myclipboard');
  const filePath = path.join(dataDir, relativePath);
  return net.fetch(pathToFileURL(filePath).toString());
});
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.js
git commit -m "feat: add preload script with IPC bridge and media protocol"
```

---

### Task 4: IPC 处理器

**Files:**
- Create: `src/main/ipc.js`

- [ ] **Step 1: 实现所有 IPC 处理器**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc.js
git commit -m "feat: implement IPC handlers for all entry operations"
```

---

### Task 5: 剪贴板监听

**Files:**
- Create: `src/main/clipboard.js`

- [ ] **Step 1: 实现 ClipboardMonitor**

```js
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
    const text = clipboard.readText();
    if (text && text !== this.lastText) {
      this.lastText = text;
      this.lastImageHash = '';
      const entry = await this.storage.addTextEntry(text);
      if (entry) this._notifyNewEntry();
      return;
    }

    const img = clipboard.readImage();
    if (!img.isEmpty()) {
      const hash = crypto.createHash('md5').update(img.toPNG()).digest('hex');
      if (hash !== this.lastImageHash) {
        this.lastImageHash = hash;
        this.lastText = '';
        const entry = await this.storage.addImageEntry(img, hash);
        if (entry) this._notifyNewEntry();
      }
    }
  }

  _notifyNewEntry() {
    // This will be set externally by main/index.js
    if (this._onNewEntry) this._onNewEntry();
  }
}

module.exports = { ClipboardMonitor };
```

- [ ] **Step 2: Commit**

```bash
git add src/main/clipboard.js
git commit -m "feat: implement clipboard polling monitor with dedup detection"
```

---

### Task 6: 托盘管理和主窗口

**Files:**
- Create: `src/main/tray.js`
- Create: `src/main/index.js` (完整实现)

- [ ] **Step 1: 实现 TrayManager**

```js
const { Tray, nativeImage } = require('electron');
const path = require('path');

class TrayManager {
  constructor(panelWindow, iconPath) {
    this.panelWindow = panelWindow;
    this.iconPath = iconPath;
    this.tray = null;
  }

  create() {
    let icon;
    try {
      icon = nativeImage.createFromPath(this.iconPath).resize({ width: 18, height: 18 });
    } catch {
      // Fallback: create a simple colored icon programmatically
      icon = nativeImage.createEmpty();
      // Use a tiny 18x18 template icon if file doesn't exist yet
      const { createTrayIcon } = require('./tray-icon');
      icon = createTrayIcon();
    }

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
    // macOS menu bar is at top
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
```

- [ ] **Step 2: 创建托盘图标生成器**

创建 `src/main/tray-icon.js`:

```js
const { nativeImage } = require('electron');

function createTrayIcon() {
  // Create an 18x18 clipboard icon as PNG buffer (simple "clipboard" shape)
  // This is a temporary programmatic icon until a real asset is provided
  const size = 18;
  const buffer = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Simple rounded rectangle shape with a clip at top
      const inRect = x >= 2 && x < size - 2 && y >= 3 && y < size - 1;
      const inClip = x >= 6 && x < 12 && y >= 1 && y < 4;
      if (inRect || inClip) {
        buffer[i] = 0;     // R
        buffer[i + 1] = 0; // G
        buffer[i + 2] = 0; // B
        buffer[i + 3] = 255; // A
      } else {
        buffer[i + 3] = 0; // transparent
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

module.exports = { createTrayIcon };
```

- [ ] **Step 3: 编写完整的主进程入口**

`src/main/index.js`:

```js
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

app.whenReady().then(async () => {
  // Custom protocol for serving local images to renderer
  protocol.handle('media', (request) => {
    const relativePath = request.url.slice('media://'.length);
    const dataDir = path.join(app.getPath('userData'), 'myclipboard');
    const filePath = path.join(dataDir, relativePath);
    return net.fetch(pathToFileURL(filePath).toString());
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
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (clipboardMonitor) clipboardMonitor.stop();
});
```

- [ ] **Step 4: 验证托盘和面板**

```bash
npm start
```

Expected: 菜单栏出现图标（黑色小方块），点击弹出空白透明窗口（因为尚未创建 renderer HTML），点击窗口外自动隐藏。

- [ ] **Step 5: Commit**

```bash
git add src/main/index.js src/main/tray.js src/main/tray-icon.js src/main/ipc.js src/main/clipboard.js src/main/storage.js src/preload/index.js
git commit -m "feat: wire up main process with tray, clipboard monitor, and IPC"
```

---

### Task 7: Renderer — HTML 结构

**Files:**
- Create: `src/renderer/index.html`

- [ ] **Step 1: 创建面板 HTML**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' media:; style-src 'self' 'unsafe-inline'; script-src 'self'">
  <title>MyClipboard</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <div id="search-bar">
      <input type="text" id="search-input" placeholder="搜索内容..." autofocus>
    </div>

    <div id="tag-filter-row" class="hidden">
    </div>

    <div id="entry-list">
    </div>

    <div id="bottom-bar">
      <button id="clear-all-btn">清空全部历史</button>
    </div>

    <!-- Preview Modal -->
    <div id="preview-overlay" class="hidden">
      <div id="preview-modal">
        <div id="preview-header">
          <span>预览</span>
          <button id="preview-close">&times;</button>
        </div>
        <div id="preview-content">
        </div>
        <div id="preview-footer">
          <div id="preview-tags" class="tag-editor-container"></div>
          <button id="preview-copy">复制</button>
          <button id="preview-delete">删除</button>
        </div>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/index.html
git commit -m "feat: add panel HTML structure with search, list, and preview modal"
```

---

### Task 8: Renderer — CSS 样式

**Files:**
- Create: `src/renderer/style.css`

- [ ] **Step 1: 编写完整 CSS**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  color: #1d1d1f;
  background: transparent;
  overflow: hidden;
  user-select: none;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 5px 25px rgba(0,0,0,0.18);
  overflow: hidden;
  border: 0.5px solid rgba(0,0,0,0.08);
}

#search-bar {
  padding: 10px 14px;
  border-bottom: 1px solid #e8e8ed;
}

#search-input {
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: #f5f5f7;
  font-size: 13px;
  color: #1d1d1f;
  outline: none;
}

#search-input::placeholder { color: #999; }
#search-input:focus { background: #ebebed; }

#tag-filter-row {
  padding: 6px 14px;
  border-bottom: 1px solid #e8e8ed;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

#tag-filter-row.hidden { display: none; }

.tag-chip {
  padding: 3px 10px;
  border-radius: 12px;
  background: #e8f0fe;
  color: #1a73e8;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}
.tag-chip:hover { background: #d2e3fc; }
.tag-chip.active { background: #1a73e8; color: #fff; }

#entry-list {
  flex: 1;
  overflow-y: auto;
  max-height: 520px;
}

.entry {
  display: flex;
  align-items: flex-start;
  padding: 10px 14px;
  border-bottom: 1px solid #f2f2f6;
  cursor: pointer;
  transition: background 0.1s;
}
.entry:hover { background: #f6f6f9; }
.entry.pinned { background: #fef9e7; }
.entry.pinned:hover { background: #fdf3d6; }

.entry-thumb {
  width: 36px;
  height: 36px;
  border-radius: 5px;
  object-fit: cover;
  flex-shrink: 0;
  margin-right: 10px;
  background: #f0f0f0;
}

.entry-main { flex: 1; min-width: 0; overflow: hidden; }

.entry-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 3px;
}

.entry-tag {
  padding: 1px 7px;
  border-radius: 10px;
  background: #e8f0fe;
  color: #1a73e8;
  font-size: 10px;
  cursor: pointer;
}
.entry-tag:hover { background: #d2e3fc; }

.entry-content {
  font-size: 13px;
  color: #1d1d1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  max-width: 260px;
}

.entry-content a { color: #1a73e8; text-decoration: none; pointer-events: none; }

.entry-content.image-name {
  color: #666;
  font-size: 12px;
}

.entry-meta {
  font-size: 11px;
  color: #999;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pin-indicator {
  font-size: 10px;
  color: #f9a825;
  font-weight: 600;
}

.entry-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 6px;
  opacity: 0;
  transition: opacity 0.1s;
}
.entry:hover .entry-actions { opacity: 1; }

.entry-actions button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 5px;
  font-size: 14px;
  color: #8e8e93;
  line-height: 1;
}
.entry-actions button:hover { background: #e8e8ed; color: #1d1d1f; }
.pin-btn.pinned { color: #f9a825; }

/* Preview Modal */
#preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
#preview-overlay.hidden { display: none; }

#preview-modal {
  background: #fff;
  border-radius: 12px;
  width: 520px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  overflow: hidden;
}

#preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid #e8e8ed;
  font-weight: 600;
  font-size: 14px;
}

#preview-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #8e8e93;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
#preview-close:hover { background: #f0f0f0; color: #1d1d1f; }

#preview-content {
  padding: 18px;
  overflow-y: auto;
  max-height: 360px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

#preview-content img {
  max-width: 100%;
  max-height: 350px;
  object-fit: contain;
  border-radius: 6px;
  display: block;
  margin: 0 auto;
}

#preview-content a {
  color: #1a73e8;
  text-decoration: underline;
  cursor: pointer;
}

#preview-footer {
  display: flex;
  align-items: center;
  padding: 10px 18px;
  border-top: 1px solid #e8e8ed;
  gap: 10px;
}

#preview-tags { flex: 1; }

.tag-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  min-height: 30px;
  align-items: center;
  cursor: text;
  background: #fafafa;
}
.tag-editor:focus-within { border-color: #1a73e8; background: #fff; }

.tag-editor input {
  border: none;
  outline: none;
  flex: 1;
  min-width: 80px;
  font-size: 12px;
  background: transparent;
}

.tag-item {
  padding: 2px 8px;
  border-radius: 10px;
  background: #e8f0fe;
  color: #1a73e8;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-item .remove-tag {
  cursor: pointer;
  font-size: 13px;
  color: #666;
}
.tag-item .remove-tag:hover { color: #e53935; }

#preview-footer button {
  padding: 5px 14px;
  border: 1px solid #d2d2d7;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #1d1d1f;
}
#preview-footer button:hover { background: #f5f5f7; }
#preview-delete { color: #e53935; border-color: #ffcdd2; }
#preview-delete:hover { background: #ffebee; }

/* Tag autocomplete dropdown */
.autocomplete-dropdown {
  position: absolute;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  max-height: 120px;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  z-index: 300;
  min-width: 100px;
}
.autocomplete-item {
  padding: 5px 12px;
  cursor: pointer;
  font-size: 12px;
}
.autocomplete-item:hover { background: #f0f0f0; }

/* Bottom bar */
#bottom-bar {
  padding: 8px 14px;
  border-top: 1px solid #e8e8ed;
  text-align: center;
}
#clear-all-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 12px;
  cursor: pointer;
}
#clear-all-btn:hover { color: #e53935; }

/* Scrollbar styling */
#entry-list::-webkit-scrollbar { width: 4px; }
#entry-list::-webkit-scrollbar-track { background: transparent; }
#entry-list::-webkit-scrollbar-thumb { background: #d2d2d7; border-radius: 2px; }
#entry-list::-webkit-scrollbar-thumb:hover { background: #b0b0b5; }

#preview-content::-webkit-scrollbar { width: 4px; }
#preview-content::-webkit-scrollbar-track { background: transparent; }
#preview-content::-webkit-scrollbar-thumb { background: #d2d2d7; border-radius: 2px; }
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/style.css
git commit -m "feat: add panel CSS styles with macOS design and preview modal"
```

---

### Task 9: Renderer — JS 交互逻辑

**Files:**
- Create: `src/renderer/app.js`

- [ ] **Step 1: 实现核心数据管理和渲染**

```js
// State
let entries = [];
let allTags = [];
let activeTagFilter = null;
let searchQuery = '';
let debounceTimer = null;
let currentPreviewEntry = null;

// DOM refs
const searchInput = document.getElementById('search-input');
const tagFilterRow = document.getElementById('tag-filter-row');
const entryList = document.getElementById('entry-list');
const clearAllBtn = document.getElementById('clear-all-btn');
const previewOverlay = document.getElementById('preview-overlay');
const previewContent = document.getElementById('preview-content');
const previewTags = document.getElementById('preview-tags');
const previewCopy = document.getElementById('preview-copy');
const previewDelete = document.getElementById('preview-delete');
const previewClose = document.getElementById('preview-close');

// Init
async function init() {
  await refresh();
  searchInput.addEventListener('input', onSearchInput);
  clearAllBtn.addEventListener('click', onClearAll);
  previewClose.addEventListener('click', closePreview);
  previewOverlay.addEventListener('click', (e) => {
    if (e.target === previewOverlay) closePreview();
  });
  previewCopy.addEventListener('click', onPreviewCopy);
  previewDelete.addEventListener('click', onPreviewDelete);
  window.myClipboard.onEntriesUpdated(() => refresh());
}

async function refresh() {
  const filter = {};
  if (searchQuery) filter.search = searchQuery;
  if (activeTagFilter) filter.tag = activeTagFilter;
  entries = await window.myClipboard.getEntries(filter);
  allTags = await window.myClipboard.getAllTags();
  render();
}

function onSearchInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    searchQuery = searchInput.value.trim();
    await refresh();
  }, 200);
}

async function onClearAll() {
  await window.myClipboard.clearAll();
  await refresh();
}

// Rendering
function render() {
  renderTagFilters();
  renderEntries();
}

function renderTagFilters() {
  if (allTags.length === 0) {
    tagFilterRow.classList.add('hidden');
    return;
  }
  tagFilterRow.classList.remove('hidden');
  tagFilterRow.innerHTML = allTags.map(tag =>
    `<span class="tag-chip${tag === activeTagFilter ? ' active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`
  ).join('');

  tagFilterRow.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const tag = chip.dataset.tag;
      activeTagFilter = activeTagFilter === tag ? null : tag;
      await refresh();
    });
  });
}

function renderEntries() {
  if (entries.length === 0) {
    entryList.innerHTML = '<div style="padding:40px;text-align:center;color:#999;font-size:13px;">暂无剪贴板历史</div>';
    return;
  }

  entryList.innerHTML = entries.map(entry => {
    const isPinned = entry.pinned ? ' pinned' : '';
    const pinIcon = entry.pinned ? '📌' : '📌';

    let contentHtml = '';
    let thumbHtml = '';

    if (entry.type === 'text') {
      const displayText = entry.content.length > 80
        ? entry.content.slice(0, 80).replace(/\n/g, ' ')
        : entry.content.replace(/\n/g, ' ');
      const linkedText = linkify(displayText);
      contentHtml = `<div class="entry-content">${escapeHtml(linkedText)}</div>`;
    } else {
      thumbHtml = `<img class="entry-thumb" src="media://${entry.imagePath}" alt="">`;
      contentHtml = `<div class="entry-content image-name">🖼️ ${entry.imagePath.split('/').pop()}</div>`;
    }

    const tagsHtml = entry.tags.length > 0
      ? `<div class="entry-tags">${entry.tags.map(t => `<span class="entry-tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    const metaHtml = `
      <div class="entry-meta">
        ${isPinned ? '<span class="pin-indicator">已置顶</span>' : ''}
        <span>${relativeTime(entry.updatedAt)}</span>
      </div>`;

    return `
      <div class="entry${isPinned}" data-id="${entry.id}">
        ${thumbHtml}
        <div class="entry-main">
          ${tagsHtml}
          ${contentHtml}
          ${metaHtml}
        </div>
        <div class="entry-actions">
          <button class="preview-btn" data-id="${entry.id}" title="预览">👁️</button>
          <button class="copy-btn" data-id="${entry.id}" title="复制">📋</button>
          <button class="pin-btn${entry.pinned ? ' pinned' : ''}" data-id="${entry.id}" title="置顶">📌</button>
          <button class="delete-btn" data-id="${entry.id}" title="删除">🗑️</button>
        </div>
      </div>`;
  }).join('');

  // Attach event listeners
  entryList.querySelectorAll('.entry').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', (e) => {
      // Ignore clicks on action buttons (handled separately)
      if (e.target.closest('button')) return;
      copyEntry(id);
    });
  });

  entryList.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyEntry(btn.dataset.id);
    });
  });

  entryList.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPreview(btn.dataset.id);
    });
  });

  entryList.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const entry = entries.find(e => e.id === btn.dataset.id);
      if (entry) {
        await window.myClipboard.updateEntry(entry.id, { pinned: !entry.pinned });
        await refresh();
      }
    });
  });

  entryList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.myClipboard.deleteEntry(btn.dataset.id);
      await refresh();
    });
  });

  // Tag click on entries → filter by that tag
  entryList.querySelectorAll('.entry-tag').forEach(tagEl => {
    tagEl.addEventListener('click', async (e) => {
      e.stopPropagation();
      activeTagFilter = tagEl.textContent.trim();
      await refresh();
    });
  });
}

async function copyEntry(id) {
  await window.myClipboard.copyEntry(id);
  // Panel hides after copy (handled in main process)
}

// Preview
async function openPreview(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  currentPreviewEntry = entry;

  if (entry.type === 'text') {
    previewContent.innerHTML = `<div style="white-space:pre-wrap;word-break:break-word;">${linkifyFull(entry.content)}</div>`;
    // Attach link click handlers
    previewContent.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.myClipboard.openURL(a.href);
      });
    });
  } else {
    previewContent.innerHTML = `<img src="media://${entry.imagePath}" alt="preview">`;
  }

  renderPreviewTags(entry);

  previewOverlay.classList.remove('hidden');
}

function renderPreviewTags(entry) {
  previewTags.innerHTML = '';

  const editor = document.createElement('div');
  editor.className = 'tag-editor';

  // Existing tags
  entry.tags.forEach(tag => {
    const tagItem = document.createElement('span');
    tagItem.className = 'tag-item';
    tagItem.innerHTML = `${escapeHtml(tag)}<span class="remove-tag" data-tag="${escapeHtml(tag)}">&times;</span>`;
    tagItem.querySelector('.remove-tag').addEventListener('click', async () => {
      await removeTagFromEntry(entry.id, tag);
    });
    editor.appendChild(tagItem);
  });

  // Input for new tags
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = entry.tags.length === 0 ? '添加标签...' : '';
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = input.value.trim().replace(/,/g, '');
      if (newTag && !entry.tags.includes(newTag)) {
        await window.myClipboard.updateEntry(entry.id, {
          tags: [...entry.tags, newTag]
        });
        await refresh();
        const updated = entries.find(e => e.id === entry.id);
        if (updated) {
          currentPreviewEntry = updated;
          renderPreviewTags(updated);
        }
      }
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && entry.tags.length > 0) {
      const lastTag = entry.tags[entry.tags.length - 1];
      await removeTagFromEntry(entry.id, lastTag);
    }
  });

  // Autocomplete
  let autocompleteDropdown = null;
  input.addEventListener('input', () => {
    if (autocompleteDropdown) {
      autocompleteDropdown.remove();
      autocompleteDropdown = null;
    }
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    const suggestions = allTags.filter(t => t.toLowerCase().startsWith(val) && !entry.tags.includes(t));
    if (suggestions.length === 0) return;

    autocompleteDropdown = document.createElement('div');
    autocompleteDropdown.className = 'autocomplete-dropdown';
    suggestions.slice(0, 5).forEach(s => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = s;
      item.addEventListener('click', async () => {
        await window.myClipboard.updateEntry(entry.id, {
          tags: [...entry.tags, s]
        });
        await refresh();
        const updated = entries.find(e => e.id === entry.id);
        if (updated) {
          currentPreviewEntry = updated;
          renderPreviewTags(updated);
        }
        if (autocompleteDropdown) autocompleteDropdown.remove();
      });
      autocompleteDropdown.appendChild(item);
    });

    const rect = input.getBoundingClientRect();
    autocompleteDropdown.style.position = 'fixed';
    autocompleteDropdown.style.left = rect.left + 'px';
    autocompleteDropdown.style.top = (rect.bottom + 4) + 'px';
    autocompleteDropdown.style.width = rect.width + 'px';
    document.body.appendChild(autocompleteDropdown);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (autocompleteDropdown) {
        autocompleteDropdown.remove();
        autocompleteDropdown = null;
      }
    }, 150);
  });

  editor.appendChild(input);
  previewTags.appendChild(editor);
}

async function removeTagFromEntry(entryId, tag) {
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return;
  await window.myClipboard.updateEntry(entryId, {
    tags: entry.tags.filter(t => t !== tag)
  });
  await refresh();
  const updated = entries.find(e => e.id === entryId);
  if (updated) {
    currentPreviewEntry = updated;
    renderPreviewTags(updated);
  }
}

function closePreview() {
  previewOverlay.classList.add('hidden');
  currentPreviewEntry = null;
}

async function onPreviewCopy() {
  if (currentPreviewEntry) {
    await copyEntry(currentPreviewEntry.id);
    closePreview();
  }
}

async function onPreviewDelete() {
  if (currentPreviewEntry) {
    await window.myClipboard.deleteEntry(currentPreviewEntry.id);
    closePreview();
    await refresh();
  }
}

// Utility functions
function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;

function linkify(text) {
  // Replace URLs with clickable links. In list view, links are not clickable.
  return text.replace(urlRegex, '<a href="$1">$1</a>');
}

function linkifyFull(text) {
  // Full text with clickable links for preview
  return escapeHtml(text).replace(
    /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi,
    '<a href="$1">$1</a>'
  );
}

// Close preview on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (currentPreviewEntry) {
      closePreview();
    }
  }
});

// Start app
init();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/app.js
git commit -m "feat: implement panel UI logic with search, tags, preview, and entry actions"
```

---

### Task 10: 集成验证和修复

**Files:**
- Modify: `src/main/index.js` (修复各模块引用路径)
- Modify: `src/renderer/app.js` (修复运行时问题)

- [ ] **Step 1: 启动应用验证基本流程**

```bash
npm start
```

验证清单:
- [ ] 菜单栏出现托盘图标
- [ ] 点击托盘图标弹出面板
- [ ] 搜索框可见
- [ ] 点击面板外部面板关闭
- [ ] 复制一段文字后重新打开面板，文字出现在列表中
- [ ] 再次复制相同文字，条目移到顶部而非重复
- [ ] 点击条目能复制并关闭面板
- [ ] 预览按钮能打开预览弹窗
- [ ] 标签编辑功能正常
- [ ] Pin 切换功能正常
- [ ] 清空全部历史功能正常
- [ ] 复制图片能在列表中显示缩略图

- [ ] **Step 2: 修复发现的问题并提交**

```bash
git add -A
git commit -m "fix: integration fixes from manual verification"
```

---

### Task 11: 构建配置验证

**Files:**
- Modify: `package.json` (完善构建配置)

- [ ] **Step 1: 更新 package.json**

确保 `package.json` 包含完整配置:

```json
{
  "name": "myclipboard",
  "version": "1.0.0",
  "description": "A clipboard manager for macOS",
  "main": "src/main/index.js",
  "author": "",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:mac": "electron-builder --mac"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "com.myclipboard.app",
    "productName": "MyClipboard",
    "mac": {
      "category": "public.app-category.utilities",
      "target": "dmg"
    },
    "files": [
      "src/**/*",
      "assets/**/*",
      "package.json"
    ]
  }
}
```

- [ ] **Step 2: 测试构建**

```bash
npm run build:mac
```

Expected: `dist/` 目录生成 DMG 文件，可安装运行。

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: finalize build configuration"
```

---

## 完成检查清单

- [ ] 复制文字 → 面板显示
- [ ] 复制图片 → 面板显示缩略图
- [ ] 重复内容 → 更新到顶部，不重复
- [ ] 点击条目 → 复制到剪贴板
- [ ] Pin 条目 → 固定在顶部
- [ ] 添加标签 → 自由输入 + 自动补全
- [ ] 搜索 → 过滤文本内容
- [ ] 标签筛选 → 点击快捷标签过滤
- [ ] 预览 → 弹窗显示更多内容
- [ ] 链接 → 文本中 URL 可在预览中点击打开
- [ ] 清空 → 删除所有历史
- [ ] 托盘图标 → 点击显示/隐藏面板
- [ ] 面板失焦 → 自动隐藏
- [ ] 构建 → 生成 DMG
