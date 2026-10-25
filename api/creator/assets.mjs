import { randomUUID } from 'node:crypto';
import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { loadServerProfile, verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';

export const config = { api: { bodyParser: false } };

const MAX_IMAGE_BYTES = 2_900_000;
const MAX_THUMBNAIL_BYTES = 300_000;
const ASSET_TYPES = new Set(['avatar', 'artwork', 'wip', 'thumbnail']);

function webpDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 30
    || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP'
    || bytes.readUInt32LE(4) !== bytes.length - 8) return null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkName = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    if (chunkSize > bytes.length - payloadOffset) return null;
    if (chunkName === 'VP8X' && chunkSize >= 10) {
      return {
        width: 1 + bytes.readUIntLE(payloadOffset + 4, 3),
        height: 1 + bytes.readUIntLE(payloadOffset + 7, 3)
      };
    }
    if (chunkName === 'VP8 ' && chunkSize >= 10) {
      const frameTag = bytes[payloadOffset] | (bytes[payloadOffset + 1] << 8) | (bytes[payloadOffset + 2] << 16);
      const isKeyFrame = (frameTag & 1) === 0;
      const hasSyncCode = bytes[payloadOffset + 3] === 0x9d && bytes[payloadOffset + 4] === 0x01 && bytes[payloadOffset + 5] === 0x2a;
      if (isKeyFrame && hasSyncCode) {
        return {
          width: bytes.readUInt16LE(payloadOffset + 6) & 0x3fff,
          height: bytes.readUInt16LE(payloadOffset + 8) & 0x3fff
        };
      }
    }
    if (chunkName === 'VP8L' && chunkSize >= 5 && bytes[payloadOffset] === 0x2f) {
      const b1 = bytes[payloadOffset + 1];
      const b2 = bytes[payloadOffset + 2];
      const b3 = bytes[payloadOffset + 3];
      const b4 = bytes[payloadOffset + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10))
      };
    }
    offset = payloadOffset + chunkSize + (chunkSize & 1);
  }
  return null;
}

function isAllowedPreviewSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return false;
  return width >= height ? width <= 1280 && height <= 720 : width <= 720 && height <= 1280;
}

function decodeResizedImage(value, assetType) {
  if (assetType === 'thumbnail') {
    const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(value || ''));
    if (!match) return null;
    const encoded = match[1];
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > MAX_THUMBNAIL_BYTES || bytes.toString('base64') !== encoded) return null;
    const dimensions = webpDimensions(bytes);
    if (!dimensions || !isAllowedPreviewSize(dimensions.width, dimensions.height)) return null;
    return { bytes, mimeType: 'image/webp', extension: 'webp' };
  }
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(value || ''));
  if (!match) return null;
  const encoded = match[1];
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== encoded) return null;
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
  return { bytes, mimeType: 'image/jpeg', extension: 'jpg' };
}

function objectPath(userId, assetType, extension) {
  const type = ASSET_TYPES.has(assetType) ? assetType : 'artwork';
  return `${userId}/${type}-${randomUUID()}.${extension}`;
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'media_not_configured', message: 'Creator media storage is not configured.' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;

  let body;
  try { body = await readJsonBody(req, 4_000_000); }
  catch (error) { return sendJson(res, safeErrorStatus(error, 400), { error: 'invalid_request', message: 'The image upload could not be read.' }); }
  const assetType = ASSET_TYPES.has(body.assetType) ? body.assetType : 'artwork';
  const asset = decodeResizedImage(body.dataUrl, assetType);
  if (!asset) {
    const message = assetType === 'thumbnail'
      ? 'Upload a 720p WebP preview no larger than 300,000 bytes.'
      : 'Upload a resized JPEG image under 2.9 MB.';
    return sendJson(res, 400, { error: 'invalid_image', message });
  }

  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 401, { error: 'authentication_required' });
    if (!(session.user.email_confirmed_at || session.user.confirmed_at)) return sendJson(res, 403, { error: 'email_verification_required', message: 'Verify your email before uploading Creator media.' });
    const profile = await loadServerProfile(config, session.user.id, String(session.user.email || ''));
    if (profile.role !== 'creator') return sendJson(res, 403, { error: 'creator_role_required', message: 'Save your Creator profile before uploading media.' });
    if (!(await consumeRateLimit(req, config, 'creator-asset-upload', 180, 60 * 60))) return sendJson(res, 429, { error: 'rate_limited', message: 'Too many image uploads. Please try again later.' });

    const path = objectPath(session.user.id, assetType, asset.extension);
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/creator-public-assets/${encodedPath}`, {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': asset.mimeType,
        'cache-control': '31536000',
        'x-upsert': 'false'
      },
      body: asset.bytes,
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) {
      console.error('Supabase media upload failed with HTTP', response.status);
      return sendJson(res, 503, { error: 'media_store_unavailable', message: 'The Creator image could not be stored. Your resized local copy remains available; retry later.' });
    }
    const url = `${config.supabaseUrl}/storage/v1/object/public/creator-public-assets/${encodedPath}`;
    sendJson(res, 201, { ok: true, url, assetType });
  } catch (error) {
    console.error('Creator media upload failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'media_upload_unavailable', message: 'Creator image storage is temporarily unavailable. Your resized local copy remains available; retry later.' });
  }
}
