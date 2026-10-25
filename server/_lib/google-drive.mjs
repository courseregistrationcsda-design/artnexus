import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { supabaseServiceRequest } from './supabase.mjs';

export const STORAGE_AGREEMENT_VERSION = '2026-10-16-v1';
export const MAX_DRIVE_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PREVIEW_FILE_BYTES = 6 * 1024 * 1024;

const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const MASTER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PREVIEW_MIME_TYPES = new Set(['image/webp']);
const GOOGLE_API_ORIGINS = new Set(['https://www.googleapis.com', 'https://upload.googleapis.com']);

export class GoogleDriveError extends Error {
  constructor(code, statusCode = 503, providerStatus = 0) {
    super(code);
    this.name = 'GoogleDriveError';
    this.code = code;
    this.statusCode = statusCode;
    this.providerStatus = providerStatus;
  }
}

export function isDriveFileId(value) {
  return typeof value === 'string' && DRIVE_FILE_ID_PATTERN.test(value);
}

export function driveFileIdFromPrivateUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.port || url.username || url.password || url.search || url.hash) return '';
    const match = /^\/file\/d\/([A-Za-z0-9_-]{10,200})\/view$/.exec(url.pathname);
    return match && isDriveFileId(match[1]) ? match[1] : '';
  } catch {
    return '';
  }
}

export function privateDriveFileUrl(fileId) {
  if (!isDriveFileId(fileId)) return '';
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function sanitizeDriveFileName(value, prefix = 'artwork') {
  const name = String(value || '')
    .normalize('NFKC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^A-Za-z0-9 ._()\-]/g, '')
    .slice(0, 110);
  return `${prefix}_${name || 'artwork'}`;
}

function encryptionKey(config) {
  const key = String(config?.googleDriveEncryptionKey || '');
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new GoogleDriveError('drive_encryption_not_configured', 503);
  return Buffer.from(key, 'hex');
}

export function encryptDriveRefreshToken(token, config) {
  const value = String(token || '');
  if (!value || value.length > 4096) throw new GoogleDriveError('drive_refresh_token_invalid', 400);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    refresh_token_ciphertext: ciphertext.toString('base64url'),
    refresh_token_iv: iv.toString('base64url'),
    refresh_token_tag: cipher.getAuthTag().toString('base64url')
  };
}

export function decryptDriveRefreshToken(connection, config) {
  try {
    const iv = Buffer.from(String(connection?.refresh_token_iv || ''), 'base64url');
    const ciphertext = Buffer.from(String(connection?.refresh_token_ciphertext || ''), 'base64url');
    const tag = Buffer.from(String(connection?.refresh_token_tag || ''), 'base64url');
    if (iv.length !== 12 || !ciphertext.length || ciphertext.length > 4096 || tag.length !== 16) throw new Error('bad_token_record');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(config), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new GoogleDriveError('drive_token_decryption_failed', 503);
  }
}

export async function loadDriveConnection(config, userId) {
  const query = new URLSearchParams({
    select: 'user_id,google_email,vault_folder_id,refresh_token_ciphertext,refresh_token_iv,refresh_token_tag,terms_version,terms_accepted_at,connected_at',
    user_id: `eq.${String(userId || '')}`,
    limit: '1'
  });
  const result = await supabaseServiceRequest(config, `/rest/v1/creator_drive_connections?${query.toString()}`);
  if (!result.response.ok) throw new GoogleDriveError('drive_connection_read_failed', 503, result.response.status);
  return Array.isArray(result.payload) ? result.payload[0] || null : null;
}

export async function upsertDriveConnection(config, connection) {
  const result = await supabaseServiceRequest(config, '/rest/v1/creator_drive_connections?on_conflict=user_id', {
    method: 'POST',
    body: connection,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
  if (!result.response.ok) throw new GoogleDriveError('drive_connection_write_failed', 503, result.response.status);
}

export async function removeDriveConnection(config, userId) {
  const query = new URLSearchParams({ user_id: `eq.${String(userId || '')}` });
  const result = await supabaseServiceRequest(config, `/rest/v1/creator_drive_connections?${query.toString()}`, { method: 'DELETE' });
  if (!result.response.ok) throw new GoogleDriveError('drive_connection_delete_failed', 503, result.response.status);
}

export async function refreshDriveAccessToken(config, connection) {
  if (!config?.googleDriveConfigured) throw new GoogleDriveError('drive_not_configured', 503);
  const refreshToken = decryptDriveRefreshToken(connection, config);
  const form = new URLSearchParams({
    client_id: config.googleDriveClientId,
    client_secret: config.googleDriveClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    throw new GoogleDriveError('drive_token_refresh_unavailable', 503);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== 'string') {
    const invalidGrant = payload.error === 'invalid_grant' || response.status === 400 || response.status === 401;
    throw new GoogleDriveError(invalidGrant ? 'drive_reauthorization_required' : 'drive_token_refresh_unavailable', invalidGrant ? 409 : 503, response.status);
  }
  return payload.access_token;
}

export async function driveApiRequest(accessToken, pathname, options = {}) {
  let url;
  try { url = new URL(pathname, 'https://www.googleapis.com'); }
  catch { throw new GoogleDriveError('drive_request_invalid', 400); }
  if (!GOOGLE_API_ORIGINS.has(url.origin)) throw new GoogleDriveError('drive_request_invalid', 400);
  let response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: options.accept || 'application/json',
        ...(options.headers || {})
      },
      body: options.body,
      signal: AbortSignal.timeout(options.timeoutMs || 20_000),
      redirect: 'follow'
    });
  } catch {
    throw new GoogleDriveError('drive_provider_unavailable', 503);
  }
  return response;
}

