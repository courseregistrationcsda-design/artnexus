import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, safeErrorStatus, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { driveFileIdFromPrivateUrl, getDriveFileMetadata, loadDriveConnection, MAX_DRIVE_FILE_BYTES, refreshDriveAccessToken, sanitizeDriveFileName, validateDriveAssetMetadata, driveApiRequest } from '../../server/_lib/google-drive.mjs';
import { serviceRpc, supabaseServiceRequest } from '../../server/_lib/supabase.mjs';

const TICKET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_KEY_PATTERN = /^cw-[a-z0-9-]{1,56}$/;

function rows(value) { return Array.isArray(value) ? value : []; }

async function markUnavailable(config, creatorId, workKey) {
  try { await serviceRpc(config, 'unlist_work_for_unavailable_drive_source', { p_creator_id: creatorId, p_work_key: workKey }); }
  catch (error) { console.error('Unavailable paid-download source could not be unlisted:', error?.message || 'unknown_error'); }
}

function unavailable(res) {
  return sendJson(res, 410, { error: 'private_original_unavailable', message: 'The paid order is verified, but its private original is currently unavailable. Contact Creator support.' });
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured || !config.googleDriveConfigured) return sendJson(res, 503, { error: 'download_not_configured' });
  try {
    if (!(await consumeRateLimit(req, config, 'paid-download-stream', 20, 60 * 60))) return sendJson(res, 429, { error: 'rate_limited' });
    const url = new URL(req.url || '/', config.appUrl);
    const ticket = String(url.searchParams.get('token') || '');
    if (!TICKET_PATTERN.test(ticket)) return sendJson(res, 404, { error: 'download_link_invalid_or_expired' });
    const tokenHash = createHash('sha256').update(ticket).digest('hex');
    const consumed = await serviceRpc(config, 'consume_artwork_download_ticket', { p_token_hash: tokenHash });
    if (!consumed.response.ok) throw new Error('download_ticket_consume_failed');
    const ticketData = Array.isArray(consumed.payload) ? consumed.payload[0] : consumed.payload;
    if (!ticketData || !UUID_PATTERN.test(String(ticketData.order_id || ''))
      || !UUID_PATTERN.test(String(ticketData.user_id || ''))
      || !UUID_PATTERN.test(String(ticketData.creator_id || ''))
      || !WORK_KEY_PATTERN.test(String(ticketData.work_key || ''))) return sendJson(res, 404, { error: 'download_link_invalid_or_expired' });

    const orderQuery = new URLSearchParams({
      select: 'id,status,user_id', id: `eq.${ticketData.order_id}`, user_id: `eq.${ticketData.user_id}`, limit: '1'
    });
    const itemQuery = new URLSearchParams({
      select: 'listing_key', order_id: `eq.${ticketData.order_id}`, listing_key: `eq.${ticketData.listing_key}`, limit: '1'
    });
    const workQuery = new URLSearchParams({
      select: 'creator_id,work_key,gdrive_source_url,status', creator_id: `eq.${ticketData.creator_id}`,
      work_key: `eq.${ticketData.work_key}`, status: 'eq.published', limit: '1'
    });
    const [orderResult, itemResult, workResult] = await Promise.all([
      supabaseServiceRequest(config, `/rest/v1/orders?${orderQuery.toString()}`),
      supabaseServiceRequest(config, `/rest/v1/order_items?${itemQuery.toString()}`),
      supabaseServiceRequest(config, `/rest/v1/creator_works?${workQuery.toString()}`)
    ]);
    if (!orderResult.response.ok || !itemResult.response.ok || !workResult.response.ok) throw new Error('paid_download_order_read_failed');
    const order = rows(orderResult.payload)[0];
    const orderItem = rows(itemResult.payload)[0];
    const work = rows(workResult.payload)[0];
    if (!order || order.status !== 'paid' || !orderItem || !work) return sendJson(res, 403, { error: 'paid_order_required', message: 'The download requires a current server-verified paid order.' });

    const sourceId = driveFileIdFromPrivateUrl(String(work.gdrive_source_url || ''));
    if (!sourceId) {
      await markUnavailable(config, ticketData.creator_id, ticketData.work_key);
      return unavailable(res);
    }
    const connection = await loadDriveConnection(config, ticketData.creator_id);
    if (!connection) {
      await markUnavailable(config, ticketData.creator_id, ticketData.work_key);
      return unavailable(res);
    }
    let accessToken;
    try { accessToken = await refreshDriveAccessToken(config, connection); }
    catch (error) {
      if (error?.code === 'drive_reauthorization_required' || error?.code === 'drive_token_decryption_failed') {
        await markUnavailable(config, ticketData.creator_id, ticketData.work_key);
        return unavailable(res);
      }
      throw error;
    }

    const metadata = await getDriveFileMetadata(accessToken, sourceId);
    if (!metadata.response.ok && [403, 404].includes(metadata.response.status)) {
      await markUnavailable(config, ticketData.creator_id, ticketData.work_key);
      return unavailable(res);
    }
    if (!metadata.response.ok) throw new Error('paid_download_source_metadata_failed');
    if (!validateDriveAssetMetadata(metadata.payload, connection, ticketData.creator_id, 'master')) {
      await markUnavailable(config, ticketData.creator_id, ticketData.work_key);
      return unavailable(res);
    }
    const fileSize = Number(metadata.payload.size);
    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_DRIVE_FILE_BYTES) return sendJson(res, 413, { error: 'private_original_too_large' });

    const mediaResponse = await driveApiRequest(accessToken, `/drive/v3/files/${encodeURIComponent(sourceId)}?alt=media`, {
      accept: 'application/octet-stream', timeoutMs: 60_000
    });
    if ([403, 404].includes(mediaResponse.status)) {
      await markUnavailable(config, ticketData.creator_id, ticketData.work_key);
      return unavailable(res);
    }
    if (!mediaResponse.ok || !mediaResponse.body) throw new Error('paid_download_stream_failed');

    const safeName = sanitizeDriveFileName(metadata.payload.name || `work-${ticketData.work_key}`, 'art-nexus-original');
    res.statusCode = 200;
    res.setHeader('Content-Type', String(metadata.payload.mimeType || 'application/octet-stream'));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', String(fileSize));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    await pipeline(Readable.fromWeb(mediaResponse.body), res);
  } catch (error) {
    console.error('Paid artwork download failed:', error?.message || 'unknown_error');
    if (res.headersSent) {
      if (typeof res.destroy === 'function') res.destroy();
      return;
    }
    sendJson(res, safeErrorStatus(error, 503), { error: 'download_unavailable', message: 'Private artwork download is temporarily unavailable. Request a fresh one-time link and retry.' });
  }
}
