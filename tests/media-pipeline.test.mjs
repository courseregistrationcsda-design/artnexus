import test from 'node:test';
import assert from 'node:assert/strict';
import { compressToPreviewWebP, MAX_PREVIEW_BYTES, MAX_PREVIEW_FILE_BYTES } from '../src/media/pipeline.js';

function installBrowserMocks(t, { width, height, bytesPerPixel = 0.8, outputType = 'image/webp' }) {
  const encoded = [];
  let bitmapClosed = false;
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return { drawImage() {} }; },
    toBlob(callback, type, quality) {
      encoded.push({ width: this.width, height: this.height, quality, type });
      callback({ size: Math.max(1, Math.round(this.width * this.height * bytesPerPixel * quality)), type: outputType });
    }
  };
  const previous = new Map();
  const setGlobal = (key, value) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  setGlobal('document', { createElement(name) { assert.equal(name, 'canvas'); return canvas; } });
  setGlobal('createImageBitmap', async () => ({ width, height, close() { bitmapClosed = true; } }));
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { encoded, canvas, isBitmapClosed: () => bitmapClosed };
}

test('720p WebP pipeline keeps landscape output within 1280×720 and below the hard byte ceiling', async t => {
  const mocks = installBrowserMocks(t, { width: 4000, height: 2250 });
  const blob = await compressToPreviewWebP({ type: 'image/jpeg', size: 4_000_000 });
  const accepted = mocks.encoded.at(-1);
  assert.equal(blob.type, 'image/webp');
  assert.ok(blob.size <= MAX_PREVIEW_BYTES);
  assert.ok(accepted.width <= 1280);
  assert.ok(accepted.height <= 720);
  assert.ok(mocks.encoded.length > 8, 'the pipeline tries quality levels and then reduces dimensions instead of returning an oversized fallback');
  assert.equal(mocks.canvas.width, 0, 'the canvas is released after encoding');
  assert.equal(mocks.isBitmapClosed(), true, 'the decoded source is released after encoding');
});

test('720p WebP pipeline keeps portrait output within 720×1280', async t => {
  const mocks = installBrowserMocks(t, { width: 2250, height: 4000 });
  const blob = await compressToPreviewWebP({ type: 'image/png', size: 2_000_000 });
  const accepted = mocks.encoded.at(-1);
  assert.ok(blob.size <= 300_000);
  assert.ok(accepted.width <= 720);
  assert.ok(accepted.height <= 1280);
});

test('oversized output fails visibly after bounded retries; no original or oversized blob is returned', async t => {
  const mocks = installBrowserMocks(t, { width: 6000, height: 4000, bytesPerPixel: 1000 });
  await assert.rejects(
    compressToPreviewWebP({ type: 'image/webp', size: 1_000_000 }),
    /could not be compressed to 300,000 bytes or less/
  );
  assert.equal(mocks.canvas.width, 0);
  assert.equal(mocks.isBitmapClosed(), true);
});

test('pipeline rejects unsupported inputs and a browser that cannot encode WebP', async t => {
  await assert.rejects(compressToPreviewWebP({ type: 'image/svg+xml', size: 100 }), /Choose a JPEG, PNG, WebP, or GIF/);
  await assert.rejects(compressToPreviewWebP({ type: 'image/jpeg', size: MAX_PREVIEW_FILE_BYTES + 1 }), /no larger than 15 MB/);
  installBrowserMocks(t, { width: 100, height: 100, outputType: 'image/png' });
  await assert.rejects(compressToPreviewWebP({ type: 'image/jpeg', size: 100 }), /could not encode a WebP preview/);
});
