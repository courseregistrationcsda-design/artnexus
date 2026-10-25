import { createHash, timingSafeEqual } from 'node:crypto';
import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, sendJson } from '../../server/_lib/http.mjs';
import { expirePaymongoCheckoutSession, retrievePaymongoCheckoutSession } from '../../server/_lib/paymongo.mjs';
import { serviceRpc } from '../../server/_lib/supabase.mjs';

const BATCH_LIMIT = 20;
const CONCURRENCY = 4;

function equalSecret(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function rpcValue(payload) {
  return Array.isArray(payload) ? payload[0] : payload;
}

async function markExpired(config, order) {
  const result = await serviceRpc(config, 'expire_confirmed_checkout_order', {
    p_order_id: order.order_id,
    p_checkout_session_id: order.checkout_session_id
  });
  if (!result.response.ok) throw new Error('checkout_expiry_persist_failed');
  return rpcValue(result.payload) === true;
}

async function markPaid(config, order, session) {
  const orderId = String(order.order_id || '');
  if (session.id !== order.checkout_session_id
    || session.referenceNumber !== orderId
    || session.orderId !== orderId
    || session.livemode !== false
    || !['paid', 'succeeded'].includes(session.paymentStatus)
    || !Number.isSafeInteger(session.amountMinor)
    || session.amountMinor !== Number(order.amount_total_minor)
    || session.currency !== String(order.currency || '').toUpperCase()
    || session.currency !== 'PHP') return false;

  const eventHash = createHash('sha256')
    .update(`paymongo-reconcile:${session.id}:${session.paymentId}:${session.amountMinor}:${session.currency}`)
    .digest('hex');
  const result = await serviceRpc(config, 'mark_paymongo_order_paid', {
    p_order_id: orderId,
    p_checkout_session_id: session.id,
    p_amount_minor: session.amountMinor,
    p_currency: session.currency,
    p_event_hash: eventHash,
    p_payment_id: session.paymentId || null
  });
  if (!result.response.ok) throw new Error('checkout_payment_reconcile_failed');
  const outcome = rpcValue(result.payload);
  return !!outcome && outcome.accepted === true;
}

async function reconcileOrder(config, order) {
  const sessionId = String(order.checkout_session_id || '');
  if (!/^cs_[A-Za-z0-9_-]+$/.test(sessionId)) return 'deferred';

  // Expire first. PayMongo refuses this for completed or in-flight payments; in
  // either case retrieve the session before changing the local reservation.
  try {
    const expired = await expirePaymongoCheckoutSession(config, sessionId);
    if (expired.id === sessionId && expired.status === 'expired') {
      return await markExpired(config, order) ? 'expired' : 'deferred';
    }
  } catch (_) {
    // Retrieve below to distinguish already-paid, already-expired, in-flight,
    // and temporary provider failures without trusting the browser return URL.
  }

  let session;
  try { session = await retrievePaymongoCheckoutSession(config, sessionId); }
  catch (_) { return 'deferred'; }
  if (!session || session.id !== sessionId) return 'deferred';
  if (session.paymentStatus === 'paid' || session.paymentStatus === 'succeeded') {
    return await markPaid(config, order, session) ? 'paid' : 'deferred';
  }
  if (session.status === 'expired') return await markExpired(config, order) ? 'expired' : 'deferred';
  // Active or processing sessions keep their inventory reservation. A later
  // cron run can safely retry once the pending payment attempt has settled.
  return 'pending';
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!config.cronSecret || !equalSecret(supplied, config.cronSecret)) return sendJson(res, 401, { error: 'unauthorized' });
  if (!config.authConfigured || !config.paymongoConfigured) return sendJson(res, 503, { error: 'checkout_expiry_not_configured' });

  try {
    const queue = await serviceRpc(config, 'list_stale_checkout_orders', { p_limit: BATCH_LIMIT });
    if (!queue.response.ok || !Array.isArray(queue.payload)) throw new Error('stale_order_queue_unavailable');

    const counts = { examined: queue.payload.length, paid: 0, expired: 0, pending: 0, deferred: 0 };
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.payload.length) }, async () => {
      while (cursor < queue.payload.length) {
        const order = queue.payload[cursor++];
        try {
          const result = await reconcileOrder(config, order);
          counts[result] = (counts[result] || 0) + 1;
        } catch (_) {
          counts.deferred++;
        }
      }
    });
    await Promise.all(workers);

    // It is safe to release only old orders for which no PayMongo session was
    // ever attached. Session-backed orders are expired above after PayMongo
    // confirms the provider-side session is no longer payable.
    const orphanResult = await serviceRpc(config, 'expire_stale_checkout_orders', {});
    if (!orphanResult.response.ok) throw new Error('orphan_order_expiry_failed');
    const orphanPayload = rpcValue(orphanResult.payload);
    const orphanExpired = Number(orphanPayload?.expired_orphan_orders || 0);

    return sendJson(res, 200, { ok: true, ...counts, orphanExpired });
  } catch (error) {
    console.error('Checkout reservation reconciliation failed:', error?.message || 'unknown_error');
    return sendJson(res, 503, { error: 'expiry_unavailable' });
  }
}
