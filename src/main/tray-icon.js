const { nativeImage } = require('electron');

function createTrayIcon() {
  const size = 18;
  const buffer = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inRect = x >= 2 && x < size - 2 && y >= 3 && y < size - 1;
      const inClip = x >= 6 && x < 12 && y >= 1 && y < 4;
      if (inRect || inClip) {
        buffer[i] = 0;
        buffer[i + 1] = 0;
        buffer[i + 2] = 0;
        buffer[i + 3] = 255;
      } else {
        buffer[i + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

module.exports = { createTrayIcon };
