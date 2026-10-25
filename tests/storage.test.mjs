import test from 'node:test';
import assert from 'node:assert/strict';
import connectDriveHandler from '../api/creator/drive/connect.mjs';
import driveCallbackHandler from '../api/creator/drive/callback.mjs';
import uploadSessionHandler from '../api/creator/drive/upload-session.mjs';
import assetHandler from '../api/creator/assets.mjs';
import { getRuntimeConfig } from '../server/_lib/config.mjs';
import {
  decryptDriveRefreshToken,
  driveFileIdFromPrivateUrl,
  encryptDriveRefreshToken,
  privateDriveFileUrl,
  sanitizeDriveFileName,
  STORAGE_AGREEMENT_VERSION,
  validateDriveAssetMetadata
} from '../server/_lib/google-drive.mjs';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const APP_URL = 'https://artnexus.example';
const PROJECT_URL = 'https://project.supabase.co';
const MASTER_ID = 'MasterFile123456';
const PREVIEW_ID = 'PreviewFile12345';

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

function makeResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    end(value) { this.body = String(value || ''); },
    json() { return JSON.parse(this.body || '{}'); },
    headers
  };
}

function request(method, url, body = {}, cookie = 'an_access=test-access') {
  return {
    method, url, body,
    headers: { origin: APP_URL, cookie, 'x-forwarded-for': '203.0.113.9' },
    socket: { remoteAddress: '203.0.113.9' }
  };
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
    RATE_LIMIT_HMAC_SECRET: 'local-test-rate-limit-secret',
    NODE_ENV: 'test',
    ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true',
    GOOGLE_DRIVE_CLIENT_ID: '123456789-testclient.apps.googleusercontent.com',
    GOOGLE_DRIVE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_DRIVE_REDIRECT_URI: '',
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64)
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

function getUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function getInit(input, init) {
  return init || (typeof input === 'object' && !(input instanceof URL) ? input : {});
}

