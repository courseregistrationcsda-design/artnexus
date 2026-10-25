import { createHash, randomBytes } from 'node:crypto';
import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { serviceRpc } from '../../server/_lib/supabase.mjs';
import { verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LISTING_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,160}$/;

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured || !config.googleDriveConfigured) return sendJson(res, 503, { error: 'download_not_configured', message: 'Secure private downloads are not configured for this deployment.' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;
  try {
    const body = await readJsonBody(req, 8 * 1024);
    const orderId = String(body.order_id || '').toLowerCase();
    const listingKey = String(body.listing_key || '');
    if (!UUID_PATTERN.test(orderId) || !LISTING_KEY_PATTERN.test(listingKey)) return sendJson(res, 400, { error: 'invalid_download_request' });
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 401, { error: 'authentication_required', message: 'Sign in to request a paid artwork download.' });
    if (!(await consumeRateLimit(req, config, 'paid-download-ticket', 20, 60 * 60))) return sendJson(res, 429, { error: 'rate_limited' });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const issued = await serviceRpc(config, 'create_artwork_download_ticket', {
      p_token_hash: tokenHash,
      p_order_id: orderId,
      p_user_id: session.user.id,
      p_listing_key: listingKey
    });
    if (!issued.response.ok) {
      const reason = (typeof issued.payload === 'string' ? issued.payload : JSON.stringify(issued.payload || '')).toLowerCase();
      if (reason.includes('paid_order_required')) return sendJson(res, 403, { error: 'paid_order_required', message: 'A server-verified paid order is required before downloading the private original.' });
      if (reason.includes('download_source_unavailable')) return sendJson(res, 410, { error: 'download_source_unavailable', message: 'The private original is currently unavailable.' });
      if (reason.includes('order_item_required')) return sendJson(res, 404, { error: 'order_item_not_found' });
      return sendJson(res, 409, { error: 'download_ticket_unavailable' });
    }
    const result = Array.isArray(issued.payload) ? issued.payload[0] : issued.payload;
    if (!result || result.issued !== true) return sendJson(res, 409, { error: 'download_ticket_unavailable' });
    const downloadUrl = `${config.appUrl}/api/orders/download?token=${encodeURIComponent(token)}`;
    sendJson(res, 201, { ok: true, downloadUrl, expiresAt: result.expires_at || '' });
  } catch (error) {
    console.error('Paid download ticket request failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'download_ticket_unavailable', message: 'A private download link could not be issued. Verify the order status and retry.' });
  }
}
