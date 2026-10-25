import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, sendRedirect, setSessionCookies } from '../../server/_lib/http.mjs';
import { supabaseAuthRequest } from '../../server/_lib/supabase.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendRedirect(res, '/?auth=unavailable', 303);
  let url;
  try { url = new URL(req.url || '/', config.appUrl); }
  catch { return sendRedirect(res, `${config.appUrl}/?auth=error`, 303); }
  const tokenHash = String(url.searchParams.get('token_hash') || '');
  const type = String(url.searchParams.get('type') || 'email');
  if (!/^[A-Za-z0-9._~-]{8,512}$/.test(tokenHash) || !['email', 'signup', 'magiclink', 'email_change'].includes(type)) {
    return sendRedirect(res, `${config.appUrl}/?auth=error`, 303);
  }
  try {
    const result = await supabaseAuthRequest(config, '/verify', {
      method: 'POST',
      body: { token_hash: tokenHash, type }
    });
    const session = result.payload;
    if (!result.response.ok || !session?.access_token || !session?.refresh_token || !session?.user?.id) {
      console.warn('Supabase email verification failed; provider detail omitted.');
      return sendRedirect(res, `${config.appUrl}/?auth=error`, 303);
    }
    setSessionCookies(req, res, session, config);
    return sendRedirect(res, `${config.appUrl}/?auth=confirmed`, 303);
  } catch (error) {
    console.error('Auth callback failed:', error?.message || 'unknown_error');
    return sendRedirect(res, `${config.appUrl}/?auth=error`, 303);
  }
}
