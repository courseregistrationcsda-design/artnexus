export const MAX_PREVIEW_BYTES = 300_000;
export const MAX_PREVIEW_FILE_BYTES = 15_000_000;
export const PREVIEW_QUALITIES = [0.86, 0.80, 0.74, 0.68, 0.62, 0.56, 0.50, 0.42];

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SOURCE_PIXELS = 80_000_000;
const MAX_DIMENSION_RETRIES = 10;
const DIMENSION_REDUCTION = 0.86;

function previewDimensions(width, height) {
  const landscape = width >= height;
  const maxWidth = landscape ? 1280 : 720;
  const maxHeight = landscape ? 720 : 1280;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale))
  };
}

function validateSourceFile(file) {
  if (!file || !ALLOWED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image.');
  }
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0 || Number(file.size) > MAX_PREVIEW_FILE_BYTES) {
    throw new Error('Choose an image no larger than 15 MB.');
  }
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
    } catch (_) {
      // Fall through to the Image/object-URL decoder for browsers with partial bitmap support.
    }
  }

  if (typeof Image !== 'function') throw new Error('Image decoding is unavailable in this browser.');

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('This image could not be decoded for local WebP preview.'));
        element.src = objectUrl;
      });
      return {
        image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        release: () => URL.revokeObjectURL(objectUrl)
      };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  if (typeof FileReader !== 'function') throw new Error('Local image reading is unavailable in this browser.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read on this device.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('This image could not be decoded for local WebP preview.'));
    element.src = dataUrl;
  });
  return { image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, release() {} };
}

function encodeWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('This browser could not encode a WebP preview.'));
          return;
        }
        if (!/^image\/webp$/i.test(String(blob.type || ''))) {
          reject(new Error('This browser could not encode a WebP preview.'));
          return;
        }
        resolve(blob);
      }, 'image/webp', quality);
    } catch (_) {
      reject(new Error('This browser could not encode a WebP preview.'));
    }
  });
}

/**
 * Convert a local image File into a bounded WebP preview. The input file is never
 * uploaded or returned as a fallback; callers receive only the encoded preview.
 */
export async function compressToPreviewWebP(file) {
  validateSourceFile(file);
  let source;
  let canvas;
  try {
    source = await loadImageSource(file);
    const width = Number(source.width);
    const height = Number(source.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
      || width * height > MAX_SOURCE_PIXELS) {
      throw new Error('This image has invalid or excessive pixel dimensions for a safe local preview.');
    }
    if (typeof document === 'undefined' || !document.createElement) {
      throw new Error('Canvas image processing is unavailable in this browser.');
    }

    canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context || typeof canvas.toBlob !== 'function') {
      throw new Error('Local WebP preview is unavailable in this browser. The original was not uploaded.');
    }

    const initial = previewDimensions(width, height);
    for (let dimensionAttempt = 0; dimensionAttempt <= MAX_DIMENSION_RETRIES; dimensionAttempt++) {
      const reduction = Math.pow(DIMENSION_REDUCTION, dimensionAttempt);
      canvas.width = Math.max(1, Math.floor(initial.width * reduction));
      canvas.height = Math.max(1, Math.floor(initial.height * reduction));
      context.drawImage(source.image, 0, 0, canvas.width, canvas.height);

      for (const quality of PREVIEW_QUALITIES) {
        const blob = await encodeWebp(canvas, quality);
        if (Number(blob.size) > 0 && Number(blob.size) <= MAX_PREVIEW_BYTES) return blob;
      }
    }
    throw new Error('The 720p WebP preview could not be compressed to 300,000 bytes or less. Try a simpler or smaller image.');
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (source && typeof source.release === 'function') source.release();
  }
}
