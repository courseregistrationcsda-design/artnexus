import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createHash } from 'node:crypto';
import previewHandler from '../api/creator/drive/preview.mjs';
import downloadTicketHandler from '../api/orders/download-ticket.mjs';
import downloadHandler from '../api/orders/download.mjs';
import { encryptDriveRefreshToken, STORAGE_AGREEMENT_VERSION } from '../server/_lib/google-drive.mjs';
import { getRuntimeConfig } from '../server/_lib/config.mjs';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const APP_URL = 'https://artnexus.example';
const PROJECT_URL = 'https://project.supabase.co';
const MASTER_ID = 'MasterFile123456';
const PREVIEW_ID = 'PreviewFile12345';
const LISTING_KEY = `creator:${CREATOR_ID}:cw-original-1`;
const WORK_KEY = 'cw-original-1';
const TOKEN = 'A'.repeat(43);

function response(status, payload, headers = {}) {
  const headerMap = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return headerMap.get(String(name).toLowerCase()) || null; } },
    async text() { return payload == null ? '' : typeof payload === 'string' ? payload : JSON.stringify(payload); },
    async json() { return payload; }
  };
}

class MockResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = new Map();
    this.chunks = [];
  }
  _write(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); }
  getHeader(name) { return this.headers.get(String(name).toLowerCase()); }
  get bodyBuffer() { return Buffer.concat(this.chunks); }
  get body() { return this.bodyBuffer.toString('utf8'); }
  json() { return JSON.parse(this.body || '{}'); }
}

function req(method, url, body = {}) {
  return { method, url, body, headers: { origin: APP_URL, cookie: 'an_access=test-access', 'x-forwarded-for': '203.0.113.11' }, socket: { remoteAddress: '203.0.113.11' } };
}

