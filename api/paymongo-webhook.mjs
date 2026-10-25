import { createHash } from 'node:crypto';
import { getRuntimeConfig } from '../server/_lib/config.mjs';
import { methodOnly, readRawBody, safeErrorStatus, sendJson } from '../server/_lib/http.mjs';
import { parseCheckoutPaidEvent, verifyPaymongoSignature } from '../server/_lib/paymongo.mjs';
import { serviceRpc } from '../server/_lib/supabase.mjs';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const runtime = getRuntimeConfig();
  if (!runtime.checkoutConfigured) return sendJson(res, 503, { received: false, error: 'webhook_not_configured' });

  let rawBody;
  try { rawBody = await readRawBody(req, 1024 * 1024); }
  catch (error) { return sendJson(res, safeErrorStatus(error, 400), { received: false, error: 'invalid_payload' }); }
  const signature = String(req.headers?.['paymongo-signature'] || '');
  // This sandbox endpoint intentionally accepts only PayMongo's test-mode `te` signature.
  if (!verifyPaymongoSignature(rawBody, signature, runtime.paymongoWebhookSecret, false)) {
    return sendJson(res, 401, { received: false, error: 'invalid_signature' });
  }

  let payload;
  try { payload = JSON.parse(rawBody.toString('utf8')); }
  catch { return sendJson(res, 400, { received: false, error: 'invalid_payload' }); }
  const event = parseCheckoutPaidEvent(payload);
  if (event?.ignored) return sendJson(res, 200, { received: true, ignored: true });
  if (!event || event.eventType !== 'checkout_session.payment.paid') return sendJson(res, 200, { received: true, ignored: true });
  if (event.livemode !== false) return sendJson(res, 200, { received: true, ignored: true });
  if (!/^cs_[A-Za-z0-9_-]+$/.test(event.sessionId)
    || !/^[0-9a-f-]{36}$/i.test(event.orderId)
    || event.referenceNumber !== event.orderId
    || !Number.isSafeInteger(event.amountMinor)
    || event.amountMinor < 1
    || event.currency !== 'PHP') {
    return sendJson(res, 200, { received: true, ignored: true });
  }

  try {
    const eventHash = createHash('sha256').update(rawBody).digest('hex');
    const result = await serviceRpc(runtime, 'mark_paymongo_order_paid', {
      p_order_id: event.orderId,
      p_checkout_session_id: event.sessionId,
      p_amount_minor: event.amountMinor,
      p_currency: event.currency,
      p_event_hash: eventHash,
      p_payment_id: event.paymentId || null
    });
    if (!result.response.ok) throw new Error('payment_event_persist_failed');
    const outcome = Array.isArray(result.payload) ? result.payload[0] : result.payload;
    sendJson(res, 200, { received: true, processed: outcome?.accepted !== false });
  } catch (error) {
    console.error('PayMongo webhook persistence failed:', error?.message || 'unknown_error');
    // A 5xx lets PayMongo retry transient database failures; duplicate delivery is idempotent.
    sendJson(res, 500, { received: false, error: 'event_processing_unavailable' });
  }
}
