const { nativeImage } = require('electron');

function createTrayIcon() {
  const size = 18;
  const buf = Buffer.alloc(size * size * 4);
  const R = 0x00, G = 0x7a, B = 0xff, A = 255;

  function set(x, y) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = A;
  }

  // Draw a 1px outline rectangle from (x1,y1) to (x2,y2) with rounded corners (r)
  function rectOutline(x1, y1, x2, y2, r) {
    for (let x = x1 + r; x <= x2 - r; x++) { set(x, y1); set(x, y2); }
    for (let y = y1 + r; y <= y2 - r; y++) { set(x1, y); set(x2, y); }
    // Simple rounded corners: just draw the corner pixels
    for (let d = 0; d < r; d++) {
      set(x1 + d, y1 + r - 1 - d);
      set(x2 - d, y1 + r - 1 - d);
      set(x1 + d, y2 - r + 1 + d);
      set(x2 - d, y2 - r + 1 + d);
    }
  }

  // Back page outline (bottom-left)
  rectOutline(1, 5, 13, 16, 2);
  // Front page outline (top-right)
  rectOutline(5, 1, 17, 12, 2);

  const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
  img.setTemplateImage(false);
  return img;
}

module.exports = { createTrayIcon };
