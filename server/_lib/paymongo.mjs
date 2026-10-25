import { createHmac, timingSafeEqual } from 'node:crypto';

const ALLOWED_METHODS = new Set(['card', 'gcash', 'paymaya', 'qrph']);

export function verifyPaymongoSignature(rawBody, header, webhookSecret, livemode = false) {
  if (!Buffer.isBuffer(rawBody) || typeof header !== 'string' || !webhookSecret) return false;
  const parts = Object.create(null);
  for (const token of header.split(',')) {
    const index = token.indexOf('=');
    if (index <= 0) continue;
    const key = token.slice(0, index).trim();
    const value = token.slice(index + 1).trim();
    if (['t', 'te', 'li'].includes(key) && value && !parts[key]) parts[key] = value;
  }
  if (!/^\d{1,14}$/.test(parts.t || '')) return false;
  const supplied = livemode ? parts.li : parts.te;
  if (!/^[a-f0-9]{64}$/i.test(supplied || '')) return false;
  const signed = Buffer.concat([Buffer.from(`${parts.t}.`, 'utf8'), rawBody]);
  const expected = createHmac('sha256', webhookSecret).update(signed).digest();
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createPaymongoSignature(rawBody, timestamp, secret) {
  return createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])).digest('hex');
}

export function normalizePaymentMethods(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value || '').trim().toLowerCase()).filter(value => ALLOWED_METHODS.has(value)))];
}

export function buildCheckoutSessionPayload(order, appUrl, methods) {
  if (!order || typeof order !== 'object' || !/^[0-9a-f-]{36}$/i.test(String(order.order_id || ''))) throw new Error('invalid_order');
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  // The SQL cart caps product lines at 20; an original-artwork order may add one shipping line.
  if (!lineItems.length || lineItems.length > 21) throw new Error('invalid_order_lines');
  const normalizedMethods = normalizePaymentMethods(methods);
  if (!normalizedMethods.length) throw new Error('invalid_payment_methods');
  const items = lineItems.map(line => {
    const name = String(line.name || line.title || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100);
    const amount = Number(line.amount_minor ?? line.unit_amount_minor);
    const quantity = Number(line.quantity);
    if (!name || !Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000_00 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error('invalid_order_line');
    }
    return { name, amount, currency: 'PHP', quantity };
  });
  const origin = new URL(appUrl).origin;
  const orderId = String(order.order_id);
  return {
    data: {
      attributes: {
        line_items: items,
        payment_method_types: normalizedMethods,
        success_url: `${origin}/?payment=return&order=${encodeURIComponent(orderId)}`,
        cancel_url: `${origin}/?payment=cancelled&order=${encodeURIComponent(orderId)}`,
        reference_number: orderId,
        description: `ART NEXUS order ${orderId}`,
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        metadata: { order_id: orderId }
      }
    }
  };
}

export async function createPaymongoCheckout(config, payload, idempotencyKey) {
  const authorization = Buffer.from(`${config.paymongoSecretKey}:`, 'utf8').toString('base64');
  const response = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(18_000)
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  if (!response.ok) {
    const error = new Error('paymongo_checkout_failed');
    error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
    throw error;
  }
  const attributes = parsed?.data?.attributes || parsed?.data || {};
  const checkoutUrl = String(attributes.checkout_url || parsed?.checkout_url || '');
  const sessionId = String(parsed?.data?.id || attributes.id || '');
  if (!/^https:\/\/checkout\.paymongo\.com\//i.test(checkoutUrl) || !/^cs_[A-Za-z0-9_-]+$/.test(sessionId)) {
    throw new Error('paymongo_invalid_checkout_response');
  }
  return { sessionId, checkoutUrl };
}

