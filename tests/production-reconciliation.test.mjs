import test from 'node:test';
import assert from 'node:assert/strict';
import orderStatusHandler from '../api/order-status.mjs';
import expireOrdersHandler from '../api/cron/expire-orders.mjs';
import paymongoWebhookHandler from '../api/paymongo-webhook.mjs';
import { createPaymongoSignature } from '../server/_lib/paymongo.mjs';
import { readFile } from 'node:fs/promises';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const APP_URL = 'https://artnexus.example';
const PROJECT_URL = 'https://project.supabase.co';
const SESSION_KEY = 'cs_test_session_123';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(payload); } };
}

function makeResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    headers,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value) { this.body = String(value || ''); },
    json() { return JSON.parse(this.body || '{}'); }
  };
}

function configure(t, checkout = false) {
  const keys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL', 'RATE_LIMIT_HMAC_SECRET', 'PAYMONGO_MODE', 'PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET', 'PAYMONGO_PAYMENT_METHOD_TYPES', 'CRON_SECRET', 'NODE_ENV', 'ART_NEXUS_TEST_ALLOW_PROVIDERS'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    SUPABASE_URL: PROJECT_URL,
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    PUBLIC_APP_URL: APP_URL,
    RATE_LIMIT_HMAC_SECRET: 'local-test-rate-limit-secret',
    CRON_SECRET: 'local-cron-secret',
    NODE_ENV: 'test',
    ART_NEXUS_TEST_ALLOW_PROVIDERS: 'true'
  });
  if (checkout) Object.assign(process.env, {
    PAYMONGO_MODE: 'test',
    PAYMONGO_SECRET_KEY: 'sk_test_12345678',
    PAYMONGO_WEBHOOK_SECRET: 'whsk_12345678',
    PAYMONGO_PAYMENT_METHOD_TYPES: 'card,gcash'
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

function useFetch(t, callback) {
  const previous = globalThis.fetch;
  globalThis.fetch = callback;
  t.after(() => { globalThis.fetch = previous; });
}

function urlOf(input) { return typeof input === 'string' ? input : input.url; }
function initOf(input, init) { return init || (typeof input === 'object' ? input : {}); }

function req(method, url, { body = {}, cookie = 'an_access=test-access', headers = {} } = {}) {
  return {
    method,
    url,
    headers: { origin: APP_URL, cookie, ...headers },
    socket: { remoteAddress: '203.0.113.7' },
    body
  };
}

test('authenticated order-status response hides checkout URLs after a server-paid state and scopes lookup to the owner', async t => {
  configure(t);
  let queryUrl = '';
  useFetch(t, async input => {
    const url = urlOf(input);
    if (url.endsWith('/auth/v1/user')) return response(200, { id: USER_ID, email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' });
    if (url.includes('/rest/v1/orders?')) {
      queryUrl = url;
      return response(200, [{ id: ORDER_ID, status: 'paid', amount_total_minor: 250000, currency: 'PHP', checkout_url: `https://checkout.paymongo.com/${SESSION_KEY}`, created_at: '2026-10-16T00:00:00Z', paid_at: '2026-10-16T00:03:00Z' }]);
    }
    if (url.includes('/rest/v1/order_items?')) return response(200, []);
    throw new Error(`Unexpected request: ${url}`);
  });

  const res = makeResponse();
  await orderStatusHandler(req('GET', `/api/order-status?order_id=${ORDER_ID}`), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().order.status, 'paid');
  assert.equal(res.json().order.checkout_url, null);
  assert.ok(queryUrl.includes(`user_id=eq.${USER_ID}`));
});

test('PayMongo webhook verifies the test-mode raw-body signature before invoking the paid-order RPC', async t => {
  configure(t, true);
  const timestamp = '1792108800';
  const rawBody = Buffer.from(JSON.stringify({
    event_type: 'send.webhook',
    data: {
      type: 'checkout_session.payment.paid',
      resource: 'checkout_session',
      livemode: false,
      data: {
        id: SESSION_KEY,
        type: 'checkout_session',
        attributes: {
          reference_number: ORDER_ID,
          metadata: { order_id: ORDER_ID },
          payments: [{ id: 'pay_test_123', attributes: { amount: 250000, currency: 'PHP', status: 'paid' } }]
        }
      }
    }
  }));
  const signature = createPaymongoSignature(rawBody, timestamp, process.env.PAYMONGO_WEBHOOK_SECRET);
  let rpcArgs;
  useFetch(t, async (input, init) => {
    const url = urlOf(input);
    if (!url.endsWith('/rest/v1/rpc/mark_paymongo_order_paid')) throw new Error(`Unexpected request: ${url}`);
    rpcArgs = JSON.parse(initOf(input, init).body);
    return response(200, { accepted: true, duplicate: false });
  });

  const validReq = req('POST', '/api/paymongo-webhook', {
    body: rawBody,
    cookie: '',
    headers: { 'paymongo-signature': `t=${timestamp},te=${signature},li=${'0'.repeat(64)}` }
  });
  const validRes = makeResponse();
  await paymongoWebhookHandler(validReq, validRes);
  assert.equal(validRes.statusCode, 200);
  assert.equal(validRes.json().processed, true);
  assert.equal(rpcArgs.p_order_id, ORDER_ID);
  assert.equal(rpcArgs.p_checkout_session_id, SESSION_KEY);
  assert.equal(rpcArgs.p_amount_minor, 250000);
  assert.equal(rpcArgs.p_payment_id, 'pay_test_123');

  const invalidReq = req('POST', '/api/paymongo-webhook', {
    body: rawBody,
    cookie: '',
    headers: { 'paymongo-signature': `t=${timestamp},te=${'f'.repeat(64)},li=${'0'.repeat(64)}` }
  });
  const invalidRes = makeResponse();
  await paymongoWebhookHandler(invalidReq, invalidRes);
  assert.equal(invalidRes.statusCode, 401);
  assert.equal(invalidRes.json().error, 'invalid_signature');
});

test('stale checkout cron expires PayMongo first, reconciles paid sessions, and then releases orphan holds', async t => {
  configure(t, true);
  const expiredOrderId = '33333333-3333-4333-8333-333333333333';
  const paidOrderId = '44444444-4444-4444-8444-444444444444';
  const expiredSessionId = 'cs_test_expired_123';
  const paidSessionId = 'cs_test_paid_123';
  const calls = [];
  useFetch(t, async (input, init) => {
    const url = urlOf(input);
    const options = initOf(input, init);
    if (url.endsWith('/rest/v1/rpc/list_stale_checkout_orders')) {
      return response(200, [
        { order_id: expiredOrderId, checkout_session_id: expiredSessionId, amount_total_minor: 125000, currency: 'PHP' },
        { order_id: paidOrderId, checkout_session_id: paidSessionId, amount_total_minor: 250000, currency: 'PHP' }
      ]);
    }
    if (url === `https://api.paymongo.com/v1/checkout_sessions/${expiredSessionId}/expire`) {
      return response(200, { data: { id: expiredSessionId, attributes: { status: 'expired', livemode: false } } });
    }
    if (url === `https://api.paymongo.com/v1/checkout_sessions/${paidSessionId}/expire`) {
      return response(400, { errors: [{ code: 'session_already_paid' }] });
    }
    if (url === `https://api.paymongo.com/v1/checkout_sessions/${paidSessionId}`) {
      return response(200, { data: {
        id: paidSessionId,
        attributes: {
          status: 'active', livemode: false,
          reference_number: paidOrderId,
          metadata: { order_id: paidOrderId },
          payment_intent: { attributes: { status: 'succeeded', amount: 250000, currency: 'PHP' } },
          payments: [{ id: 'pay_test_paid_123', attributes: { status: 'paid', amount: 250000, currency: 'PHP' } }]
        }
      } });
    }
    if (url.endsWith('/rest/v1/rpc/expire_confirmed_checkout_order')) {
      calls.push({ name: 'expire_confirmed_checkout_order', args: JSON.parse(options.body) });
      return response(200, true);
    }
    if (url.endsWith('/rest/v1/rpc/mark_paymongo_order_paid')) {
      calls.push({ name: 'mark_paymongo_order_paid', args: JSON.parse(options.body) });
      return response(200, { accepted: true, duplicate: false });
    }
    if (url.endsWith('/rest/v1/rpc/expire_stale_checkout_orders')) {
      calls.push({ name: 'expire_stale_checkout_orders', args: JSON.parse(options.body) });
      return response(200, { expired_orphan_orders: 1 });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const res = makeResponse();
  await expireOrdersHandler(req('GET', '/api/cron/expire-orders', {
    cookie: '', headers: { authorization: 'Bearer local-cron-secret' }
  }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, examined: 2, paid: 1, expired: 1, pending: 0, deferred: 0, orphanExpired: 1 });
  assert.equal(calls.find(call => call.name === 'expire_confirmed_checkout_order').args.p_checkout_session_id, expiredSessionId);
  assert.equal(calls.find(call => call.name === 'mark_paymongo_order_paid').args.p_payment_id, 'pay_test_paid_123');
  assert.equal(calls.at(-1).name, 'expire_stale_checkout_orders');
});

test('migration only releases orphan orders locally and keeps provider-backed expiry behind a server-only confirmation RPC', async () => {
  const sql = await readFile(new URL('../supabase/migrations/202610160001_production_foundation.sql', import.meta.url), 'utf8');
  assert.match(sql, /and paymongo_checkout_session_id is null[\s\S]*?updated_at < now\(\) - interval '35 minutes'/);
  assert.match(sql, /create or replace function public\.list_stale_checkout_orders/);
  assert.match(sql, /create or replace function public\.expire_confirmed_checkout_order/);
  assert.match(sql, /creator_profile_not_published/);
  assert.match(sql, /join public\.creator_profiles cp on cp\.user_id = l\.creator_id and cp\.status = 'published'/);
  assert.match(sql, /sold_quantity < stock_total then 'published'/);
  assert.match(sql, /revoke all on function public\.expire_confirmed_checkout_order\(uuid, text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.expire_confirmed_checkout_order\(uuid, text\) to service_role/);
  const createCheckout = sql.slice(sql.indexOf('create or replace function public.create_checkout_order'), sql.indexOf('create or replace function public.attach_paymongo_checkout'));
  assert.doesNotMatch(createCheckout, /perform public\.expire_stale_checkout_orders/);
});
