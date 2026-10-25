import test from 'node:test';
import assert from 'node:assert/strict';
import checkoutHandler, { normalizeFulfillment, normalizeItems } from '../api/checkout.mjs';
import catalogHandler from '../api/catalog.mjs';
import creatorWorksHandler from '../api/creator/works.mjs';
import creatorProfileHandler from '../api/creator/profile.mjs';
import { buildCheckoutSessionPayload } from '../server/_lib/paymongo.mjs';
import { getRuntimeConfig } from '../server/_lib/config.mjs';
import { encryptDriveRefreshToken } from '../server/_lib/google-drive.mjs';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const APP_URL = 'https://artnexus.example';
const PROJECT_URL = 'https://project.supabase.co';

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(payload); },
    async json() { return payload; }
  };
}

function makeResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value) { this.body = String(value || ''); },
    json() { return JSON.parse(this.body || '{}'); },
    headers
  };
}

function request(method, url, body = {}) {
  return {
    method,
    url,
    headers: {
      origin: APP_URL,
      cookie: 'an_access=test-access',
      'x-forwarded-for': '203.0.113.7'
    },
    socket: { remoteAddress: '203.0.113.7' },
    body
  };
}

function configureEnv(t, { checkout = false, drive = false } = {}) {
  const keys = [
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL',
    'RATE_LIMIT_HMAC_SECRET', 'PAYMONGO_MODE', 'PAYMONGO_SECRET_KEY',
    'PAYMONGO_WEBHOOK_SECRET', 'PAYMONGO_PAYMENT_METHOD_TYPES', 'CRON_SECRET', 'NODE_ENV', 'ART_NEXUS_TEST_ALLOW_PROVIDERS',
    'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_REDIRECT_URI', 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'
  ];
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
  if (drive) Object.assign(process.env, {
    GOOGLE_DRIVE_CLIENT_ID: '123456789-testclient.apps.googleusercontent.com',
    GOOGLE_DRIVE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64)
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
  return init || (typeof input === 'object' ? input : {});
}

test('checkout helpers normalize and validate the current API/RPC contract', () => {
  assert.deepEqual(normalizeItems([{ listing_key: 'creator:abc:cw-1', quantity: 2 }]), [
    { listing_key: 'creator:abc:cw-1', quantity: 2 }
  ]);
  assert.equal(normalizeItems([{ listing_key: 'bad key', quantity: 1 }]), null);

  const normalized = normalizeFulfillment({
    recipient_name: '  Ana Rivera  ',
    street: '  12 Cedar Road  ',
    city: 'Baguio',
    province: 'Benguet',
    postal_code: '2600',
    phone: '09171234567',
    delivery_tier: 'pickup',
    print_email: '  Buyer@Example.COM  '
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.data.recipient_name, 'Ana Rivera');
  assert.equal(normalized.data.print_email, 'buyer@example.com');
  assert.equal(normalized.data.phone, '09171234567');
  assert.equal(normalizeFulfillment({ print_email: 'not-an-email' }).ok, false);
});

test('PayMongo checkout payload allows the migration maximum plus one shipping line', () => {
  const order = {
    order_id: '22222222-2222-4222-8222-222222222222',
    line_items: Array.from({ length: 20 }, (_, index) => ({ name: `Work ${index}`, amount_minor: 100, quantity: 1 }))
  };
  const base = buildCheckoutSessionPayload(order, APP_URL, ['gcash']);
  assert.equal(base.data.attributes.line_items.length, 20);
  order.line_items.push({ name: 'Shipping · prov', amount_minor: 65000, quantity: 1 });
  const withShipping = buildCheckoutSessionPayload(order, APP_URL, ['gcash']);
  assert.equal(withShipping.data.attributes.line_items.length, 21);
  order.line_items.push({ name: 'Unexpected extra', amount_minor: 100, quantity: 1 });
  assert.throws(() => buildCheckoutSessionPayload(order, APP_URL, ['gcash']), /invalid_order_lines/);
});

test('checkout route passes normalized fulfillment_data to create_checkout_order and validates the hosted URL', async t => {
  configureEnv(t, { checkout: true });
  const rpcCalls = [];
  installFetch(t, async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    if (url.endsWith('/auth/v1/user')) return jsonResponse(200, { id: USER_ID, email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' });
    if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return jsonResponse(200, true);
    if (url.endsWith('/rest/v1/rpc/create_checkout_order')) {
      const args = JSON.parse(options.body);
      rpcCalls.push({ name: 'create_checkout_order', args });
      return jsonResponse(200, {
        order_id: '22222222-2222-4222-8222-222222222222',
        status: 'pending_payment',
        amount_total_minor: 250000,
        currency: 'PHP',
        checkout_session_id: null,
        checkout_url: null,
        line_items: [{ name: 'Studio print', amount_minor: 250000, quantity: 1 }]
      });
    }
    if (url === 'https://api.paymongo.com/v2/checkout_sessions') {
      const providerPayload = JSON.parse(options.body);
      assert.equal(providerPayload.data.attributes.success_url, `${APP_URL}/?payment=return&order=22222222-2222-4222-8222-222222222222`);
      return jsonResponse(200, { data: { id: 'cs_sandbox_123', attributes: { checkout_url: 'https://checkout.paymongo.com/cs_sandbox_123' } } });
    }
    if (url.endsWith('/rest/v1/rpc/attach_paymongo_checkout')) {
      rpcCalls.push({ name: 'attach_paymongo_checkout', args: JSON.parse(options.body) });
      return jsonResponse(200, true);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const res = makeResponse();
  await checkoutHandler(request('POST', '/api/checkout', {
    items: [{ listing_key: 'creator:11111111-1111-4111-8111-111111111111:cw-abc', quantity: 1 }],
    idempotency_key: '33333333-3333-4333-8333-333333333333',
    fulfillment_data: { print_email: ' Buyer@Example.com ' }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().checkoutUrl, 'https://checkout.paymongo.com/cs_sandbox_123');
  const createArgs = rpcCalls.find(call => call.name === 'create_checkout_order').args;
  assert.deepEqual(createArgs.p_fulfillment_data, { print_email: 'buyer@example.com' });
  assert.equal(createArgs.p_user_id, USER_ID);
  assert.equal(rpcCalls.find(call => call.name === 'attach_paymongo_checkout').args.p_order_id, '22222222-2222-4222-8222-222222222222');
});

test('Creator profile keeps personal display name separate from public studio name', async t => {
  configureEnv(t);
  let profileArgs = null;
  installFetch(t, async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    if (url.endsWith('/auth/v1/user')) return jsonResponse(200, { id: USER_ID, email: 'onin@example.test', email_confirmed_at: '2026-10-01T00:00:00Z' });
    if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return jsonResponse(200, true);
    if (url.endsWith('/rest/v1/rpc/upsert_creator_profile')) {
      profileArgs = JSON.parse(options.body);
      return jsonResponse(200, { user_id: USER_ID, studio_name: 'Kaye Atelier', status: 'draft' });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  const res = makeResponse();
  await creatorProfileHandler(request('POST', '/api/creator/profile', {
    accountName: 'Onin Reyes', studioName: 'Kaye Atelier', bio: 'A creative practice', verifiedMediums: ['Painting']
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.displayName, 'Onin Reyes');
  assert.equal(res.json().creatorProfile.studio_name, 'Kaye Atelier');
  assert.equal(profileArgs.p_display_name, 'Onin Reyes');
  assert.equal(profileArgs.p_studio_name, 'Kaye Atelier');
});

test('public catalog endpoint returns published Creator work only and hides creators without a current private Drive connection', async t => {
  configureEnv(t);
  let driveConnected = true;
  installFetch(t, async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return jsonResponse(200, true);
    if (url.includes('/rest/v1/creator_profiles?')) return jsonResponse(200, [{
      user_id: USER_ID,
      studio_name: 'River Studio',
      bio: '<img src=x onerror=alert(1)>',
      verified_mediums: ['Oil paint'],
      avatar_url: 'https://attacker.example/avatar.jpg',
      status: 'published'
    }]);
    if (url.includes('/rest/v1/creator_drive_connections?')) return jsonResponse(200, driveConnected ? [{ user_id: USER_ID, terms_version: '2026-10-16-v1', terms_accepted_at: '2026-10-16T00:00:00Z' }] : []);
    if (url.includes('/rest/v1/creator_works?')) return jsonResponse(200, [{
      creator_id: USER_ID,
      work_key: 'cw-abcd-1234',
      title: 'River Light',
      description: 'A small painting',
      medium: 'Oil paint',
      image_url: `${PROJECT_URL}/storage/v1/object/public/creator-public-assets/${USER_ID}/artwork-123.jpg`,
      thumbnail_cache_url: `${PROJECT_URL}/storage/v1/object/public/creator-public-assets/${USER_ID}/thumbnail-123e4567-e89b-12d3-a456-426614174000.webp`,
      gdrive_source_url: 'https://drive.google.com/file/d/MasterFile123456/view',
      gdrive_preview_url: 'https://drive.google.com/file/d/PreviewFile12345/view',
      folio_slides: [],
      folio_preview_urls: [],
      status: 'published',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z'
    }]);
    if (url.includes('/rest/v1/artwork_listings?')) return jsonResponse(200, [{
      creator_id: USER_ID,
      listing_key: `creator:${USER_ID}:cw-abcd-1234`,
      sale_type: 'original',
      currency: 'PHP',
      price_minor: 1250000,
      stock_total: 1,
      reserved_quantity: 0,
      sold_quantity: 0,
      is_published: true,
      status: 'published'
    }]);
    throw new Error(`Unexpected request: ${url}`);
  });

  const res = makeResponse();
  await catalogHandler(request('GET', '/api/catalog', {}), res);
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.artists.length, 1);
  assert.equal(payload.artists[0].studio_name, 'River Studio');
  assert.equal(payload.artists[0].avatar_url, '');
  assert.equal(payload.artists[0].works[0].listing_key, `creator:${USER_ID}:cw-abcd-1234`);
  assert.equal(payload.artists[0].works[0].price_value, 12500);
  assert.equal(payload.artists[0].works[0].remaining_stock, 1);
  assert.equal(payload.artists[0].works[0].thumbnail_cache_url, `${PROJECT_URL}/storage/v1/object/public/creator-public-assets/${USER_ID}/thumbnail-123e4567-e89b-12d3-a456-426614174000.webp`);
  assert.equal(payload.artists[0].works[0].preview_url, `/api/creator/drive/preview?creator_id=${USER_ID}&work_key=cw-abcd-1234&slide=0`);
  assert.equal(JSON.stringify(payload).includes('drive.google.com'), false);
  assert.equal(JSON.stringify(payload).includes('MasterFile123456'), false);
  assert.equal(JSON.stringify(payload).includes('attacker.example'), false);
  assert.equal(JSON.stringify(payload).includes('buyer@example.com'), false);

  driveConnected = false;
  const hiddenRes = makeResponse();
  await catalogHandler(request('GET', '/api/catalog', {}), hiddenRes);
  assert.equal(hiddenRes.statusCode, 200);
  assert.deepEqual(hiddenRes.json().artists, [], 'works disappear from public catalog as soon as the Drive connection is removed');
});

test('Creator work write route validates the WebP cache and private Drive asset ownership', async t => {
  configureEnv(t, { drive: true });
  const driveConfig = getRuntimeConfig();
  const encryptedToken = encryptDriveRefreshToken('drive-refresh-token', driveConfig);
  let capturedWorkArgs;
  installFetch(t, async (input, init) => {
    const url = getUrl(input);
    const options = getInit(input, init);
    if (url.endsWith('/auth/v1/user')) return jsonResponse(200, { id: USER_ID, email: 'creator@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' });
    if (url.includes('/rest/v1/profiles?')) return jsonResponse(200, [{ id: USER_ID, display_name: 'River Studio', account_role: 'creator' }]);
    if (url.includes('/rest/v1/creator_profiles?')) return jsonResponse(200, [{ user_id: USER_ID, studio_name: 'River Studio', bio: '', verified_mediums: [], avatar_url: null, status: 'published' }]);
    if (url.endsWith('/rest/v1/rpc/consume_api_rate_limit')) return jsonResponse(200, true);
    if (url.includes('/rest/v1/creator_drive_connections?')) return jsonResponse(200, [{ user_id: USER_ID, google_email: 'creator@gmail.com', vault_folder_id: 'ArtNexusFolder123', ...encryptedToken, terms_version: '2026-10-16-v1', terms_accepted_at: '2026-10-16T00:00:00Z' }]);
    if (url === 'https://oauth2.googleapis.com/token') return jsonResponse(200, { access_token: 'drive-access-token' });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/')) {
      const fileId = new URL(url).pathname.split('/').pop();
      const kind = fileId === 'MasterFile123456' ? 'master' : 'preview';
      return jsonResponse(200, { id: fileId, mimeType: kind === 'master' ? 'image/jpeg' : 'image/webp', size: '1000', parents: ['ArtNexusFolder123'], trashed: false, appProperties: { artNexusOwner: USER_ID, artNexusKind: kind } });
    }
    if (url.endsWith('/rest/v1/rpc/upsert_creator_work_with_drive_media')) {
      capturedWorkArgs = JSON.parse(options.body);
      return jsonResponse(200, { work_id: '44444444-4444-4444-8444-444444444444', work_key: 'cw-abcd-1234', listing_key: `creator:${USER_ID}:cw-abcd-1234`, is_for_sale: true, listing_status: 'published' });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const imageUrl = `${PROJECT_URL}/storage/v1/object/public/creator-public-assets/${USER_ID}/thumbnail-123e4567-e89b-12d3-a456-426614174000.webp`;
  const res = makeResponse();
  await creatorWorksHandler(request('POST', '/api/creator/works', { work: {
    work_key: 'cw-abcd-1234', title: 'River Light', description: 'A small painting', medium: 'Oil paint',
    image_url: imageUrl, thumbnail_cache_url: imageUrl, gdrive_source_url: 'https://drive.google.com/file/d/MasterFile123456/view',
    gdrive_preview_url: 'https://drive.google.com/file/d/PreviewFile12345/view', folio_slides: [], folio_source_urls: [], folio_preview_urls: [],
    is_for_sale: true, sale_type: '1-of-1', price_value: 12500, edition_size: 1
  } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().listingKey, `creator:${USER_ID}:cw-abcd-1234`);
  assert.equal(capturedWorkArgs.p_user_id, USER_ID);
  assert.equal(capturedWorkArgs.p_sale_type, 'original');
  assert.equal(capturedWorkArgs.p_price_minor, 1250000);
  assert.equal(capturedWorkArgs.p_stock_total, 1);
  assert.equal(capturedWorkArgs.p_thumbnail_cache_url, imageUrl);
  assert.equal(capturedWorkArgs.p_gdrive_source_url, 'https://drive.google.com/file/d/MasterFile123456/view');
  assert.equal(capturedWorkArgs.p_gdrive_preview_url, 'https://drive.google.com/file/d/PreviewFile12345/view');
  assert.deepEqual(capturedWorkArgs.p_folio_source_urls, []);

  const badRes = makeResponse();
  await creatorWorksHandler(request('POST', '/api/creator/works', { work: {
    work_key: 'cw-other-1234', title: 'Bad upload', medium: 'Oil paint',
    image_url: 'https://attacker.example/creator-public-assets/image.jpg', folio_slides: [], folio_source_urls: [], folio_preview_urls: [],
    gdrive_source_url: 'https://drive.google.com/file/d/NotOwnedFile123/view', gdrive_preview_url: 'https://drive.google.com/file/d/NotOwnedPreview123/view', is_for_sale: false
  } }), badRes);
  assert.equal(badRes.statusCode, 400);
});
