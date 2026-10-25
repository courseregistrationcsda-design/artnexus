import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, normalizedEmail, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { supabaseServiceRequest } from '../../server/_lib/supabase.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 200, { available: false, email: '' });
  try {
    const url = new URL(req.url || '/', config.appUrl);
    const artistId = String(url.searchParams.get('artist_id') || '').trim();
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(artistId)) return sendJson(res, 400, { error: 'invalid_artist' });
    if (!(await consumeRateLimit(req, config, 'artist-contact-read', 60, 60 * 60))) return sendJson(res, 429, { error: 'rate_limited' });
    const query = new URLSearchParams({
      select: 'public_email',
      artist_id: `eq.${artistId}`,
      verified_at: 'not.is.null',
      public_contact_enabled: 'eq.true',
      limit: '1'
    });
    const result = await supabaseServiceRequest(config, `/rest/v1/artist_contacts?${query.toString()}`);
    if (!result.response.ok) throw new Error('contact_lookup_failed');
    const row = Array.isArray(result.payload) ? result.payload[0] : null;
    const email = normalizedEmail(row?.public_email);
    sendJson(res, 200, { available: !!email, email });
  } catch (error) {
    console.error('Artist contact lookup failed:', error?.message || 'unknown_error');
    sendJson(res, 200, { available: false, email: '' });
  }
}
