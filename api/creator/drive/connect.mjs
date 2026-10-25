import { randomBytes } from 'node:crypto';
import { getRuntimeConfig } from '../../../server/_lib/config.mjs';
import { methodOnly, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson, setTransientCookie } from '../../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../../server/_lib/rate-limit.mjs';
import { requireVerifiedCreator } from '../../../server/_lib/creator-auth.mjs';
import { STORAGE_AGREEMENT_VERSION } from '../../../server/_lib/google-drive.mjs';

const STATE_COOKIE = 'an_drive_oauth_state';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured', message: 'Secure Creator sign-in is not configured.' });
  if (!config.googleDriveConfigured) return sendJson(res, 503, { error: 'drive_not_configured', message: 'Google Drive OAuth is not configured for this deployment.' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;
  try {
    const body = await readJsonBody(req, 8 * 1024);
    if (body.accepted !== true || body.agreement_version !== STORAGE_AGREEMENT_VERSION) {
      return sendJson(res, 400, { error: 'storage_agreement_required', message: 'Read and accept the current Creator Storage Agreement before connecting Drive.' });
    }
    const session = await requireVerifiedCreator(req, res, config, 'private Creator Drive storage');
    if (!session) return;
    if (!(await consumeRateLimit(req, config, 'creator-drive-oauth-start', 12, 60 * 60))) {
      return sendJson(res, 429, { error: 'rate_limited', message: 'Too many Google Drive connection attempts. Try again later.' });
    }

    const state = randomBytes(32).toString('base64url');
    setTransientCookie(req, res, STATE_COOKIE, state, config, 600);
    const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorize.searchParams.set('client_id', config.googleDriveClientId);
    authorize.searchParams.set('redirect_uri', config.googleDriveRedirectUri);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', 'openid email https://www.googleapis.com/auth/drive.file');
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('access_type', 'offline');
    authorize.searchParams.set('prompt', 'consent');
    authorize.searchParams.set('include_granted_scopes', 'true');
    sendJson(res, 200, { ok: true, authorizationUrl: authorize.href, agreementVersion: STORAGE_AGREEMENT_VERSION });
  } catch (error) {
    console.error('Creator Drive OAuth start failed:', error?.message || 'unknown_error');
    sendJson(res, safeErrorStatus(error, 503), { error: 'drive_connect_unavailable', message: 'Google Drive connection could not be started. Please retry later.' });
  }
}