function configureEnv(t) {
  const keys = [
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL', 'RATE_LIMIT_HMAC_SECRET', 'NODE_ENV', 'ART_NEXUS_TEST_ALLOW_PROVIDERS',
    'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_REDIRECT_URI', 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'
  ];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    SUPABASE_URL: PROJECT_URL,
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    PUBLIC_APP_URL: APP_URL,
    RATE_LIMIT_HMAC_SECRET: 'private-media-test-rate-secret',
    NODE_ENV: 'test',
    ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true',
    GOOGLE_DRIVE_CLIENT_ID: '123456789-testclient.apps.googleusercontent.com',
    GOOGLE_DRIVE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_DRIVE_REDIRECT_URI: '',
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: 'c'.repeat(64)
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

function installFetch(t, fn) {
  const previous = globalThis.fetch;
  globalThis.fetch = fn;
  t.after(() => { globalThis.fetch = previous; });
}

function urlOf(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function initOf(input, init) {
  return init || (typeof input === 'object' && !(input instanceof URL) ? input : {});
}

function connection(encrypted) {
  return {
    user_id: CREATOR_ID,
    google_email: 'creator@gmail.com',
    vault_folder_id: 'ArtNexusFolder123',
    ...encrypted,
    terms_version: STORAGE_AGREEMENT_VERSION,
    terms_accepted_at: '2026-10-16T00:00:00Z'
  };
}

function authAndRateFixture(url) {
  if (url.endsWith('/auth/v1/user')) return response(200, { id: USER_ID, email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' });
  if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return response(200, true);
  return null;
}

test('a missing private source is hidden and the public work/listing is unlisted', async t => {
  configureEnv(t);
  const encrypted = encryptDriveRefreshToken('refresh-preview', getRuntimeConfig());
  const unlistArgs = [];
  installFetch(t, async (input, init) => {
    const url = urlOf(input);
    const options = initOf(input, init);
    const common = authAndRateFixture(url);
    if (common) return common;
    if (url.includes('/rest/v1/creator_works?')) return response(200, [{
      creator_id: CREATOR_ID, work_key: WORK_KEY, gdrive_source_url: `https://drive.google.com/file/d/${MASTER_ID}/view`,
      gdrive_preview_url: `https://drive.google.com/file/d/${PREVIEW_ID}/view`, folio_source_urls: [], folio_preview_urls: [], status: 'published'
    }]);
    if (url.includes('/rest/v1/creator_profiles?')) return response(200, [{ user_id: CREATOR_ID, status: 'published' }]);
    if (url.includes('/rest/v1/creator_drive_connections?')) return response(200, [connection(encrypted)]);
    if (url === 'https://oauth2.googleapis.com/token') return response(200, { access_token: 'drive-access-token' });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/')) {
      const fileId = new URL(url).pathname.split('/').pop();
      if (fileId === MASTER_ID) return response(404, { error: 'file_missing' });
      return response(200, { id: fileId, mimeType: 'image/webp', size: '1000', parents: ['ArtNexusFolder123'], appProperties: { artNexusOwner: CREATOR_ID, artNexusKind: 'preview' }, trashed: false });
    }
    if (url.endsWith('/rest/v1/rpc/unlist_work_for_unavailable_drive_source')) {
      unlistArgs.push(JSON.parse(options.body));
      return response(200, { unlisted: true });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const res = new MockResponse();
  await previewHandler(req('GET', `/api/creator/drive/preview?creator_id=${CREATOR_ID}&work_key=${WORK_KEY}&slide=0`), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, 'artwork_source_unavailable');
  assert.equal(res.body.includes(MASTER_ID), false);
  assert.deepEqual(unlistArgs, [{ p_creator_id: CREATOR_ID, p_work_key: WORK_KEY }]);
});

test('download tickets are issued only by the server paid-order RPC and reveal a one-use bearer token', async t => {
  configureEnv(t);
  const calls = [];
  let paid = true;
  installFetch(t, async (input, init) => {
    const url = urlOf(input);
    const options = initOf(input, init);
    const common = authAndRateFixture(url);
    if (common) return common;
    if (url.endsWith('/rest/v1/rpc/create_artwork_download_ticket')) {
      const args = JSON.parse(options.body);
      calls.push(args);
      return paid ? response(200, { issued: true, expires_at: '2026-10-16T00:10:00Z' }) : response(403, { message: 'paid_order_required' });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const first = new MockResponse();
  await downloadTicketHandler(req('POST', '/api/orders/download-ticket', { order_id: ORDER_ID, listing_key: LISTING_KEY }), first);
  assert.equal(first.statusCode, 201);
  const downloadUrl = new URL(first.json().downloadUrl);
  const token = downloadUrl.searchParams.get('token');
  assert.equal(downloadUrl.origin, APP_URL);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(first.json().expiresAt, '2026-10-16T00:10:00Z');
  assert.equal(calls[0].p_order_id, ORDER_ID);
  assert.equal(calls[0].p_user_id, USER_ID);
  assert.equal(calls[0].p_listing_key, LISTING_KEY);
  assert.equal(calls[0].p_token_hash, createHash('sha256').update(token).digest('hex'));
  assert.equal(first.body.includes(calls[0].p_token_hash), false);

  paid = false;
  const denied = new MockResponse();
  await downloadTicketHandler(req('POST', '/api/orders/download-ticket', { order_id: ORDER_ID, listing_key: LISTING_KEY }), denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().error, 'paid_order_required');
});

test('private master download streams only after one-time ticket, paid order, and Drive ownership checks', async t => {
  configureEnv(t);
  const encrypted = encryptDriveRefreshToken('refresh-download', getRuntimeConfig());
  let ticketConsumed = false;
  let consumedHash = '';
  let mediaRequests = 0;
  installFetch(t, async (input, init) => {
    const url = urlOf(input);
    const options = initOf(input, init);
    const common = authAndRateFixture(url);
    if (common) return common;
    if (url.endsWith('/rest/v1/rpc/consume_artwork_download_ticket')) {
      consumedHash = JSON.parse(options.body).p_token_hash;
      if (ticketConsumed) return response(200, null);
      ticketConsumed = true;
      return response(200, { order_id: ORDER_ID, user_id: USER_ID, listing_key: LISTING_KEY, creator_id: CREATOR_ID, work_key: WORK_KEY, expires_at: '2026-10-16T00:10:00Z', used_at: '2026-10-16T00:01:00Z' });
    }
    if (url.includes('/rest/v1/orders?')) return response(200, [{ id: ORDER_ID, user_id: USER_ID, status: 'paid' }]);
    if (url.includes('/rest/v1/order_items?')) return response(200, [{ listing_key: LISTING_KEY }]);
    if (url.includes('/rest/v1/creator_works?')) return response(200, [{ creator_id: CREATOR_ID, work_key: WORK_KEY, gdrive_source_url: `https://drive.google.com/file/d/${MASTER_ID}/view`, status: 'published' }]);
    if (url.includes('/rest/v1/creator_drive_connections?')) return response(200, [connection(encrypted)]);
    if (url === 'https://oauth2.googleapis.com/token') return response(200, { access_token: 'drive-access-token' });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/') && !url.includes('alt=media')) {
      return response(200, { id: MASTER_ID, name: 'Original painting.png', mimeType: 'image/png', size: '4', parents: ['ArtNexusFolder123'], appProperties: { artNexusOwner: CREATOR_ID, artNexusKind: 'master' }, trashed: false });
    }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/') && url.includes('alt=media')) {
      mediaRequests++;
      return new Response(Buffer.from('ART!'), { status: 200, headers: { 'Content-Type': 'image/png', 'Content-Length': '4' } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const res = new MockResponse();
  await downloadHandler(req('GET', `/api/orders/download?token=${TOKEN}`), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'ART!');
  assert.equal(res.getHeader('content-type'), 'image/png');
  assert.match(res.getHeader('content-disposition'), /^attachment; filename="art-nexus-original_Original painting[.]png"$/);
  assert.equal(res.getHeader('cache-control'), 'private, no-store, max-age=0');
  assert.equal(consumedHash, createHash('sha256').update(TOKEN).digest('hex'));
  assert.equal(mediaRequests, 1);

  const replay = new MockResponse();
  await downloadHandler(req('GET', `/api/orders/download?token=${TOKEN}`), replay);
  assert.equal(replay.statusCode, 404);
  assert.equal(replay.json().error, 'download_link_invalid_or_expired');
  assert.equal(mediaRequests, 1, 'a consumed ticket must not produce a second copy');
});
