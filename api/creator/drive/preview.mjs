import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getRuntimeConfig } from '../../../server/_lib/config.mjs';
import { methodOnly, safeErrorStatus, sendJson } from '../../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../../server/_lib/rate-limit.mjs';
import { serviceRpc, supabaseServiceRequest } from '../../../server/_lib/supabase.mjs';
import { driveFileIdFromPrivateUrl, getDriveFileMetadata, loadDriveConnection, MAX_PREVIEW_FILE_BYTES, privateDriveFileUrl, refreshDriveAccessToken, validateDriveAssetMetadata, driveApiRequest } from '../../../server/_lib/google-drive.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_KEY_PATTERN = /^cw-[a-z0-9-]{1,56}$/;

function rows(value) { return Array.isArray(value) ? value : []; }

async function unlistUnavailable(config, creatorId, workKey) {
  try {
    await serviceRpc(config, 'unlist_work_for_unavailable_drive_source', { p_creator_id: creatorId, p_work_key: workKey });
  } catch (error) {
    console.error('Unavailable Drive source could not be unlisted:', error?.message || 'unknown_error');
  }
}

function writeNotFound(res) {
  return sendJson(res, 404, { error: 'artwork_source_unavailable', message: 'This artwork preview is no longer available.' });
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'preview_not_configured' });
  try {
    if (!(await consumeRateLimit(req, config, 'creator-drive-preview', 240, 60 * 60))) return sendJson(res, 429, { error: 'rate_limited' });
    const url = new URL(req.url || '/', config.appUrl);
    const creatorId = String(url.searchParams.get('creator_id') || '').toLowerCase();
    const workKey = String(url.searchParams.get('work_key') || '');
    const slide = Number(url.searchParams.get('slide') || 0);
    if (!UUID_PATTERN.test(creatorId) || !WORK_KEY_PATTERN.test(workKey) || !Number.isInteger(slide) || slide < 0 || slide > 7) return writeNotFound(res);

    const workQuery = new URLSearchParams({
      select: 'creator_id,work_key,gdrive_source_url,gdrive_preview_url,folio_source_urls,folio_preview_urls,status',
      creator_id: `eq.${creatorId}`,
      work_key: `eq.${workKey}`,
      status: 'eq.published',
      limit: '1'
    });
    const profileQuery = new URLSearchParams({ select: 'user_id,status', user_id: `eq.${creatorId}`, status: 'eq.published', limit: '1' });
    const [workResult, profileResult] = await Promise.all([
      supabaseServiceRequest(config, `/rest/v1/creator_works?${workQuery.toString()}`),
      supabaseServiceRequest(config, `/rest/v1/creator_profiles?${profileQuery.toString()}`)
    ]);
    if (!workResult.response.ok || !profileResult.response.ok) throw new Error('preview_catalog_read_failed');
    const work = rows(workResult.payload)[0];
    if (!work || !rows(profileResult.payload).length) return writeNotFound(res);

    const sourceUrl = slide === 0 ? String(work.gdrive_source_url || '') : String((Array.isArray(work.folio_source_urls) ? work.folio_source_urls : [])[slide - 1] || '');
    const previewUrl = slide === 0 ? String(work.gdrive_preview_url || '') : String((Array.isArray(work.folio_preview_urls) ? work.folio_preview_urls : [])[slide - 1] || '');
    const sourceId = driveFileIdFromPrivateUrl(sourceUrl);
    const previewId = driveFileIdFromPrivateUrl(previewUrl);
    if (!sourceId || !previewId) return writeNotFound(res);
    if (!config.googleDriveConfigured) return sendJson(res, 503, { error: 'preview_provider_not_configured' });

    const connection = await loadDriveConnection(config, creatorId);
    if (!connection) {
      await unlistUnavailable(config, creatorId, workKey);
      return writeNotFound(res);
    }
    let accessToken;
    try { accessToken = await refreshDriveAccessToken(config, connection); }
    catch (error) {
      if (error?.code === 'drive_reauthorization_required' || error?.code === 'drive_token_decryption_failed') {
        await unlistUnavailable(config, creatorId, workKey);
        return writeNotFound(res);
      }
      throw error;
    }

    const [sourceMetadata, previewMetadata] = await Promise.all([
      getDriveFileMetadata(accessToken, sourceId),
      getDriveFileMetadata(accessToken, previewId)
    ]);
    const sourceUnavailable = !sourceMetadata.response.ok && [403, 404].includes(sourceMetadata.response.status);
    const previewUnavailable = !previewMetadata.response.ok && [403, 404].includes(previewMetadata.response.status);
    if (sourceUnavailable || previewUnavailable) {
      await unlistUnavailable(config, creatorId, workKey);
      return writeNotFound(res);
    }
    if (!sourceMetadata.response.ok || !previewMetadata.response.ok) throw new Error('drive_preview_metadata_unavailable');
    if (!validateDriveAssetMetadata(sourceMetadata.payload, connection, creatorId, 'master')
      || !validateDriveAssetMetadata(previewMetadata.payload, connection, creatorId, 'preview')) {
      await unlistUnavailable(config, creatorId, workKey);
      return writeNotFound(res);
    }

    const mediaResponse = await driveApiRequest(accessToken, `/drive/v3/files/${encodeURIComponent(previewId)}?alt=media`, {
      accept: 'image/webp', timeoutMs: 20_000
    });
    if ([403, 404].includes(mediaResponse.status)) {
      await unlistUnavailable(config, creatorId, workKey);
      return writeNotFound(res);
    }
    if (!mediaResponse.ok || !mediaResponse.body) throw new Error('drive_preview_stream_unavailable');
    const actualLength = Number(mediaResponse.headers.get('content-length'));
    if (Number.isFinite(actualLength) && actualLength > MAX_PREVIEW_FILE_BYTES) return sendJson(res, 413, { error: 'preview_too_large' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Disposition', 'inline; filename="art-nexus-preview.webp"');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    const metadataLength = Number(previewMetadata.payload.size);
    if (Number.isSafeInteger(metadataLength) && metadataLength > 0 && metadataLength <= MAX_PREVIEW_FILE_BYTES) res.setHeader('Content-Length', String(metadataLength));
    await pipeline(Readable.fromWeb(mediaResponse.body), res);
  } catch (error) {
    console.error('Controlled Creator preview failed:', error?.message || 'unknown_error');
    if (res.headersSent) {
      if (typeof res.destroy === 'function') res.destroy();
      return;
    }
    sendJson(res, safeErrorStatus(error, 503), { error: 'preview_unavailable', message: 'This controlled artwork preview is temporarily unavailable.' });
  }
}