function createWebp(size, width, height) {
  const bytes = Buffer.alloc(size);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(size - 8, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8X', 12, 'ascii');
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

function authFixture(url) {
  if (url.endsWith('/auth/v1/user')) return response(200, { id: USER_ID, email: 'creator@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' });
  if (url.includes('/rest/v1/profiles?')) return response(200, [{ id: USER_ID, display_name: 'River Studio', account_role: 'creator' }]);
  if (url.includes('/rest/v1/creator_profiles?')) return response(200, [{ user_id: USER_ID, studio_name: 'River Studio', bio: '', verified_mediums: [], status: 'draft' }]);
  if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return response(200, true);
  return null;
}

test('Google refresh tokens are encrypted at rest and Drive references are strict private pointers', () => {
  const config = getRuntimeConfig({
    SUPABASE_URL: PROJECT_URL,
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    PUBLIC_APP_URL: APP_URL,
    RATE_LIMIT_HMAC_SECRET: 'rate',
    GOOGLE_DRIVE_CLIENT_ID: '123456789-testclient.apps.googleusercontent.com',
    GOOGLE_DRIVE_CLIENT_SECRET: 'secret-value',
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: 'b'.repeat(64),
    NODE_ENV: 'test',
    ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true'
  });
  const encrypted = encryptDriveRefreshToken('plain-refresh-secret', config);
  assert.equal(decryptDriveRefreshToken(encrypted, config), 'plain-refresh-secret');
  assert.equal(JSON.stringify(encrypted).includes('plain-refresh-secret'), false);
  assert.equal(driveFileIdFromPrivateUrl(privateDriveFileUrl(MASTER_ID)), MASTER_ID);
  assert.equal(driveFileIdFromPrivateUrl(`https://drive.google.com/file/d/${MASTER_ID}/view?usp=sharing`), '');
  assert.equal(driveFileIdFromPrivateUrl(`https://evil.example/file/d/${MASTER_ID}/view`), '');
  assert.equal(sanitizeDriveFileName('../folder/painting.png', 'master').includes('/'), false);
  const connection = { vault_folder_id: 'VaultFolder123', terms_version: STORAGE_AGREEMENT_VERSION };
  const file = { id: MASTER_ID, mimeType: 'image/jpeg', size: '1200', parents: ['VaultFolder123'], appProperties: { artNexusOwner: USER_ID, artNexusKind: 'master' }, trashed: false };
  assert.equal(validateDriveAssetMetadata(file, connection, USER_ID, 'master'), true);
  assert.equal(validateDriveAssetMetadata({ ...file, appProperties: { artNexusOwner: '22222222-2222-4222-8222-222222222222', artNexusKind: 'master' } }, connection, USER_ID, 'master'), false);
  assert.equal(validateDriveAssetMetadata(file, connection, USER_ID, 'preview'), false);
});

test('Drive connect requires agreement acceptance and callback provisions only a private app vault', async t => {
  configureEnv(t);
  let savedConnection = null;
  const permissionCalls = [];
  installFetch(t, async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    const fixture = authFixture(url);
    if (fixture) return fixture;
    if (url === 'https://oauth2.googleapis.com/token') return response(200, { access_token: 'google-access', refresh_token: 'google-refresh-secret', scope: `openid email https://www.googleapis.com/auth/drive.file` });
    if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') return response(200, { email: 'creator@gmail.com', verified_email: true });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?') && options.method === 'GET') return response(200, { files: [] });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?') && options.method === 'POST') {
      const folder = JSON.parse(options.body);
      assert.equal(folder.name, 'ArtNexus_Vault');
      assert.equal(folder.mimeType, 'application/vnd.google-apps.folder');
      assert.equal(folder.appProperties.artNexusVaultOwner, USER_ID);
      return response(200, { id: 'ArtNexusFolder123', name: 'ArtNexus_Vault', mimeType: 'application/vnd.google-apps.folder', appProperties: folder.appProperties });
    }
    if (url.includes('/rest/v1/creator_drive_connections?') && options.method === 'GET') return response(200, []);
    if (url.includes('/rest/v1/creator_drive_connections?on_conflict=user_id') && options.method === 'POST') {
      savedConnection = JSON.parse(options.body);
      return response(201, null);
    }
    if (url.includes('/permissions')) permissionCalls.push(url);
    throw new Error(`Unexpected request: ${url}`);
  });

  const denied = makeResponse();
  await connectDriveHandler(request('POST', '/api/creator/drive/connect', { accepted: false, agreement_version: STORAGE_AGREEMENT_VERSION }), denied);
  assert.equal(denied.statusCode, 400);

  const connectRes = makeResponse();
  await connectDriveHandler(request('POST', '/api/creator/drive/connect', { accepted: true, agreement_version: STORAGE_AGREEMENT_VERSION }), connectRes);
  assert.equal(connectRes.statusCode, 200);
  const authorizationUrl = new URL(connectRes.json().authorizationUrl);
  assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
  assert.match(authorizationUrl.searchParams.get('scope'), /drive\.file/);
  assert.equal(authorizationUrl.searchParams.get('access_type'), 'offline');
  const cookies = connectRes.getHeader('set-cookie');
  const stateCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(value => String(value).startsWith('an_drive_oauth_state='));
  assert.ok(stateCookie);
  const state = decodeURIComponent(String(stateCookie).split(';')[0].split('=').slice(1).join('='));

  const callbackRes = makeResponse();
  await driveCallbackHandler(request('GET', `/api/creator/drive/callback?code=authorization-code&state=${encodeURIComponent(state)}`, {}, `an_access=test-access; an_drive_oauth_state=${encodeURIComponent(state)}`), callbackRes);
  assert.equal(callbackRes.statusCode, 303);
  assert.equal(callbackRes.getHeader('location'), `${APP_URL}/?drive=connected`);
  assert.equal(savedConnection.user_id, USER_ID);
  assert.equal(savedConnection.google_email, 'creator@gmail.com');
  assert.equal(savedConnection.vault_folder_id, 'ArtNexusFolder123');
  assert.equal(savedConnection.terms_version, STORAGE_AGREEMENT_VERSION);
  assert.notEqual(savedConnection.refresh_token_ciphertext, 'google-refresh-secret');
  assert.equal(permissionCalls.length, 0, 'the app must never create public Drive permissions');
});

