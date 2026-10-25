import test from 'node:test';
import assert from 'node:assert/strict';
import connectionHandler from '../api/creator/drive/connection.mjs';
import { encryptDriveRefreshToken, STORAGE_AGREEMENT_VERSION } from '../server/_lib/google-drive.mjs';
import { getRuntimeConfig } from '../server/_lib/config.mjs';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const APP_URL = 'https://artnexus.example';
const PROJECT_URL = 'https://project.supabase.co';

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload == null ? '' : JSON.stringify(payload); },
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

function getUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function getInit(input, init) {
  return init || (typeof input === 'object' && !(input instanceof URL) ? input : {});
}

test('disconnect atomically removes the connection and hides listings before provider token revocation', async t => {
  const keys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL', 'RATE_LIMIT_HMAC_SECRET', 'NODE_ENV', 'ART_NEXUS_TEST_ALLOW_PROVIDERS', 'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_REDIRECT_URI', 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    SUPABASE_URL: PROJECT_URL,
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    PUBLIC_APP_URL: APP_URL,
    RATE_LIMIT_HMAC_SECRET: 'disconnect-test-rate-secret',
    NODE_ENV: 'test',
    ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true',
    GOOGLE_DRIVE_CLIENT_ID: '123456789-testclient.apps.googleusercontent.com',
    GOOGLE_DRIVE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_DRIVE_REDIRECT_URI: '',
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: 'd'.repeat(64)
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  const encrypted = encryptDriveRefreshToken('refresh-to-revoke', getRuntimeConfig());
  const previousFetch = globalThis.fetch;
  const steps = [];
  globalThis.fetch = async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    if (url.endsWith('/auth/v1/user')) return response(200, { id: USER_ID, email: 'creator@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' });
    if (url.includes('/rest/v1/profiles?')) return response(200, [{ id: USER_ID, display_name: 'River Studio', account_role: 'creator' }]);
    if (url.includes('/rest/v1/creator_profiles?')) return response(200, [{ user_id: USER_ID, studio_name: 'River Studio', bio: '', verified_mediums: [], status: 'draft' }]);
    if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return response(200, true);
    if (url.includes('/rest/v1/creator_drive_connections?') && options.method !== 'DELETE') return response(200, [{ user_id: USER_ID, google_email: 'creator@gmail.com', vault_folder_id: 'ArtNexusFolder123', ...encrypted, terms_version: STORAGE_AGREEMENT_VERSION, terms_accepted_at: '2026-10-16T00:00:00Z' }]);
    if (url.endsWith('/rest/v1/rpc/disconnect_creator_drive_and_unpublish')) {
      steps.push('unpublish');
      assert.equal(JSON.parse(options.body).p_creator_id, USER_ID);
      return response(200, { unpublished_count: 2 });
    }
    if (url === 'https://oauth2.googleapis.com/revoke') {
      steps.push('revoke');
      return response(200, {});
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const req = { method: 'DELETE', url: '/api/creator/drive/connection', headers: { origin: APP_URL, cookie: 'an_access=test-access', 'x-forwarded-for': '203.0.113.12' }, socket: { remoteAddress: '203.0.113.12' } };
  const res = makeResponse();
  await connectionHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(steps, ['unpublish', 'revoke']);
  assert.equal(res.json().disconnected, true);
  assert.equal(res.json().providerRevoked, true);
  assert.match(res.json().message, /Public listings are hidden/);
});
