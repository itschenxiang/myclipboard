const { BrowserWindow } = require('electron');

function createOCRWindow(imageDataUrl, ocrText, confidence) {
  const win = new BrowserWindow({
    width: 820,
    height: 560,
    resizable: false,
    title: 'OCR 文字识别',
    webPreferences: {
      sandbox: false,
    },
  });

  const pct = confidence != null ? Math.round(confidence * 100) : '--';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OCR 文字识别</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  font-size: 13px;
  color: #1d1d1f;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
  height: 100vh;
  -webkit-font-smoothing: antialiased;
}
#header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: #fff;
  border-bottom: 0.5px solid rgba(0,0,0,0.06);
  font-weight: 600;
}
#body {
  display: flex;
  flex: 1;
  min-height: 0;
}
#image-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-right: 0.5px solid rgba(0,0,0,0.06);
  overflow: hidden;
}
#image-panel img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  padding: 16px;
}
#text-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  background: #fff;
}
#footer {
  display: flex;
  align-items: center;
  padding: 10px 18px;
  background: #fff;
  border-top: 0.5px solid rgba(0,0,0,0.06);
  gap: 8px;
}
#copy-btn {
  margin-left: auto;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 6px;
  background: none; cursor: pointer;
  color: rgba(0,0,0,0.4);
  transition: all 0.1s ease;
}
#copy-btn:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.7); }
#meta { font-size: 11px; color: rgba(0,0,0,0.35); }
#text-panel::-webkit-scrollbar { width: 4px; }
#text-panel::-webkit-scrollbar-track { background: transparent; }
#text-panel::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }
#toast {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: #007aff;
  color: #fff;
  padding: 7px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  box-shadow: 0 4px 16px rgba(0,122,255,0.25);
}
#toast.show { opacity: 1; }
</style>
</head>
<body>
<div id="header">
  <span>OCR 文字识别</span>
</div>
<div id="body">
  <div id="image-panel"><img src="${imageDataUrl}" alt=""></div>
  <div id="text-panel">${escapeHtml(ocrText) || '(未识别到文字)'}</div>
</div>
<div id="footer">
  <span id="meta">置信度 ${pct}%</span>
  <button id="copy-btn" onclick="copyText()" title="复制文本">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  </button>
</div>
<div id="toast">复制成功</div>
<script>
function copyText() {
  var text = document.getElementById('text-panel').textContent;
  // Fallback for data:-URL (not a secure context for clipboard API)
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast();
}
function showToast() {
  var t = document.getElementById('toast');
  t.classList.add('show');
  var btn = document.getElementById('copy-btn');
  btn.style.color = '#007aff';
  setTimeout(function() { t.classList.remove('show'); btn.style.color = ''; }, 1200);
}
</script>
</body>
</html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { createOCRWindow };
