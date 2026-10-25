import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, sendJson } from '../../server/_lib/http.mjs';
import { loadServerProfile, verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 200, { configured: false, authenticated: false });
  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 200, { configured: true, authenticated: false });
    const fallbackName = String(session.user.user_metadata?.display_name || session.user.email || '').trim();
    const profile = await loadServerProfile(config, session.user.id, fallbackName);
    sendJson(res, 200, {
      configured: true,
      authenticated: true,
      user: {
        id: session.user.id,
        email: String(session.user.email || ''),
        emailVerified: !!(session.user.email_confirmed_at || session.user.confirmed_at),
        displayName: profile.displayName,
        role: profile.role,
        creatorProfile: profile.creatorProfile
      }
    });
  } catch (error) {
    console.error('Session lookup failed:', error?.message || 'unknown_error');
    sendJson(res, 503, { error: 'session_unavailable', message: 'Your account could not be checked right now. Please retry.' });
  }
}
