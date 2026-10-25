import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { clearSessionCookies, methodOnly, requireSameOrigin, sendJson } from '../../server/_lib/http.mjs';
import { supabaseAuthRequest, verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;
  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (session?.accessToken) {
      // Revoke the provider session where possible; cookie clearing remains unconditional.
      try { await supabaseAuthRequest(config, '/logout', { method: 'POST', accessToken: session.accessToken }); }
      catch { /* Always clear browser cookies even if the provider is temporarily unreachable. */ }
    }
    clearSessionCookies(req, res, config);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Logout failed:', error?.message || 'unknown_error');
    clearSessionCookies(req, res, config);
    sendJson(res, 200, { ok: true });
  }
}
