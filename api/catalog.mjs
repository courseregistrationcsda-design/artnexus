import { getRuntimeConfig } from '../server/_lib/config.mjs';
import { methodOnly, safeErrorStatus, sendJson } from '../server/_lib/http.mjs';
import { consumeRateLimit } from '../server/_lib/rate-limit.mjs';
import { supabaseServiceRequest } from '../server/_lib/supabase.mjs';
import { STORAGE_AGREEMENT_VERSION } from '../server/_lib/google-drive.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORK_KEY_PATTERN = /^cw-[a-z0-9-]{1,56}$/;

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function publicAssetUrl(value, supabaseUrl, ownerId = '') {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'https:' || parsed.origin !== supabaseUrl || parsed.search || parsed.hash) return '';
    const match = /^\/storage\/v1\/object\/public\/creator-public-assets\/([0-9a-f-]{36})\/[A-Za-z0-9._-]{1,120}$/.exec(parsed.pathname);
    if (!match || (ownerId && match[1].toLowerCase() !== ownerId.toLowerCase())) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function cleanText(value, max) {
  return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeSlides(value, supabaseUrl, ownerId) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 7).map(item => publicAssetUrl(item, supabaseUrl, ownerId)).filter(Boolean);
}

function asInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function makePublicArtist(profile, workRows, listingByKey, config) {
  const userId = String(profile.user_id || '').toLowerCase();
  const studioName = cleanText(profile.studio_name, 80);
  if (!UUID_PATTERN.test(userId) || !studioName || profile.status !== 'published') return null;
  const verifiedMediums = Array.isArray(profile.verified_mediums)
    ? Array.from(new Set(profile.verified_mediums.slice(0, 12).map(value => cleanText(value, 80)).filter(Boolean)))
    : [];
  const works = [];
  for (const row of workRows) {
    const workKey = String(row.work_key || '');
    const image = publicAssetUrl(row.thumbnail_cache_url || row.image_url, config.supabaseUrl, userId);
    if (row.status !== 'published' || !WORK_KEY_PATTERN.test(workKey) || !image) continue;
    const folioSlides = safeSlides(row.folio_slides, config.supabaseUrl, userId);
    const hasControlledPreview = typeof row.gdrive_source_url === 'string' && !!row.gdrive_source_url
      && typeof row.gdrive_preview_url === 'string' && !!row.gdrive_preview_url;
    const previewUrl = hasControlledPreview
      ? `/api/creator/drive/preview?creator_id=${encodeURIComponent(userId)}&work_key=${encodeURIComponent(workKey)}&slide=0`
      : '';
    const folioPreviewUrls = hasControlledPreview && Array.isArray(row.folio_preview_urls)
      ? row.folio_preview_urls.slice(0, 7).map((_, index) => `/api/creator/drive/preview?creator_id=${encodeURIComponent(userId)}&work_key=${encodeURIComponent(workKey)}&slide=${index + 1}`)
      : [];
    const listingKey = `creator:${userId}:${workKey}`;
    const listing = listingByKey.get(listingKey);
    const activeListing = !!listing && listing.is_published === true && ['published', 'sold_out'].includes(listing.status)
      && ['original', 'print'].includes(listing.sale_type) && String(listing.currency || '').toUpperCase() === 'PHP';
    const stockTotal = activeListing ? asInteger(listing.stock_total) : 0;
    const remaining = activeListing ? Math.max(0, stockTotal - asInteger(listing.reserved_quantity) - asInteger(listing.sold_quantity)) : 0;
    const priceMinor = activeListing ? asInteger(listing.price_minor) : 0;
    const saleType = activeListing ? (listing.sale_type === 'print' ? 'PRINTS' : '1-of-1') : null;
    const forSale = activeListing && priceMinor > 0;
    const soldOut = forSale && (listing.status === 'sold_out' || asInteger(listing.sold_quantity) >= stockTotal);
    works.push({
      id: workKey,
      work_key: workKey,
      title: cleanText(row.title, 100),
      description: cleanText(row.description, 500),
      medium: cleanText(row.medium, 80) || 'Mixed media',
      image,
      thumbnail_cache_url: image,
      preview_url: previewUrl,
      folio_slides: folioSlides,
      folio_preview_urls: folioPreviewUrls,
      is_folio_stack: folioSlides.length > 0,
      is_for_sale: forSale,
      sale_type: forSale ? saleType : null,
      inventory_type: activeListing ? saleType : null,
      price_value: forSale ? Math.floor(priceMinor / 100) : null,
      price_minor: forSale ? priceMinor : null,
      listing_key: forSale ? listingKey : null,
      currency: 'PHP',
      edition_size: activeListing ? stockTotal : null,
      remaining_stock: activeListing ? remaining : null,
      reserved_quantity: activeListing ? asInteger(listing.reserved_quantity) : 0,
      sold_quantity: activeListing ? asInteger(listing.sold_quantity) : 0,
      sellout_locked: !!soldOut,
      no_reproduction_after_sellout: activeListing && listing.sale_type === 'print',
      status: soldOut ? 'sold-out' : forSale ? 'for-sale' : 'unlisted',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    });
  }
  return {
    user_id: userId,
    studio_name: studioName,
    bio: cleanText(profile.bio, 600),
    verified_mediums: verifiedMediums,
    avatar_url: publicAssetUrl(profile.avatar_url, config.supabaseUrl, userId),
    created_at: profile.created_at || '',
    updated_at: profile.updated_at || '',
    works
  };
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'catalog_not_configured' });
  try {
    if (!(await consumeRateLimit(req, config, 'public-catalog-read', 120, 60))) return sendJson(res, 429, { error: 'rate_limited' });
    const profileQuery = new URLSearchParams({
      select: 'user_id,studio_name,bio,verified_mediums,avatar_url,status,created_at,updated_at',
      status: 'eq.published',
      order: 'updated_at.desc',
      limit: '250'
    });
    const profilesResult = await supabaseServiceRequest(config, `/rest/v1/creator_profiles?${profileQuery.toString()}`);
    if (!profilesResult.response.ok) throw new Error('public_creator_profiles_read_failed');
    const profiles = rows(profilesResult.payload).filter(profile => UUID_PATTERN.test(String(profile.user_id || '')));
    if (!profiles.length) return sendJson(res, 200, { artists: [], generatedAt: new Date().toISOString() });

    const creatorIds = profiles.map(profile => String(profile.user_id).toLowerCase());
    const creatorFilter = `in.(${creatorIds.join(',')})`;
    const workQuery = new URLSearchParams({
      select: 'creator_id,work_key,title,description,medium,image_url,thumbnail_cache_url,gdrive_source_url,gdrive_preview_url,folio_slides,folio_preview_urls,status,created_at,updated_at',
      creator_id: creatorFilter,
      status: 'eq.published',
      order: 'updated_at.desc',
      limit: '2000'
    });
    const listingQuery = new URLSearchParams({
      select: 'creator_id,listing_key,sale_type,currency,price_minor,stock_total,reserved_quantity,sold_quantity,is_published,status',
      creator_id: creatorFilter,
      is_published: 'eq.true',
      status: 'in.(published,sold_out)',
      limit: '2000'
    });
    const connectionQuery = new URLSearchParams({
      select: 'user_id,terms_version,terms_accepted_at',
      user_id: creatorFilter,
      limit: '250'
    });
    const [worksResult, listingsResult, connectionsResult] = await Promise.all([
      supabaseServiceRequest(config, `/rest/v1/creator_works?${workQuery.toString()}`),
      supabaseServiceRequest(config, `/rest/v1/artwork_listings?${listingQuery.toString()}`),
      supabaseServiceRequest(config, `/rest/v1/creator_drive_connections?${connectionQuery.toString()}`)
    ]);
    if (!worksResult.response.ok || !listingsResult.response.ok || !connectionsResult.response.ok) throw new Error('public_creator_catalog_read_failed');

    const connectedCreatorIds = new Set(rows(connectionsResult.payload)
      .filter(row => row.terms_version === STORAGE_AGREEMENT_VERSION && !!row.terms_accepted_at)
      .map(row => String(row.user_id || '').toLowerCase())
      .filter(id => creatorIds.includes(id)));
    const worksByCreator = new Map(creatorIds.filter(id => connectedCreatorIds.has(id)).map(id => [id, []]));
    for (const work of rows(worksResult.payload)) {
      const creatorId = String(work.creator_id || '').toLowerCase();
      if (worksByCreator.has(creatorId)) worksByCreator.get(creatorId).push(work);
    }
    const listings = new Map();
    for (const listing of rows(listingsResult.payload)) {
      if (listing && typeof listing.listing_key === 'string') listings.set(listing.listing_key, listing);
    }
    const artists = profiles.map(profile => makePublicArtist(profile, worksByCreator.get(String(profile.user_id).toLowerCase()) || [], listings, config))
      .filter(artist => artist && artist.works.length)
      .slice(0, 250);
    sendJson(res, 200, { artists, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Public Creator catalog read failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'catalog_unavailable', message: 'Published Creator artwork is temporarily unavailable.' });
  }
}