test('Drive upload session accepts metadata only and returns a direct Google resumable URL', async t => {
  configureEnv(t);
  const config = getRuntimeConfig();
  const encryptedToken = encryptDriveRefreshToken('refresh-for-upload', config);
  let driveSessionBody = '';
  installFetch(t, async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    const fixture = authFixture(url);
    if (fixture) return fixture;
    if (url.includes('/rest/v1/creator_drive_connections?')) return response(200, [{ user_id: USER_ID, google_email: 'creator@gmail.com', vault_folder_id: 'ArtNexusFolder123', ...encryptedToken, terms_version: STORAGE_AGREEMENT_VERSION, terms_accepted_at: '2026-10-16T00:00:00Z' }]);
    if (url === 'https://oauth2.googleapis.com/token') return response(200, { access_token: 'google-access' });
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) {
      driveSessionBody = String(options.body || '');
      return response(200, {}, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=sessionSecret123' });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const res = makeResponse();
  await uploadSessionHandler(request('POST', '/api/creator/drive/upload-session', {
    file_name: 'my painting.png', mime_type: 'image/png', size: 1024, asset_kind: 'master'
  }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().uploadUrl, 'https://www.googleapis.com/upload/drive/v3/files?upload_id=sessionSecret123');
  const metadata = JSON.parse(driveSessionBody);
  assert.deepEqual(metadata.parents, ['ArtNexusFolder123']);
  assert.equal(metadata.appProperties.artNexusOwner, USER_ID);
  assert.equal(metadata.appProperties.artNexusKind, 'master');
  assert.equal(driveSessionBody.includes('file contents'), false);
});

test('thumbnail cache endpoint enforces 720p dimensions and the inclusive 300,000-byte WebP ceiling', async t => {
  configureEnv(t);
  let storedMime = '';
  let storedPath = '';
  let storedCount = 0;
  installFetch(t, async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    const fixture = authFixture(url);
    if (fixture) return fixture;
    if (url.includes('/rest/v1/creator_drive_connections?')) return response(200, []);
    if (url.includes('/rest/v1/rpc/consume_api_rate_limit')) return response(200, true);
    if (url.includes('/storage/v1/object/creator-public-assets/')) {
      storedMime = options.headers['Content-Type'];
      storedPath = new URL(url).pathname;
      storedCount++;
      return response(200, {});
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const acceptedBytes = createWebp(300_000, 1280, 720);
  const accepted = makeResponse();
  await assetHandler(request('POST', '/api/creator/assets', {
    dataUrl: `data:image/webp;base64,${acceptedBytes.toString('base64')}`,
    assetType: 'thumbnail'
  }), accepted);
  assert.equal(accepted.statusCode, 201, 'exactly 300,000 bytes is permitted');
  assert.equal(storedMime, 'image/webp');
  assert.match(storedPath, /thumbnail-[a-f0-9-]+\.webp$/);

  const tooLargeBytes = createWebp(300_001, 1280, 720);
  const tooLarge = makeResponse();
  await assetHandler(request('POST', '/api/creator/assets', {
    dataUrl: `data:image/webp;base64,${tooLargeBytes.toString('base64')}`,
    assetType: 'thumbnail'
  }), tooLarge);
  assert.equal(tooLarge.statusCode, 400);

  const tooWide = makeResponse();
  const tooWideBytes = createWebp(30, 1281, 720);
  await assetHandler(request('POST', '/api/creator/assets', {
    dataUrl: `data:image/webp;base64,${tooWideBytes.toString('base64')}`,
    assetType: 'thumbnail'
  }), tooWide);
  assert.equal(tooWide.statusCode, 400);

  const portraitBytes = createWebp(30, 720, 1280);
  const portrait = makeResponse();
  await assetHandler(request('POST', '/api/creator/assets', {
    dataUrl: `data:image/webp;base64,${portraitBytes.toString('base64')}`,
    assetType: 'thumbnail'
  }), portrait);
  assert.equal(portrait.statusCode, 201);
  assert.equal(storedCount, 2);
});
