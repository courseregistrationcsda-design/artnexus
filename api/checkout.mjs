import { getRuntimeConfig } from '../server/_lib/config.mjs';
import { methodOnly, normalizedEmail, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../server/_lib/http.mjs';
import { buildCheckoutSessionPayload, createPaymongoCheckout } from '../server/_lib/paymongo.mjs';
import { consumeRateLimit } from '../server/_lib/rate-limit.mjs';
import { serviceRpc, verifiedSupabaseUser } from '../server/_lib/supabase.mjs';

export function normalizeItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const items = [];
  for (const row of value) {
    const listingKey = String(row?.listing_key || '').trim();
    const quantity = Number(row?.quantity);
    if (!/^[A-Za-z0-9:_-]{1,160}$/.test(listingKey) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return null;
    items.push({ listing_key: listingKey, quantity });
  }
  return items;
}

export function normalizeFulfillment(value) {
  if (value == null) return { ok: true, data: {} };
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, data: {} };
  const text = (key, max) => typeof value[key] === 'string' ? value[key].normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
  const data = {};
  const recipientName = text('recipient_name', 80);
  const street = text('street', 180);
  const city = text('city', 80);
  const province = text('province', 80);
  const postalCode = text('postal_code', 12);
  const phone = String(value.phone || '').replace(/\D/g, '').slice(0, 11);
  const deliveryTier = String(value.delivery_tier || '').trim();
  const printEmail = normalizedEmail(value.print_email);
  if (value.recipient_name != null && (recipientName.length < 2 || recipientName.length > 80)) return { ok: false, data: {} };
  if (value.street != null && (street.length < 4 || street.length > 180)) return { ok: false, data: {} };
  if (value.city != null && (city.length < 2 || city.length > 80)) return { ok: false, data: {} };
  if (value.province != null && (province.length < 2 || province.length > 80)) return { ok: false, data: {} };
  if (value.postal_code != null && !/^\d{4}$/.test(postalCode)) return { ok: false, data: {} };
  if (value.phone != null && !/^0?9\d{9}$/.test(phone)) return { ok: false, data: {} };
  if (value.delivery_tier != null && !['mm', 'prov', 'pickup'].includes(deliveryTier)) return { ok: false, data: {} };
  if (value.print_email != null && !printEmail) return { ok: false, data: {} };
  if (recipientName) data.recipient_name = recipientName;
  if (street) data.street = street;
  if (city) data.city = city;
  if (province) data.province = province;
  if (postalCode) data.postal_code = postalCode;
  if (phone) data.phone = phone;
  if (deliveryTier) data.delivery_tier = deliveryTier;
  if (printEmail) data.print_email = printEmail;
  return { ok: true, data };
}

function rpcPayload(value) {
  const result = Array.isArray(value) ? value[0] : value;
  return result && typeof result === 'object' && !Array.isArray(result) ? result : null;
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.checkoutConfigured) return sendJson(res, 503, { error: 'secure_checkout_not_configured', message: 'Secure checkout is not configured. No payment was started.' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;

  let body;
  try { body = await readJsonBody(req, 32 * 1024); }
  catch (error) { return sendJson(res, safeErrorStatus(error, 400), { error: 'invalid_request' }); }
  const items = normalizeItems(body.items);
  const fulfillment = normalizeFulfillment(body.fulfillment_data);
  const idempotencyKey = String(body.idempotency_key || '');
  if (!items || !fulfillment.ok || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return sendJson(res, 400, { error: 'invalid_cart', message: 'The cart could not be validated. No payment was started.' });
  }

  let orderId = '';
  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 401, { error: 'authentication_required', message: 'Sign in before starting secure checkout.' });
    if (!(await consumeRateLimit(req, config, 'checkout-create', 12, 60 * 60))) return sendJson(res, 429, { error: 'rate_limited' });

    const created = await serviceRpc(config, 'create_checkout_order', {
      p_user_id: session.user.id,
      p_items: items,
      p_idempotency_key: idempotencyKey,
      p_fulfillment_data: fulfillment.data
    });
    if (!created.response.ok) {
      const status = created.response.status >= 400 && created.response.status < 500 ? 409 : 503;
      return sendJson(res, status, { error: 'listing_unavailable', message: 'One or more artworks are not available in the secure production catalog. No payment was started.' });
    }
    const order = rpcPayload(created.payload);
    if (!order?.order_id || !Array.isArray(order.line_items) || !order.line_items.length) {
      throw new Error('invalid_order_response');
    }
    orderId = String(order.order_id);
    if (order.status === 'paid') {
      return sendJson(res, 200, { ok: true, orderId, paid: true, checkoutUrl: null, reused: true });
    }
    if (order.status !== 'pending_payment') {
      return sendJson(res, 409, { error: 'order_not_active', message: 'This order is no longer pending. Check its verified status before starting another checkout.' });
    }
    if (order.checkout_url && /^https:\/\/checkout\.paymongo\.com\//i.test(String(order.checkout_url))) {
      return sendJson(res, 200, { ok: true, orderId, checkoutUrl: order.checkout_url, reused: true });
    }

    const providerPayload = buildCheckoutSessionPayload(order, config.appUrl, config.paymentMethods);
    const checkout = await createPaymongoCheckout(config, providerPayload, idempotencyKey);
    const attached = await serviceRpc(config, 'attach_paymongo_checkout', {
      p_order_id: orderId,
      p_checkout_session_id: checkout.sessionId,
      p_checkout_url: checkout.checkoutUrl
    });
    const attachedValue = Array.isArray(attached.payload) ? attached.payload[0] : attached.payload;
    if (!attached.response.ok || attachedValue !== true) {
      // Do not reveal an untracked session to the buyer; the order remains safely unfulfilled.
      throw new Error('checkout_session_attach_failed');
    }
    sendJson(res, 200, { ok: true, orderId, checkoutUrl: checkout.checkoutUrl, reused: false });
  } catch (error) {
    console.error('Secure checkout failed:', error?.message || 'unknown_error');
    if (orderId) {
      try { await serviceRpc(config, 'release_checkout_order', { p_order_id: orderId, p_reason: 'checkout_start_failed' }); }
      catch { console.error('Order reservation release failed; expiry job will release stale holds.'); }
    }
    sendJson(res, safeErrorStatus(error, 503), { error: 'checkout_unavailable', message: 'Secure checkout could not be started. No payment link was issued; please retry.' });
  }
}
