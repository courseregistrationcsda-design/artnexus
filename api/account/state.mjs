import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';

const MAX_STATE_BYTES = 4_000_000;
const EXACT_KEYS = new Set([
  'artNexusUserSession',
  'artNexusCreatorWorks',
  'artNexusCreatorWipProjects',
  'artNexusFollowingArtists',
  'artNexusArtworkActivity',
  'artNexusFeedPrintStock'
]);

function allowedStateKey(key) {
  if (EXACT_KEYS.has(key)) return true;
  return /^artNexusCreator(?:CommissionSettings|CommissionRequests|OrderQueue):[0-9a-f-]{36}$/i.test(key);
}

function validateState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1
    || !value.storage || typeof value.storage !== 'object' || Array.isArray(value.storage)) return null;
  const storage = {};
  for (const [key, item] of Object.entries(value.storage)) {
    if (!allowedStateKey(key) || typeof item !== 'string' || item.length > MAX_STATE_BYTES) return null;
    storage[key] = item;
  }
  if (Object.keys(storage).length > 30) return null;
  const normalized = { version: 1, savedAt: new Date().toISOString(), storage };
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) return null;
  return { normalized, serialized };
}

function storageObjectUrl(config, userId) {
  return `${config.supabaseUrl}/storage/v1/object/account-state/${encodeURIComponent(userId)}/snapshot.json`;
}

async function storageRequest(config, userId, options = {}) {
  return fetch(storageObjectUrl(config, userId), {
    method: options.method || 'GET',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...(options.body ? { 'Content-Type': 'application/json', 'x-upsert': 'true' } : {})
    },
    body: options.body,
    signal: AbortSignal.timeout(15_000)
  });
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, ['GET', 'PUT'])) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured' });
  if (req.method === 'PUT' && !requireSameOrigin(req, res, config.appUrl)) return;

  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 401, { error: 'authentication_required' });
    if (req.method === 'GET') {
      const response = await storageRequest(config, session.user.id);
      if (response.status === 404) return sendJson(res, 200, { state: null });
      if (!response.ok) throw new Error('account_state_read_failed');
      const raw = await response.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_STATE_BYTES) throw new Error('account_state_invalid');
      let state;
      try { state = JSON.parse(raw); } catch { throw new Error('account_state_invalid'); }
      const checked = validateState(state);
      if (!checked) throw new Error('account_state_invalid');
      return sendJson(res, 200, { state: checked.normalized });
    }

    let body;
    try { body = await readJsonBody(req, MAX_STATE_BYTES + 8 * 1024); }
    catch (error) { return sendJson(res, safeErrorStatus(error, 400), { error: 'invalid_state' }); }
    const checked = validateState(body.state);
    if (!checked) return sendJson(res, 413, { error: 'state_too_large_or_invalid', message: 'This profile snapshot is too large or contains unsupported data. You remain signed in; no saved data was cleared.' });
    const allowed = await consumeRateLimit(req, config, 'account-state-save', 30, 60);
    if (!allowed) return sendJson(res, 429, { error: 'rate_limited' });
    const response = await storageRequest(config, session.user.id, { method: 'POST', body: checked.serialized });
    if (!response.ok) throw new Error('account_state_write_failed');
    sendJson(res, 200, { ok: true, savedAt: checked.normalized.savedAt, bytes: Buffer.byteLength(checked.serialized, 'utf8') });
  } catch (error) {
    console.error('Account-state persistence failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'account_state_unavailable', message: 'Saved state could not be synchronized. Stay signed in and retry; no local creator data was removed.' });
  }
}
