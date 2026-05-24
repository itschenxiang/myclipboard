let _ocr = null;

function getOCR() {
  if (_ocr !== null) return _ocr;
  if (process.platform !== 'darwin') {
    _ocr = false;
    return _ocr;
  }
  try {
    _ocr = require('@cherrystudio/mac-system-ocr');
  } catch {
    _ocr = false;
  }
  return _ocr;
}

async function recognizeImage(imagePath) {
  const ocr = getOCR();
  if (!ocr) {
    throw new Error('OCR is only available on macOS 10.15+');
  }
  const result = await ocr.recognizeFromPath(imagePath, {
    languages: 'en-US, zh-Hans',
    recognitionLevel: ocr.RECOGNITION_LEVEL_ACCURATE,
    minConfidence: 0.3,
  });
  return {
    text: result.text || '',
    confidence: result.confidence || 0,
  };
}

module.exports = { recognizeImage, getOCR };
