import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { cleanText, methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { serviceRpc, verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';

function normalizeMediums(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const raw of value.slice(0, 24)) {
    const medium = cleanText(raw, 80);
    const key = medium.toLocaleLowerCase();
    if (!medium || seen.has(key)) continue;
    seen.add(key);
    result.push(medium);
    if (result.length === 12) break;
  }
  return result;
}

function safeAvatarUrl(value) {
  const text = cleanText(value, 1_500);
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;
  let body;
  try { body = await readJsonBody(req, 24 * 1024); }
  catch (error) { return sendJson(res, safeErrorStatus(error, 400), { error: 'invalid_request' }); }
  const accountName = cleanText(body.accountName || body.displayName || body.name || body.studioName, 80);
  const studioName = cleanText(body.studioName || body.name || accountName, 80);
  const bio = cleanText(body.bio || body.biography, 600);
  const verifiedMediums = normalizeMediums(body.verifiedMediums || body.verified_mediums);
  const avatarUrl = safeAvatarUrl(body.avatarUrl || body.avatar_url);
  if (!accountName || !studioName) return sendJson(res, 400, { error: 'invalid_creator_profile', message: 'A personal name and public studio name are required.' });

  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 401, { error: 'authentication_required' });
    if (!(session.user.email_confirmed_at || session.user.confirmed_at)) return sendJson(res, 403, { error: 'email_verification_required' });
    if (!(await consumeRateLimit(req, config, 'creator-profile-write', 10, 60 * 60))) return sendJson(res, 429, { error: 'rate_limited' });

    const result = await serviceRpc(config, 'upsert_creator_profile', {
      p_user_id: session.user.id,
      p_display_name: accountName,
      p_studio_name: studioName,
      p_bio: bio,
      p_verified_mediums: verifiedMediums,
      p_avatar_url: avatarUrl || null
    });
    if (!result.response.ok) throw new Error('creator_profile_write_failed');
    const creatorProfile = Array.isArray(result.payload) ? result.payload[0] : result.payload;
    sendJson(res, 200, {
      ok: true,
      user: { id: session.user.id, email: session.user.email, role: 'creator', displayName: accountName },
      creatorProfile: creatorProfile || {
        user_id: session.user.id,
        studio_name: studioName,
        bio,
        verified_mediums: verifiedMediums,
        avatar_url: avatarUrl || null,
        status: 'draft'
      }
    });
  } catch (error) {
    console.error('Creator profile save failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'creator_profile_unavailable', message: 'Creator profile could not be saved to your account. Please retry; your current screen remains available.' });
  }
}
