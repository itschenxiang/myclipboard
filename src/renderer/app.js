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

    let contentHtml = '';
    let thumbHtml = '';

    if (entry.type === 'text') {
      const displayText = entry.content.length > 80
        ? entry.content.slice(0, 80).replace(/\n/g, ' ')
        : entry.content.replace(/\n/g, ' ');
      const linkedText = linkify(displayText);
      contentHtml = `<div class="entry-content">${linkedText}</div>`;
    } else {
      thumbHtml = `<img class="entry-thumb" src="media://${entry.imagePath}" alt="">`;
      contentHtml = `<div class="entry-content image-name">${escapeHtml(entry.imagePath.split('/').pop())}</div>`;
    }

    const tagsHtml = entry.tags.length > 0
      ? `<div class="entry-tags">${entry.tags.map(t => `<span class="entry-tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    const metaHtml = `
      <div class="entry-meta">
        ${entry.pinned ? '<span class="pin-indicator">已置顶</span>' : ''}
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
    previewContent.innerHTML = `<img src="media://${entry.imagePath}" alt="preview">`;
  }

  renderPreviewTags(entry);
  previewOverlay.classList.remove('hidden');
}

function renderPreviewTags(entry) {
  previewTags.innerHTML = '';

  const editor = document.createElement('div');
  editor.className = 'tag-editor';

  entry.tags.forEach(tag => {
    const tagItem = document.createElement('span');
    tagItem.className = 'tag-item';
    tagItem.innerHTML = `${escapeHtml(tag)}<span class="remove-tag" data-tag="${escapeHtml(tag)}">&times;</span>`;
    tagItem.querySelector('.remove-tag').addEventListener('click', async () => {
      await removeTagFromEntry(entry.id, tag);
    });
    editor.appendChild(tagItem);
  });

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
  return text.replace(urlRegex, '<a href="$1">$1</a>');
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
