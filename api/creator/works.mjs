import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { cleanText, methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { loadServerProfile, serviceRpc, supabaseServiceRequest, verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';
import { driveFileIdFromPrivateUrl, getDriveFileMetadata, loadDriveConnection, refreshDriveAccessToken, validateDriveAssetMetadata } from '../../server/_lib/google-drive.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_KEY_PATTERN = /^cw-[a-z0-9-]{1,56}$/;
const SALE_TYPES = new Set(['1-of-1', 'PRINTS']);

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function ownedAssetUrl(value, supabaseUrl, userId) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'https:' || parsed.origin !== supabaseUrl || parsed.search || parsed.hash) return '';
    const prefix = `/storage/v1/object/public/creator-public-assets/${userId.toLowerCase()}/`;
    if (!parsed.pathname.startsWith(prefix) || !/^[A-Za-z0-9._-]{1,120}$/.test(parsed.pathname.slice(prefix.length))) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function normalizeWorkBody(value, config, userId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const workKey = String(value.work_key || value.workKey || value.id || '').trim();
  const title = cleanText(value.title, 100);
  const description = cleanText(value.description, 500);
  const medium = cleanText(value.medium, 80);
  const thumbnailCacheUrl = ownedAssetUrl(value.thumbnail_cache_url || value.image_url || value.image, config.supabaseUrl, userId);
  const sourceUrl = String(value.gdrive_source_url || '').trim();
  const previewUrl = String(value.gdrive_preview_url || '').trim();
  const folioInput = Array.isArray(value.folio_slides) ? value.folio_slides : [];
  const folioSourceInput = Array.isArray(value.folio_source_urls) ? value.folio_source_urls : [];
  const folioPreviewInput = Array.isArray(value.folio_preview_urls) ? value.folio_preview_urls : [];
  if (!WORK_KEY_PATTERN.test(workKey) || !title || !medium || !thumbnailCacheUrl
    || !driveFileIdFromPrivateUrl(sourceUrl) || !driveFileIdFromPrivateUrl(previewUrl)
    || folioInput.length > 7 || folioSourceInput.length !== folioInput.length || folioPreviewInput.length !== folioInput.length) return null;
  const folioSlides = [];
  for (const slide of folioInput) {
    const url = ownedAssetUrl(slide, config.supabaseUrl, userId);
    if (!url) return null;
    folioSlides.push(url);
  }
  const folioSourceUrls = folioSourceInput.map(value => String(value || '').trim());
  const folioPreviewUrls = folioPreviewInput.map(value => String(value || '').trim());
  if (folioSourceUrls.some(value => !driveFileIdFromPrivateUrl(value)) || folioPreviewUrls.some(value => !driveFileIdFromPrivateUrl(value))) return null;
  const isForSale = value.is_for_sale === true;
  let saleType = null;
  let priceMinor = null;
  let stockTotal = null;
  if (isForSale) {
    const requestedType = String(value.sale_type || '').trim();
    const price = Number(value.price_value != null ? value.price_value : value.price);
    if (!SALE_TYPES.has(requestedType) || !Number.isSafeInteger(price) || price < 1 || price > 100_000_000) return null;
    saleType = requestedType === 'PRINTS' ? 'print' : 'original';
    stockTotal = requestedType === 'PRINTS' ? Number(value.edition_size) : 1;
    if (!Number.isInteger(stockTotal) || stockTotal < 1 || stockTotal > 999 || (requestedType === '1-of-1' && stockTotal !== 1)) return null;
    priceMinor = Math.round(price * 100);
    if (!Number.isSafeInteger(priceMinor) || priceMinor < 100 || priceMinor > 10_000_000_000) return null;
  }
  return { workKey, title, description, medium, thumbnailCacheUrl, sourceUrl, previewUrl, folioSlides, folioSourceUrls, folioPreviewUrls, isForSale, saleType, priceMinor, stockTotal };
}

async function verifyDriveMediaOwnership(config, userId, work) {
  const connection = await loadDriveConnection(config, userId);
  if (!connection || connection.terms_version !== '2026-10-16-v1' || !connection.terms_accepted_at) throw new Error('drive_connection_required');
  const accessToken = await refreshDriveAccessToken(config, connection);
  const assets = [
    { url: work.sourceUrl, kind: 'master' },
    { url: work.previewUrl, kind: 'preview' },
    ...work.folioSourceUrls.map(url => ({ url, kind: 'master' })),
    ...work.folioPreviewUrls.map(url => ({ url, kind: 'preview' }))
  ];
  const checks = await Promise.all(assets.map(async asset => {
    const fileId = driveFileIdFromPrivateUrl(asset.url);
    const result = await getDriveFileMetadata(accessToken, fileId);
    if (!result.response.ok || !validateDriveAssetMetadata(result.payload, connection, userId, asset.kind)) return false;
    return true;
  }));
  return checks.every(Boolean);
}

function mapRpcError(payload) {
  const text = (typeof payload === 'string' ? payload : JSON.stringify(payload || '')).toLowerCase();
  if (text.includes('creator_role_required')) return { status: 403, error: 'creator_role_required', message: 'A verified Creator account is required to save artwork.' };
  if (text.includes('creator_profile_not_published')) return { status: 403, error: 'creator_profile_not_published', message: 'Your Creator profile must be approved and published before artwork can be listed for sale. Your local copy remains available.' };
  if (text.includes('invalid_')) return { status: 400, error: 'invalid_creator_work', message: 'The artwork details or uploaded image could not be validated.' };
  if (/listing_|reservation|inventory|activity|sold|work_unavailable/.test(text)) return { status: 409, error: 'creator_work_conflict', message: 'This artwork has active orders or fixed edition history and cannot be changed that way.' };
  return { status: 503, error: 'creator_work_unavailable', message: 'Creator artwork could not be saved right now. Your local copy remains available.' };
}

function mapOwnedWork(row, listing, config, userId) {
  const workKey = String(row.work_key || '');
  const image = ownedAssetUrl(row.thumbnail_cache_url || row.image_url, config.supabaseUrl, userId);
  if (!WORK_KEY_PATTERN.test(workKey) || !image || row.status !== 'published') return null;
  const folioSlides = Array.isArray(row.folio_slides)
    ? row.folio_slides.slice(0, 7).map(value => ownedAssetUrl(value, config.supabaseUrl, userId)).filter(Boolean)
    : [];
  const listingType = listing && ['original', 'print'].includes(listing.sale_type)
    ? listing.sale_type === 'print' ? 'PRINTS' : '1-of-1'
    : null;
  const listingActive = !!listing && listing.is_published === true && ['published', 'sold_out'].includes(listing.status) && !!listingType;
  const stockTotal = listingType ? Number(listing.stock_total) : null;
  const remaining = listingType ? Math.max(0, Number(listing.stock_total) - Number(listing.sold_quantity || 0) - Number(listing.reserved_quantity || 0)) : null;
  const soldOut = listingActive && (listing.status === 'sold_out' || Number(listing.sold_quantity || 0) >= stockTotal);
  const isForSale = listingActive && Number(listing.price_minor) > 0;
  const priceValue = listing && Number.isSafeInteger(Number(listing.price_minor)) ? Math.floor(Number(listing.price_minor) / 100) : null;
  const listingKey = `creator:${userId.toLowerCase()}:${workKey}`;
  return {
    id: workKey,
    title: cleanText(row.title, 100),
    description: cleanText(row.description, 500),
    medium: cleanText(row.medium, 80) || 'Mixed media',
    image,
    thumbnail_cache_url: image,
    gdrive_source_url: String(row.gdrive_source_url || ''),
    gdrive_preview_url: String(row.gdrive_preview_url || ''),
    folio_source_urls: Array.isArray(row.folio_source_urls) ? row.folio_source_urls.slice(0, 7) : [],
    folio_drive_preview_urls: Array.isArray(row.folio_preview_urls) ? row.folio_preview_urls.slice(0, 7) : [],
    folio_slides: folioSlides,
    is_folio_stack: folioSlides.length > 0,
    status: soldOut ? 'sold-out' : isForSale ? 'for-sale' : 'unlisted',
    is_for_sale: isForSale,
    sale_type: isForSale ? listingType : null,
    inventory_type: listingType,
    edition_size: stockTotal,
    remaining_stock: remaining,
    reserved_quantity: listingType ? Number(listing.reserved_quantity || 0) : 0,
    sold_quantity: listingType ? Number(listing.sold_quantity || 0) : 0,
    sellout_locked: !!soldOut,
    no_reproduction_after_sellout: listingType === 'PRINTS',
    price_value: isForSale ? priceValue : null,
    price: isForSale ? priceValue : 0,
    listing_key: isForSale ? listingKey : null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

async function authorizeCreator(req, res, config) {
  const session = await verifiedSupabaseUser(req, res, config);
  if (!session) {
    sendJson(res, 401, { error: 'authentication_required', message: 'Sign in before managing Creator artwork.' });
    return null;
  }
  if (!(session.user.email_confirmed_at || session.user.confirmed_at)) {
    sendJson(res, 403, { error: 'email_verification_required', message: 'Verify your email before managing Creator artwork.' });
    return null;
  }
  const profile = await loadServerProfile(config, session.user.id, String(session.user.email || ''));
  if (profile.role !== 'creator') {
    sendJson(res, 403, { error: 'creator_role_required', message: 'Save a Creator profile before managing artwork.' });
    return null;
  }
  return session;
}

async function listOwnedWorks(res, session, config) {
  const creatorId = String(session.user.id || '').toLowerCase();
  if (!UUID_PATTERN.test(creatorId)) return sendJson(res, 401, { error: 'authentication_required' });
  const workQuery = new URLSearchParams({
    select: 'work_key,title,description,medium,image_url,thumbnail_cache_url,gdrive_source_url,gdrive_preview_url,folio_slides,folio_source_urls,folio_preview_urls,status,created_at,updated_at',
    creator_id: `eq.${creatorId}`,
    status: 'eq.published',
    order: 'updated_at.desc',
    limit: '8'
  });
  const listingQuery = new URLSearchParams({
    select: 'listing_key,sale_type,currency,price_minor,stock_total,reserved_quantity,sold_quantity,is_published,status',
    creator_id: `eq.${creatorId}`,
    limit: '24'
  });
  const [workResult, listingResult] = await Promise.all([
    supabaseServiceRequest(config, `/rest/v1/creator_works?${workQuery.toString()}`),
    supabaseServiceRequest(config, `/rest/v1/artwork_listings?${listingQuery.toString()}`)
  ]);
  if (!workResult.response.ok || !listingResult.response.ok) throw new Error('creator_work_read_failed');
  const listingMap = new Map(rows(listingResult.payload).filter(row => typeof row.listing_key === 'string').map(row => [row.listing_key, row]));
  const works = rows(workResult.payload).map(row => {
    const key = String(row.work_key || '');
    return mapOwnedWork(row, listingMap.get(`creator:${creatorId}:${key}`), config, creatorId);
  }).filter(Boolean);
  sendJson(res, 200, { ok: true, works });
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, ['GET', 'POST', 'DELETE'])) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'creator_work_not_configured', message: 'Creator artwork persistence is not configured.' });
  const method = String(req.method || '').toUpperCase();
  if (method !== 'GET' && !requireSameOrigin(req, res, config.appUrl)) return;
  try {
    const session = await authorizeCreator(req, res, config);
    if (!session) return;
    const isRead = method === 'GET';
    if (!(await consumeRateLimit(req, config, isRead ? 'creator-work-read' : 'creator-work-write', isRead ? 120 : 60, 60 * 60))) {
      return sendJson(res, 429, { error: 'rate_limited', message: 'Too many Creator artwork requests. Please try again later.' });
    }
    if (method === 'GET') return await listOwnedWorks(res, session, config);

    const body = await readJsonBody(req, 64 * 1024);
    if (method === 'DELETE') {
      const workKey = String(body.work_key || body.workKey || body.id || '').trim();
      if (!WORK_KEY_PATTERN.test(workKey)) return sendJson(res, 400, { error: 'invalid_creator_work' });
      const removed = await serviceRpc(config, 'remove_creator_work', { p_user_id: session.user.id, p_work_key: workKey });
      if (!removed.response.ok) {
        const mapped = mapRpcError(removed.payload);
        return sendJson(res, mapped.status, { error: mapped.error, message: mapped.message });
      }
      const result = Array.isArray(removed.payload) ? removed.payload[0] : removed.payload;
      return sendJson(res, 200, { ok: true, removed: result === true });
    }

    const work = normalizeWorkBody(body.work || body, config, session.user.id);
    if (!work) return sendJson(res, 400, { error: 'invalid_creator_work', message: 'Artwork text, WebP thumbnail, private Drive source, preview, or Folio media references are invalid.' });
    if (!(await verifyDriveMediaOwnership(config, session.user.id, work))) {
      return sendJson(res, 409, { error: 'drive_media_unavailable', message: 'The private Drive source or preview could not be verified in your ArtNexus_Vault. Reconnect Drive or upload the affected artwork again.' });
    }
    const saved = await serviceRpc(config, 'upsert_creator_work_with_drive_media', {
      p_user_id: session.user.id,
      p_work_key: work.workKey,
      p_title: work.title,
      p_description: work.description,
      p_medium: work.medium,
      p_thumbnail_cache_url: work.thumbnailCacheUrl,
      p_folio_slides: work.folioSlides,
      p_gdrive_source_url: work.sourceUrl,
      p_gdrive_preview_url: work.previewUrl,
      p_folio_source_urls: work.folioSourceUrls,
      p_folio_preview_urls: work.folioPreviewUrls,
      p_is_for_sale: work.isForSale,
      p_sale_type: work.saleType,
      p_price_minor: work.priceMinor,
      p_stock_total: work.stockTotal
    });
    if (!saved.response.ok) {
      const mapped = mapRpcError(saved.payload);
      return sendJson(res, mapped.status, { error: mapped.error, message: mapped.message });
    }
    const result = Array.isArray(saved.payload) ? saved.payload[0] : saved.payload;
    if (!result || typeof result !== 'object' || result.work_key !== work.workKey) throw new Error('creator_work_write_response_invalid');
    sendJson(res, 200, {
      ok: true,
      workKey: work.workKey,
      workId: result.work_id,
      listingKey: typeof result.listing_key === 'string' ? result.listing_key : null,
      isForSale: result.is_for_sale === true,
      listingStatus: result.listing_status || 'unlisted'
    });
  } catch (error) {
    console.error('Creator artwork API failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'creator_work_unavailable', message: 'Creator artwork could not be synchronized. Your local copy remains available; please retry.' });
  }
}
