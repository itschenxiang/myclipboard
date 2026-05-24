const { nativeImage } = require('electron');
const zlib = require('zlib');

function createTrayIcon() {
  const S = 72;       // draw size
  const T = 18;       // tray size
  const buf = Buffer.alloc(S * S * 4, 0);

  // #007AFF blue, no fill — exactly like the in-app copy button
  const R = 0x00, G = 0x7A, B = 0xFF, A = 255;

  // Map from the in-app SVG (viewBox 0 0 24 24, stroke-width 2):
  // Front rect:  x=9  y=9  w=13 h=13 rx=2
  // Back  path:  M5 15 H4 a2 2 0 0 1-2-2 V4 a2 2 0 0 1 2-2 h9 a2 2 0 0 1 2 2 v1
  // The back page is the "shadow" rect behind and to the bottom-left.
  const scale = S / 24;
  const sw = 2 * scale;       // stroke width in pixels (~6)

  // Front rounded-rect bounds (in draw-space pixels)
  const fx = 9 * scale,  fy = 9 * scale,  fw = 13 * scale,  fh = 13 * scale,  fr = 2 * scale;
  // Back rounded-rect bounds (derived from the path: x≈2..15, y≈2..15)
  const bx = 2 * scale,  by = 2 * scale,  bw = 13 * scale,  bh = 13 * scale,  br = 2 * scale;

  function insideRR(px, py, rx, ry, rw, rh, r) {
    const cx = Math.max(rx + r, Math.min(px, rx + rw - r));
    const cy = Math.max(ry + r, Math.min(py, ry + rh - r));
    const dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  }

  function onOutline(px, py, rx, ry, rw, rh, r) {
    return insideRR(px, py, rx - sw / 2, ry - sw / 2, rw + sw, rh + sw, r + sw / 2) &&
           !insideRR(px, py, rx + sw / 2, ry + sw / 2, rw - sw, rh - sw, Math.max(r - sw / 2, 0));
  }

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (onOutline(x, y, bx, by, bw, bh, br) || onOutline(x, y, fx, fy, fw, fh, fr)) {
        const i = (y * S + x) * 4;
        buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = A;
      }
    }
  }

  const png = encodePNG(S, S, buf);
  const img = nativeImage.createFromBuffer(png);
  img.setTemplateImage(false);
  return img.resize({ width: T, height: T });
}

function encodePNG(w, h, rgba) {
  const rawSize = h * (1 + w * 4);
  const raw = Buffer.alloc(rawSize);
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [ihdr(w, h), idat(compressed), iend()];
  return Buffer.concat([sig, ...chunks]);
}

function pngChunk(type, data) {
  const buf = Buffer.alloc(12 + data.length);
  buf.writeUInt32BE(data.length, 0);
  buf.write(type, 4, 'ascii');
  data.copy(buf, 8);
  buf.writeUInt32BE(crc32(buf.slice(4, 8 + data.length)), 8 + data.length);
  return buf;
}

function ihdr(w, h) {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(w, 0); d.writeUInt32BE(h, 4);
  d[8] = 8; d[9] = 6; // 8-bit RGBA
  return pngChunk('IHDR', d);
}

function idat(c) { return pngChunk('IDAT', c); }
function iend() { return pngChunk('IEND', Buffer.alloc(0)); }

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

module.exports = { createTrayIcon };
