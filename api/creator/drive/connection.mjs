import { getRuntimeConfig } from '../../../server/_lib/config.mjs';
import { methodOnly, requireSameOrigin, safeErrorStatus, sendJson } from '../../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../../server/_lib/rate-limit.mjs';
import { requireVerifiedCreator } from '../../../server/_lib/creator-auth.mjs';
import { serviceRpc } from '../../../server/_lib/supabase.mjs';
import { decryptDriveRefreshToken, loadDriveConnection, revokeGoogleRefreshToken } from '../../../server/_lib/google-drive.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, ['GET', 'DELETE'])) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured' });
  const method = String(req.method || '').toUpperCase();
  if (method === 'DELETE' && !requireSameOrigin(req, res, config.appUrl)) return;
  try {
    const session = await requireVerifiedCreator(req, res, config, 'private Creator Drive storage');
    if (!session) return;
    if (!(await consumeRateLimit(req, config, method === 'GET' ? 'creator-drive-status' : 'creator-drive-disconnect', method === 'GET' ? 120 : 12, 60 * 60))) {
      return sendJson(res, 429, { error: 'rate_limited', message: 'Too many Drive settings requests. Try again later.' });
    }
    const connection = await loadDriveConnection(config, session.user.id);
    if (method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        configured: config.googleDriveConfigured,
        connected: !!connection,
        googleEmail: connection ? String(connection.google_email || '') : '',
        termsVersion: connection ? String(connection.terms_version || '') : '',
        termsAcceptedAt: connection ? String(connection.terms_accepted_at || '') : ''
      });
    }
    const disconnectResult = await serviceRpc(config, 'disconnect_creator_drive_and_unpublish', { p_creator_id: session.user.id });
    if (!disconnectResult.response.ok) throw new Error('drive_listings_disable_failed');
    if (!connection) return sendJson(res, 200, {
      ok: true, disconnected: true, providerRevoked: true,
      message: 'Drive listings are hidden until reconnect. Your private files are not deleted.'
    });
    let providerRevoked = false;
    if (config.googleDriveConfigured) {
      try {
        const token = decryptDriveRefreshToken(connection, config);
        providerRevoked = await revokeGoogleRefreshToken(token);
      } catch {
        providerRevoked = false;
      }
    }
    sendJson(res, 200, {
      ok: true,
      disconnected: true,
      providerRevoked,
      message: providerRevoked
        ? 'Art Nexus disconnected. Public listings are hidden until you reconnect; your Drive files remain private and are not deleted.'
        : 'Art Nexus removed its stored connection and hid public listings. Google could not confirm token revocation; you can also remove Art Nexus from your Google Account security settings.'
    });
  } catch (error) {
    console.error('Creator Drive connection settings failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'drive_settings_unavailable', message: 'Drive connection settings are temporarily unavailable.' });
  }
}
