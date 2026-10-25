import { clearSessionCookies, getCookie, setSessionCookies } from './http.mjs';

const jsonHeaders = (key, authorization, extra = {}) => ({
  apikey: key,
  Authorization: `Bearer ${authorization || key}`,
  'Content-Type': 'application/json',
  ...extra
});

export async function supabaseAuthRequest(config, pathname, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1${pathname}`, {
    method: options.method || 'GET',
    headers: jsonHeaders(config.anonKey, options.accessToken || config.anonKey, options.headers || {}),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(12_000)
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  return { response, payload };
}

export async function supabaseServiceRequest(config, pathname, options = {}) {
  const response = await fetch(`${config.supabaseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: jsonHeaders(config.serviceRoleKey, config.serviceRoleKey, options.headers || {}),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(12_000)
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text || null; }
  return { response, payload };
}

export async function verifiedSupabaseUser(req, res, config, { refresh = true } = {}) {
  let accessToken = getCookie(req, 'an_access');
  let refreshToken = getCookie(req, 'an_refresh');
  if (!accessToken && !refreshToken) return null;

  if (accessToken) {
    const current = await supabaseAuthRequest(config, '/user', { accessToken });
    if (current.response.ok && current.payload?.id) {
      return { user: current.payload, accessToken, refreshToken };
    }
    if (current.response.status >= 500) throw new Error('auth_provider_unavailable');
  }

  if (!refresh || !refreshToken) {
    clearSessionCookies(req, res, config);
    return null;
  }

  const refreshed = await supabaseAuthRequest(config, '/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken }
  });
  if (!refreshed.response.ok || !refreshed.payload?.access_token || !refreshed.payload?.refresh_token) {
    if (refreshed.response.status >= 500) throw new Error('auth_provider_unavailable');
    clearSessionCookies(req, res, config);
    return null;
  }

  accessToken = refreshed.payload.access_token;
  refreshToken = refreshed.payload.refresh_token;
  setSessionCookies(req, res, refreshed.payload, config);
  const current = await supabaseAuthRequest(config, '/user', { accessToken });
  if (!current.response.ok || !current.payload?.id) {
    if (current.response.status >= 500) throw new Error('auth_provider_unavailable');
    clearSessionCookies(req, res, config);
    return null;
  }
  return { user: current.payload, accessToken, refreshToken };
}

export async function serviceRpc(config, functionName, args) {
  if (!/^[a-z][a-z0-9_]{1,80}$/.test(functionName)) throw new Error('invalid_rpc_name');
  return supabaseServiceRequest(config, `/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: args,
    headers: { Prefer: 'return=representation' }
  });
}

export async function loadServerProfile(config, userId, fallbackDisplay = '') {
  const escapedId = encodeURIComponent(userId);
  const profilePath = `/rest/v1/profiles?select=id,display_name,account_role&id=eq.${escapedId}&limit=1`;
  const creatorPath = `/rest/v1/creator_profiles?select=user_id,studio_name,bio,verified_mediums,avatar_url,status&user_id=eq.${escapedId}&limit=1`;
  const [profileResult, creatorResult] = await Promise.all([
    supabaseServiceRequest(config, profilePath),
    supabaseServiceRequest(config, creatorPath)
  ]);
  if (!profileResult.response.ok || !creatorResult.response.ok) throw new Error('profile_store_unavailable');
  const profile = Array.isArray(profileResult.payload) ? profileResult.payload[0] || null : null;
  const creatorProfile = Array.isArray(creatorResult.payload) ? creatorResult.payload[0] || null : null;
  const role = profile?.account_role === 'creator' && creatorProfile ? 'creator' : 'collector';
  return {
    id: userId,
    displayName: String(profile?.display_name || '').trim() || String(creatorProfile?.studio_name || '').trim() || String(fallbackDisplay || ''),
    role,
    creatorProfile: role === 'creator' ? creatorProfile : null
  };
}
