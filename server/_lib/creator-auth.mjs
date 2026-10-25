import { sendJson } from './http.mjs';
import { loadServerProfile, verifiedSupabaseUser } from './supabase.mjs';

export async function requireVerifiedCreator(req, res, config, context = 'Creator storage') {
  const session = await verifiedSupabaseUser(req, res, config);
  if (!session) {
    sendJson(res, 401, { error: 'authentication_required', message: `Sign in before using ${context}.` });
    return null;
  }
  if (!(session.user.email_confirmed_at || session.user.confirmed_at)) {
    sendJson(res, 403, { error: 'email_verification_required', message: `Verify your email before using ${context}.` });
    return null;
  }
  const profile = await loadServerProfile(config, session.user.id, String(session.user.email || ''));
  if (profile.role !== 'creator') {
    sendJson(res, 403, { error: 'creator_role_required', message: 'Save a Creator profile before using private Drive storage.' });
    return null;
  }
  return { ...session, profile };
}
