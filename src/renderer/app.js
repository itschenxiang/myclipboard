// State
let entries = [];
let sidebarFilter = 'all';
let searchQuery = '';
let debounceTimer = null;
let currentPreviewEntry = null;

// DOM refs
const searchInput = document.getElementById('search-input');
const entryList = document.getElementById('entry-list');
const clearAllBtn = document.getElementById('clear-all-btn');
const previewOverlay = document.getElementById('preview-overlay');
const previewContent = document.getElementById('preview-content');
const previewCopy = document.getElementById('preview-copy');
const previewDelete = document.getElementById('preview-delete');
const previewClose = document.getElementById('preview-close');

// SVG icon templates
const ICONS = {
  preview: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>',
  pinFilled: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

// Init
async function init() {
  // Sidebar filter buttons
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sidebarFilter = btn.dataset.filter;
      refresh();
    });
  });

  searchInput.addEventListener('input', onSearchInput);
  clearAllBtn.addEventListener('click', onClearAll);
  previewClose.addEventListener('click', closePreview);
  previewOverlay.addEventListener('click', (e) => {
    if (e.target === previewOverlay) closePreview();
  });
  previewCopy.addEventListener('click', onPreviewCopy);
  previewDelete.addEventListener('click', onPreviewDelete);
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
  } else if (sidebarFilter === 'images') {
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

async function onClearAll() {
  await window.myClipboard.clearAll();
  await refresh();
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

    if (entry.type === 'text') {
      const displayText = entry.content.length > 80
        ? entry.content.slice(0, 80).replace(/\n/g, ' ')
        : entry.content.replace(/\n/g, ' ');
      const linkedText = linkify(displayText);
      contentHtml = `<div class="entry-content">${linkedText}</div>`;
    } else {
      thumbHtml = `<img class="entry-thumb" data-image-id="${entry.id}" src="" alt="">`;
      contentHtml = `<div class="entry-content image-name">${escapeHtml(entry.imagePath.split('/').pop())}</div>`;
    }

    const metaHtml = `<div class="entry-meta">${relativeTime(entry.updatedAt)}</div>`;

    const pinIcon = entry.pinned ? ICONS.pinFilled : ICONS.pin;

    return `
      <div class="entry${isPinned}" data-id="${entry.id}">
        ${thumbHtml}
        <div class="entry-main">
          ${contentHtml}
          ${metaHtml}
        </div>
        <div class="entry-actions">
          <button class="preview-btn" data-id="${entry.id}" title="预览">${ICONS.preview}</button>
          <button class="copy-btn" data-id="${entry.id}" title="复制">${ICONS.copy}</button>
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

  // Lazy-load image thumbnails via IPC
  entryList.querySelectorAll('.entry-thumb[data-image-id]').forEach(async (img) => {
    const dataUrl = await window.myClipboard.getImageData(img.dataset.imageId);
    if (dataUrl) img.src = dataUrl;
  });
}

async function copyEntry(id) {
  const ok = await window.myClipboard.copyEntry(id);
  if (ok) showToast('已复制');
}

function showToast(msg) {
  const toast = document.getElementById('copy-toast');
  if (toast._timer) clearTimeout(toast._timer);
  toast.textContent = msg;
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
