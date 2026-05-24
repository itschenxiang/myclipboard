// State
let entries = [];
let sidebarFilter = 'all';
let searchQuery = '';
let debounceTimer = null;
let currentPreviewEntry = null;

// DOM refs
const searchInput = document.getElementById('search-input');
const entryList = document.getElementById('entry-list');
const previewOverlay = document.getElementById('preview-overlay');
const previewContent = document.getElementById('preview-content');
const previewCopy = document.getElementById('preview-copy');
const previewDelete = document.getElementById('preview-delete');
const previewClose = document.getElementById('preview-close');

// SVG icon templates
const ICONS = {
  visit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>',
  pinFilled: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  typeText: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  typeLink: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  typeImage: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
};

// Init
async function init() {
  // Sidebar filter buttons
  document.querySelectorAll('.sidebar-item[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sidebarFilter = btn.dataset.filter;
      refresh();
    });
  });

  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  const infoOverlay = document.getElementById('info-overlay');
  const infoClose = document.getElementById('info-close');
  settingsBtn.addEventListener('click', () => openInfo());
  infoClose.addEventListener('click', () => closeInfo());
  infoOverlay.addEventListener('click', (e) => {
    if (e.target === infoOverlay) closeInfo();
  });

  searchInput.addEventListener('input', onSearchInput);
  window.myClipboard.onEntriesUpdated(() => refresh());
  await refresh();
}

async function refresh() {
  const filter = {};
  if (searchQuery) filter.search = searchQuery;
  entries = await window.myClipboard.getEntries(filter);

  // Client-side sidebar filtering
  if (sidebarFilter === 'pinned') {
    entries = entries.filter(e => e.pinned);
  } else if (sidebarFilter === 'text') {
    entries = entries.filter(e => e.type === 'text' && !urlRegex.test(e.content.trim()));
    urlRegex.lastIndex = 0;
  } else if (sidebarFilter === 'link') {
    entries = entries.filter(e => e.type === 'text' && urlRegex.test(e.content.trim()));
    urlRegex.lastIndex = 0;
  } else if (sidebarFilter === 'image') {
    entries = entries.filter(e => e.type === 'image');
  }

  render();
}

function onSearchInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    searchQuery = searchInput.value.trim();
    await refresh();
  }, 200);
}

// Rendering
function render() {
  renderEntries();
}

function renderEntries() {
  if (entries.length === 0) {
    entryList.innerHTML = '<div style="padding:40px;text-align:center;color:#999;font-size:13px;">暂无剪贴板历史</div>';
    return;
  }

  entryList.innerHTML = entries.map(entry => {
    const isPinned = entry.pinned ? ' pinned' : '';

    let contentHtml = '';
    let thumbHtml = '';
    let isUrl = false;

    if (entry.type === 'text') {
      isUrl = urlRegex.test(entry.content.trim());
      urlRegex.lastIndex = 0;
      const icon = isUrl ? ICONS.typeLink : ICONS.typeText;
      const iconClass = isUrl ? 'type-link' : 'type-text';
      thumbHtml = `<div class="entry-type-icon ${iconClass}">${icon}</div>`;

      const displayText = entry.content.length > 80
        ? entry.content.slice(0, 80).replace(/\n/g, ' ')
        : entry.content.replace(/\n/g, ' ');
      const linkedText = linkify(displayText);
      contentHtml = `<div class="entry-content">${linkedText}</div>`;
    } else {
      thumbHtml = `<div class="entry-type-icon type-image">${ICONS.typeImage}</div><img class="entry-thumb" data-image-id="${entry.id}" src="" alt="">`;
      contentHtml = '';
    }

    const metaHtml = `<div class="entry-meta">${relativeTime(entry.updatedAt)}</div>`;

    const pinIcon = entry.pinned ? ICONS.pinFilled : ICONS.pin;
    const visitBtn = isUrl ? `<button class="visit-btn" data-url="${escapeHtml(entry.content.trim())}" title="访问">${ICONS.visit}</button>` : '';

    return `
      <div class="entry${isPinned}" data-id="${entry.id}">
        ${thumbHtml}
        <div class="entry-main">
          ${contentHtml}
          ${metaHtml}
        </div>
        <div class="entry-actions">
          ${visitBtn}
          <button class="pin-btn${entry.pinned ? ' pinned' : ''}" data-id="${entry.id}" title="置顶">${pinIcon}</button>
          <button class="delete-btn" data-id="${entry.id}" title="删除">${ICONS.delete}</button>
        </div>
      </div>`;
  }).join('');

  // Attach event listeners
  entryList.querySelectorAll('.entry').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('svg')) return;
      copyEntry(id);
    });
  });

  entryList.querySelectorAll('.visit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.myClipboard.openURL(btn.dataset.url);
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

  // Lazy-load image thumbnails via IPC
  entryList.querySelectorAll('.entry-thumb[data-image-id]').forEach(async (img) => {
    const dataUrl = await window.myClipboard.getImageData(img.dataset.imageId);
    if (dataUrl) img.src = dataUrl;
  });
}

async function copyEntry(id) {
  const ok = await window.myClipboard.copyEntry(id);
  if (ok) {
    showToast('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;"><circle cx="12" cy="12" r="10"/><polyline points="17 8 10 15 7 12"/></svg> 复制成功');
    setTimeout(() => window.myClipboard.hidePanel(), 600);
  }
}

function showToast(msg) {
  const toast = document.getElementById('copy-toast');
  if (toast._timer) clearTimeout(toast._timer);
  toast.innerHTML = msg;
  toast.classList.add('show');
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1200);
}

// Preview
async function openPreview(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  currentPreviewEntry = entry;

  if (entry.type === 'text') {
    previewContent.innerHTML = `<div style="white-space:pre-wrap;word-break:break-word;">${linkifyFull(entry.content)}</div>`;
    previewContent.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.myClipboard.openURL(a.href);
      });
    });
  } else {
    const dataUrl = await window.myClipboard.getImageData(entry.id);
    if (dataUrl) {
      previewContent.innerHTML = `<img src="${dataUrl}" alt="preview">`;
    } else {
      previewContent.innerHTML = '<div style="color:#999;">无法加载图片</div>';
    }
  }

  previewOverlay.classList.remove('hidden');
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

// Info modal
async function openInfo() {
  const info = await window.myClipboard.getAppInfo();
  document.getElementById('info-path').textContent = info.dataDir;
  document.getElementById('info-count').textContent = info.entryCount;
  document.getElementById('info-overlay').classList.remove('hidden');
}

function closeInfo() {
  document.getElementById('info-overlay').classList.add('hidden');
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
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;

function linkify(text) {
  return escapeHtml(text).replace(urlRegex, '<a href="$1">$1</a>');
}

function linkifyFull(text) {
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
