import { getRuntimeConfig } from '../server/_lib/config.mjs';
import { cleanText, methodOnly, sendJson } from '../server/_lib/http.mjs';
import { supabaseServiceRequest, verifiedSupabaseUser } from '../server/_lib/supabase.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured' });
  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 401, { error: 'authentication_required' });
    const url = new URL(req.url || '/', config.appUrl);
    const orderId = String(url.searchParams.get('order_id') || '');
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return sendJson(res, 400, { error: 'invalid_order_id' });
    const query = new URLSearchParams({
      select: 'id,status,amount_total_minor,currency,checkout_url,created_at,paid_at',
      id: `eq.${orderId}`,
      user_id: `eq.${session.user.id}`,
      limit: '1'
    });
    const result = await supabaseServiceRequest(config, `/rest/v1/orders?${query.toString()}`);
    if (!result.response.ok) throw new Error('order_status_read_failed');
    const order = Array.isArray(result.payload) ? result.payload[0] : null;
    if (!order) return sendJson(res, 404, { error: 'order_not_found' });
    let downloadItems = [];
    if (order.status === 'paid') {
      const itemsQuery = new URLSearchParams({ select: 'listing_key,title_snapshot', order_id: `eq.${orderId}`, order: 'created_at.asc', limit: '20' });
      const itemsResult = await supabaseServiceRequest(config, `/rest/v1/order_items?${itemsQuery.toString()}`);
      if (!itemsResult.response.ok) throw new Error('paid_order_items_read_failed');
      downloadItems = Array.isArray(itemsResult.payload) ? itemsResult.payload.map(item => ({
        listing_key: /^[A-Za-z0-9:_-]{1,160}$/.test(String(item.listing_key || '')) ? item.listing_key : '',
        title: cleanText(item.title_snapshot, 100)
      })).filter(item => item.listing_key) : [];
    }
    sendJson(res, 200, { order: { ...order, checkout_url: order.status === 'pending_payment' ? order.checkout_url : null, download_items: downloadItems } });
  } catch (error) {
    console.error('Order status lookup failed:', error?.message || 'unknown_error');
    sendJson(res, 503, { error: 'order_status_unavailable' });
  }
}