function parsePaymongoSessionResource(payload) {
  const resource = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const attributes = resource?.attributes && typeof resource.attributes === 'object' ? resource.attributes : {};
  const paymentIntent = attributes.payment_intent && typeof attributes.payment_intent === 'object' ? attributes.payment_intent : {};
  const intentAttributes = paymentIntent.attributes && typeof paymentIntent.attributes === 'object' ? paymentIntent.attributes : {};
  const rawPayments = Array.isArray(attributes.payments) ? attributes.payments
    : Array.isArray(intentAttributes.payments) ? intentAttributes.payments : [];
  const payments = rawPayments.slice(0, 20).map(payment => {
    const paymentAttributes = payment?.attributes && typeof payment.attributes === 'object' ? payment.attributes : {};
    return {
      id: String(payment?.id || ''),
      status: String(paymentAttributes.status || payment?.status || '').toLowerCase(),
      amountMinor: Number(paymentAttributes.amount),
      currency: String(paymentAttributes.currency || '').toUpperCase()
    };
  });
  const paidPayment = payments.find(payment => payment.status === 'paid') || null;
  const intentStatus = String(intentAttributes.status || '').toLowerCase();
  return {
    id: String(resource?.id || attributes.id || ''),
    status: String(attributes.status || '').toLowerCase(),
    livemode: typeof attributes.livemode === 'boolean' ? attributes.livemode : null,
    referenceNumber: String(attributes.reference_number || ''),
    orderId: String(attributes.metadata?.order_id || ''),
    amountMinor: paidPayment && Number.isSafeInteger(paidPayment.amountMinor)
      ? paidPayment.amountMinor
      : intentStatus === 'succeeded' && Number.isSafeInteger(Number(intentAttributes.amount)) ? Number(intentAttributes.amount) : null,
    currency: paidPayment?.currency || String(intentAttributes.currency || attributes.currency || '').toUpperCase(),
    paymentId: paidPayment?.id || '',
    paymentStatus: paidPayment ? 'paid' : intentStatus,
    hasInFlightPayment: payments.some(payment => ['pending', 'processing', 'in_progress', 'awaiting_payment', 'requires_action'].includes(payment.status))
  };
}

async function paymongoSessionRequest(config, sessionId, action = '') {
  if (!/^cs_[A-Za-z0-9_-]+$/.test(String(sessionId || ''))) throw new Error('invalid_paymongo_session_id');
  const authorization = Buffer.from(`${config.paymongoSecretKey}:`, 'utf8').toString('base64');
  const suffix = action === 'expire' ? '/expire' : '';
  const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}${suffix}`, {
    method: action === 'expire' ? 'POST' : 'GET',
    headers: {
      Authorization: `Basic ${authorization}`,
      Accept: 'application/json',
      ...(action === 'expire' ? { 'Content-Type': 'application/json' } : {})
    },
    signal: AbortSignal.timeout(10_000)
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    const error = new Error('paymongo_session_request_failed');
    error.statusCode = response.status >= 400 && response.status < 500 ? 409 : 503;
    throw error;
  }
  return parsePaymongoSessionResource(payload);
}

export async function retrievePaymongoCheckoutSession(config, sessionId) {
  return paymongoSessionRequest(config, sessionId);
}

export async function expirePaymongoCheckoutSession(config, sessionId) {
  return paymongoSessionRequest(config, sessionId, 'expire');
}

export function parseCheckoutPaidEvent(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const envelope = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const eventType = String(envelope.type || payload.type || payload.event_type || '');
  if (eventType !== 'checkout_session.payment.paid') return { ignored: true, eventType };
  const session = envelope.data && typeof envelope.data === 'object'
    ? envelope.data
    : envelope.attributes && typeof envelope.attributes === 'object'
      ? { id: envelope.id, attributes: envelope.attributes }
      : payload.data?.data || null;
  if (!session || typeof session !== 'object') return null;
  const attributes = session.attributes || {};
  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  const paidPayment = payments.find(payment => {
    const status = String(payment?.attributes?.status || payment?.status || '').toLowerCase();
    return status === 'paid';
  }) || payments[0] || null;
  const paymentAttributes = paidPayment?.attributes || {};
  const amount = Number(paymentAttributes.amount ?? attributes.amount);
  const currency = String(paymentAttributes.currency ?? attributes.currency ?? 'PHP').toUpperCase();
  const livemode = envelope.livemode ?? payload.livemode ?? attributes.livemode;
  const referenceNumber = String(attributes.reference_number || attributes.referenceNumber || '');
  const metadata = attributes.metadata && typeof attributes.metadata === 'object' ? attributes.metadata : {};
  const sessionId = String(session.id || attributes.id || '');
  return {
    ignored: false,
    eventType,
    sessionId,
    referenceNumber,
    orderId: String(metadata.order_id || referenceNumber),
    amountMinor: Number.isSafeInteger(amount) ? amount : null,
    currency,
    livemode: typeof livemode === 'boolean' ? livemode : null,
    paymentId: String(paidPayment?.id || ''),
    paymentStatus: String(paymentAttributes.status || paidPayment?.status || '').toLowerCase()
  };
}