export async function driveApiJson(accessToken, pathname, options = {}) {
  const response = await driveApiRequest(accessToken, pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function ensureDriveVaultFolder(accessToken, userId) {
  const owner = String(userId || '').toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(owner)) throw new GoogleDriveError('drive_owner_invalid', 400);
  const q = `appProperties has { key='artNexusVaultOwner' and value='${owner}' } and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const query = new URLSearchParams({ q, pageSize: '10', fields: 'files(id,name,mimeType,appProperties)' });
  const listed = await driveApiJson(accessToken, `/drive/v3/files?${query.toString()}`);
  if (!listed.response.ok) throw new GoogleDriveError('drive_folder_lookup_failed', 503, listed.response.status);
  const matches = Array.isArray(listed.payload.files) ? listed.payload.files : [];
  const existing = matches.find(file => isDriveFileId(file.id) && file.mimeType === 'application/vnd.google-apps.folder'
    && file.appProperties?.artNexusVaultOwner === owner);
  if (existing) return existing.id;

  const created = await driveApiJson(accessToken, '/drive/v3/files?fields=id,name,mimeType,appProperties', {
    method: 'POST',
    body: {
      name: 'ArtNexus_Vault',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { artNexusVaultOwner: owner, artNexusVersion: '1' }
    }
  });
  if (!created.response.ok || !isDriveFileId(created.payload.id)
    || created.payload.appProperties?.artNexusVaultOwner !== owner) {
    throw new GoogleDriveError('drive_folder_create_failed', 503, created.response.status);
  }
  return created.payload.id;
}

export async function getGoogleAccountEmail(accessToken) {
  const result = await driveApiJson(accessToken, '/oauth2/v2/userinfo');
  const email = String(result.payload?.email || '').trim().toLowerCase();
  if (!result.response.ok || result.payload?.verified_email !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new GoogleDriveError('drive_account_identity_unavailable', 503, result.response.status);
  }
  return email;
}

export async function createDriveUploadSession(accessToken, connection, ownerId, options) {
  const kind = options?.kind;
  const size = Number(options?.size);
  const mimeType = String(options?.mimeType || '').toLowerCase();
  if (!['master', 'preview'].includes(kind) || !Number.isSafeInteger(size) || size < 1 || size > MAX_DRIVE_FILE_BYTES
    || (kind === 'master' && !MASTER_MIME_TYPES.has(mimeType))
    || (kind === 'preview' && (!PREVIEW_MIME_TYPES.has(mimeType) || size > MAX_PREVIEW_FILE_BYTES))) {
    throw new GoogleDriveError('drive_upload_invalid', 400);
  }
  if (!isDriveFileId(String(connection?.vault_folder_id || ''))) throw new GoogleDriveError('drive_vault_unavailable', 409);
  const fileMetadata = {
    name: sanitizeDriveFileName(options.fileName, kind),
    parents: [connection.vault_folder_id],
    appProperties: {
      artNexusOwner: String(ownerId).toLowerCase(),
      artNexusKind: kind,
      artNexusVersion: '1'
    }
  };
  const query = new URLSearchParams({ uploadType: 'resumable', fields: 'id,name,mimeType,size,parents,appProperties' });
  const response = await driveApiRequest(accessToken, `https://www.googleapis.com/upload/drive/v3/files?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size)
    },
    body: JSON.stringify(fileMetadata)
  });
  if (!response.ok) throw new GoogleDriveError('drive_upload_session_failed', 503, response.status);
  const location = response.headers.get('location') || response.headers.get('Location') || '';
  let sessionUrl;
  try { sessionUrl = new URL(location); }
  catch { throw new GoogleDriveError('drive_upload_session_invalid', 503); }
  if (!GOOGLE_API_ORIGINS.has(sessionUrl.origin) || !/^\/upload\/drive\/v3\/files$/.test(sessionUrl.pathname)
    || !sessionUrl.searchParams.has('upload_id')) {
    throw new GoogleDriveError('drive_upload_session_invalid', 503);
  }
  return sessionUrl.href;
}

export async function getDriveFileMetadata(accessToken, fileId) {
  if (!isDriveFileId(fileId)) throw new GoogleDriveError('drive_file_id_invalid', 400);
  const query = new URLSearchParams({ fields: 'id,name,mimeType,size,parents,appProperties,trashed' });
  const response = await driveApiRequest(accessToken, `/drive/v3/files/${encodeURIComponent(fileId)}?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export function validateDriveAssetMetadata(metadata, connection, ownerId, expectedKind) {
  const owner = String(ownerId || '').toLowerCase();
  const parents = Array.isArray(metadata?.parents) ? metadata.parents : [];
  const mimeType = String(metadata?.mimeType || '').toLowerCase();
  const size = Number(metadata?.size);
  const kindAllowed = expectedKind === 'master' ? MASTER_MIME_TYPES.has(mimeType) : PREVIEW_MIME_TYPES.has(mimeType);
  const maxSize = expectedKind === 'preview' ? MAX_PREVIEW_FILE_BYTES : MAX_DRIVE_FILE_BYTES;
  return isDriveFileId(metadata?.id)
    && metadata?.trashed !== true
    && parents.includes(connection?.vault_folder_id)
    && metadata?.appProperties?.artNexusOwner === owner
    && metadata?.appProperties?.artNexusKind === expectedKind
    && kindAllowed
    && Number.isSafeInteger(size) && size > 0 && size <= maxSize;
}

export async function revokeGoogleRefreshToken(token) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000)
    });
    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}
