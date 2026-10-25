import test from 'node:test';
import assert from 'node:assert/strict';
import updateEmailHandler from '../api/auth/update-email.mjs';
import callbackHandler from '../api/auth/callback.mjs';

const APP_URL = 'https://artnexus.example';
const PROJECT_URL = 'https://project.supabase.co';
const USER_ID = '11111111-1111-4111-8111-111111111111';

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return payload == null ? '' : JSON.stringify(payload); }
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
function envSetup(t) {
  const keys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL', 'RATE_LIMIT_HMAC_SECRET', 'NODE_ENV', 'ART_NEXUS_TEST_ALLOW_PROVIDERS'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    SUPABASE_URL: PROJECT_URL,
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    PUBLIC_APP_URL: APP_URL,
    RATE_LIMIT_HMAC_SECRET: 'auth-email-test-secret',
    NODE_ENV: 'test',
    ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true'
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}
function request(body = {}) {
  return {
    method: 'POST',
    url: '/api/auth/update-email',
    headers: { origin: APP_URL, cookie: 'an_access=test-access', 'x-forwarded-for': '203.0.113.25' },
    socket: { remoteAddress: '203.0.113.25' },
    body
  };
}

test('email change uses the verified Supabase session and sends the user through Auth confirmation', async t => {
  envSetup(t);
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) return response(200, { id: USER_ID, email: 'creator@example.com', email_confirmed_at: '2026-10-01T00:00:00Z' });
    if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return response(200, true);
    if (url.startsWith(`${PROJECT_URL}/auth/v1/user?redirect_to=`) && init.method === 'PUT') {
      return response(200, { id: USER_ID, email: 'creator@example.com', new_email: 'artist@example.com' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const res = makeResponse();
  await updateEmailHandler(request({ email: 'Artist@Example.com' }), res);
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.emailChangePending, true);
  assert.equal(payload.email, 'creator@example.com');
  assert.equal(payload.requestedEmail, 'artist@example.com');
  assert.match(payload.message, /confirmation/i);
  const updateCall = calls.find(call => call.init.method === 'PUT');
  assert.ok(updateCall);
  assert.equal(updateCall.init.headers.Authorization, 'Bearer test-access');
  assert.equal(JSON.parse(updateCall.init.body).email, 'artist@example.com');
  assert.equal(new URL(updateCall.url).searchParams.get('redirect_to'), `${APP_URL}/api/auth/callback`);
});

test('email change is refused until the current account email is verified', async t => {
  envSetup(t);
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/auth/v1/user')) return response(200, { id: USER_ID, email: 'creator@example.com' });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const res = makeResponse();
  await updateEmailHandler(request({ email: 'new@example.com' }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, 'email_verification_required');
  assert.equal(calls.length, 1);
});

test('email change validates same-origin requests and rejects invalid or unchanged addresses', async t => {
  envSetup(t);
  const previousFetch = globalThis.fetch;
  let authCalls = 0;
  globalThis.fetch = async input => {
    const url = String(input);
    authCalls++;
    if (url.endsWith('/auth/v1/user')) return response(200, { id: USER_ID, email: 'creator@example.com', email_confirmed_at: '2026-10-01T00:00:00Z' });
    if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return response(200, true);
    throw new Error(`Unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const badOrigin = request({ email: 'new@example.com' });
  badOrigin.headers.origin = 'https://attacker.example';
  const badOriginRes = makeResponse();
  await updateEmailHandler(badOrigin, badOriginRes);
  assert.equal(badOriginRes.statusCode, 403);
  assert.equal(authCalls, 0);

  const invalidRes = makeResponse();
  await updateEmailHandler(request({ email: 'not-an-email' }), invalidRes);
  assert.equal(invalidRes.statusCode, 400);
  assert.equal(authCalls, 0);

  const sameRes = makeResponse();
  await updateEmailHandler(request({ email: ' CREATOR@example.com ' }), sameRes);
  assert.equal(sameRes.statusCode, 409);
  assert.equal(sameRes.json().error, 'email_unchanged');
  assert.equal(authCalls, 1);
});

test('email-change confirmation callback accepts the Supabase email_change token type', async t => {
  envSetup(t);
  const previousFetch = globalThis.fetch;
  let verificationBody = null;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith('/auth/v1/verify')) {
      verificationBody = JSON.parse(init.body);
      return response(200, {
        access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 3600,
        user: { id: USER_ID, email: 'artist@example.com', email_confirmed_at: '2026-10-16T00:00:00Z' }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const req = {
    method: 'GET',
    url: '/api/auth/callback?token_hash=valid-token-hash-1234&type=email_change',
    headers: { 'x-forwarded-proto': 'https' }
  };
  const res = makeResponse();
  await callbackHandler(req, res);
  assert.equal(verificationBody.type, 'email_change');
  assert.equal(verificationBody.token_hash, 'valid-token-hash-1234');
  assert.equal(res.statusCode, 303);
  assert.equal(res.getHeader('Location'), `${APP_URL}/?auth=confirmed`);
  assert.ok(String(res.getHeader('Set-Cookie')).includes('an_access=new-access-token'));
});
