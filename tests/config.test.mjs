import test from 'node:test';
import assert from 'node:assert/strict';
import { getRuntimeConfig, publicRuntimeConfig } from '../server/_lib/config.mjs';
import configHandler from '../api/config.mjs';

const common = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test_key',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_key',
  PUBLIC_APP_URL: 'https://staging.artnexus.example',
  RATE_LIMIT_HMAC_SECRET: 'a-random-rate-limit-secret',
  PAYMONGO_MODE: 'test',
  PAYMONGO_SECRET_KEY: 'sk_test_12345678',
  PAYMONGO_PAYMENT_METHOD_TYPES: 'card,gcash',
  NODE_ENV: 'test',
  ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true'
};

test('PayMongo webhook signing-secret alias stays compatible with the documented canonical name', () => {
  const canonical = getRuntimeConfig({ ...common, PAYMONGO_WEBHOOK_SECRET: 'whsk_12345678' });
  const alias = getRuntimeConfig({ ...common, PAYMONGO_WEBHOOK_SIGNING_SECRET: 'whsk_12345678' });
  assert.equal(canonical.checkoutConfigured, true);
  assert.equal(alias.checkoutConfigured, true);
  assert.equal(getRuntimeConfig({ ...common, PAYMONGO_WEBHOOK_SIGNING_SECRET: 'not-a-webhook-secret' }).checkoutConfigured, false);
});

test('real runtimes block configured providers; only mocked test mode can opt into provider routes', () => {
  const configured = {
    ...common,
    NODE_ENV: 'production',
    GOOGLE_DRIVE_CLIENT_ID: '123456789-testclient.apps.googleusercontent.com',
    GOOGLE_DRIVE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
    PAYMONGO_WEBHOOK_SECRET: 'whsk_12345678'
  };
  const locked = getRuntimeConfig(configured);
  assert.equal(locked.localCommunityMode, true);
  assert.equal(locked.authConfigured, false);
  assert.equal(locked.googleDriveConfigured, false);
  assert.equal(locked.paymongoConfigured, false);
  assert.equal(locked.checkoutConfigured, false);

  const mocked = getRuntimeConfig({ ...configured, NODE_ENV: 'test', ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true' });
  assert.equal(mocked.localCommunityMode, false);
  assert.equal(mocked.authConfigured, true);
  assert.equal(mocked.checkoutConfigured, true);
});

test('incomplete auth or non-test payment configuration fails closed', () => {
  const webhook = { PAYMONGO_WEBHOOK_SECRET: 'whsk_12345678' };
  assert.equal(getRuntimeConfig({}).authConfigured, false);
  assert.equal(getRuntimeConfig({ ...common, SUPABASE_SERVICE_ROLE_KEY: '' }).authConfigured, false);
  assert.equal(getRuntimeConfig({ ...common, PUBLIC_APP_URL: 'http://staging.artnexus.example' }).authConfigured, false);
  assert.equal(getRuntimeConfig({ ...common, ...webhook, PAYMONGO_MODE: 'live', PAYMONGO_SECRET_KEY: 'sk_live_12345678' }).paymongoConfigured, false);
  assert.equal(getRuntimeConfig({ ...common, ...webhook, PAYMONGO_SECRET_KEY: 'sk_live_12345678' }).paymongoConfigured, false);
  assert.equal(getRuntimeConfig({ ...common, ...webhook, PAYMONGO_PAYMENT_METHOD_TYPES: 'cash,bitcoin' }).paymongoConfigured, false);
});

test('the config API rejects direct requests in local mode despite populated provider secrets', () => {
  const keys = [
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL',
    'RATE_LIMIT_HMAC_SECRET', 'PAYMONGO_MODE', 'PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET',
    'PAYMONGO_PAYMENT_METHOD_TYPES', 'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET',
    'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY', 'NODE_ENV', 'ART_NEXUS_TEST_ALLOW_PROVIDERS'
  ];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const configured = {
    ...common,
    NODE_ENV: 'production',
    GOOGLE_DRIVE_CLIENT_ID: '123456789-testclient.apps.googleusercontent.com',
    GOOGLE_DRIVE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: 'b'.repeat(64),
    PAYMONGO_WEBHOOK_SECRET: 'whsk_12345678'
  };
  try {
    for (const key of keys) {
      if (configured[key] === undefined) delete process.env[key];
      else process.env[key] = configured[key];
    }
    const res = {
      statusCode: 200, body: '', headers: new Map(),
      setHeader(name, value) { this.headers.set(name, value); },
      end(value) { this.body = String(value || ''); }
    };
    configHandler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, 'local_community_mode');
    assert.equal(res.body.includes('test-service-role-key'), false);
    assert.equal(res.body.includes('sk_test_12345678'), false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('public runtime configuration never serializes private credentials', () => {
  const internal = getRuntimeConfig({
    ...common,
    PAYMONGO_WEBHOOK_SECRET: 'whsk_super_secret_value',
    PAYMONGO_SECRET_KEY: 'sk_test_super_secret_value'
  });
  const exposed = publicRuntimeConfig(internal);
  const serialized = JSON.stringify(exposed);
  assert.equal(exposed.authConfigured, true);
  assert.equal(exposed.checkoutConfigured, true);
  assert.equal(exposed.assetOrigin, 'https://project.supabase.co');
  assert.equal(serialized.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  assert.equal(serialized.includes('sb_secret_test_key'), false);
  assert.equal(serialized.includes('sk_test_super_secret_value'), false);
  assert.equal(serialized.includes('whsk_super_secret_value'), false);
});
