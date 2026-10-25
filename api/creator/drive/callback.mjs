import { timingSafeEqual } from 'node:crypto';
import { getRuntimeConfig } from '../../../server/_lib/config.mjs';
import { clearTransientCookie, getCookie, sendJson, sendRedirect } from '../../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../../server/_lib/rate-limit.mjs';
import { requireVerifiedCreator } from '../../../server/_lib/creator-auth.mjs';
import { clearSessionCookies } from '../../../server/_lib/http.mjs';
import { encryptDriveRefreshToken, ensureDriveVaultFolder, getGoogleAccountEmail, loadDriveConnection, STORAGE_AGREEMENT_VERSION, upsertDriveConnection } from '../../../server/_lib/google-drive.mjs';

const STATE_COOKIE = 'an_drive_oauth_state';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function sameSecret(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function redirectDriveResult(res, config, result) {
  const allowed = new Set(['connected', 'cancelled', 'error']);
  const target = new URL('/', config.appUrl);
  target.searchParams.set('drive', allowed.has(result) ? result : 'error');
  sendRedirect(res, target.href, 303, { 'Referrer-Policy': 'no-referrer' });
}

export default async function handler(req, res) {
  if (String(req.method || '').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const config = getRuntimeConfig();
  const url = new URL(req.url || '/', config.appUrl || 'https://localhost');
  const stateCookie = getCookie(req, STATE_COOKIE);
  const stateQuery = String(url.searchParams.get('state') || '');
  if (!config.googleDriveConfigured) {
    clearTransientCookie(req, res, STATE_COOKIE, config);
    return config.appUrl ? redirectDriveResult(res, config, 'error') : sendJson(res, 503, { error: 'drive_not_configured' });
  }
  if (url.searchParams.has('error')) {
    clearTransientCookie(req, res, STATE_COOKIE, config);
    return redirectDriveResult(res, config, url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'error');
  }
  if (!sameSecret(stateQuery, stateCookie)) {
    clearTransientCookie(req, res, STATE_COOKIE, config);
    return sendJson(res, 403, { error: 'oauth_state_invalid', message: 'The Google Drive connection could not be verified. Start again from Creator Studio.' });
  }

  try {
    const session = await requireVerifiedCreator(req, res, config, 'private Creator Drive storage');
    if (!session) {
      clearTransientCookie(req, res, STATE_COOKIE, config);
      return;
    }
    if (!(await consumeRateLimit(req, config, 'creator-drive-oauth-callback', 12, 60 * 60))) {
      clearTransientCookie(req, res, STATE_COOKIE, config);
      return redirectDriveResult(res, config, 'error');
    }
    const code = String(url.searchParams.get('code') || '');
    if (!code || code.length > 4096) {
      clearTransientCookie(req, res, STATE_COOKIE, config);
      return redirectDriveResult(res, config, 'error');
    }

    const form = new URLSearchParams({
      code,
      client_id: config.googleDriveClientId,
      client_secret: config.googleDriveClientSecret,
      redirect_uri: config.googleDriveRedirectUri,
      grant_type: 'authorization_code'
    });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(12_000)
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    const scopes = String(tokenPayload.scope || '').split(/\s+/);
    if (!tokenResponse.ok || typeof tokenPayload.access_token !== 'string' || !scopes.includes(DRIVE_FILE_SCOPE)) {
      clearTransientCookie(req, res, STATE_COOKIE, config);
      return redirectDriveResult(res, config, 'error');
    }

    const ownerId = String(session.user.id || '').toLowerCase();
    const googleEmail = await getGoogleAccountEmail(tokenPayload.access_token);
    const folderId = await ensureDriveVaultFolder(tokenPayload.access_token, ownerId);
    const prior = await loadDriveConnection(config, ownerId);
    let tokenCipher;
    if (typeof tokenPayload.refresh_token === 'string' && tokenPayload.refresh_token) {
      tokenCipher = encryptDriveRefreshToken(tokenPayload.refresh_token, config);
    } else if (prior && String(prior.google_email || '').toLowerCase() === googleEmail) {
      tokenCipher = {
        refresh_token_ciphertext: prior.refresh_token_ciphertext,
        refresh_token_iv: prior.refresh_token_iv,
        refresh_token_tag: prior.refresh_token_tag
      };
    } else {
      clearTransientCookie(req, res, STATE_COOKIE, config);
      return redirectDriveResult(res, config, 'error');
    }

    await upsertDriveConnection(config, {
      user_id: ownerId,
      google_email: googleEmail,
      vault_folder_id: folderId,
      ...tokenCipher,
      terms_version: STORAGE_AGREEMENT_VERSION,
      terms_accepted_at: new Date().toISOString(),
      connected_at: new Date().toISOString()
    });
    clearTransientCookie(req, res, STATE_COOKIE, config);
    redirectDriveResult(res, config, 'connected');
  } catch (error) {
    clearTransientCookie(req, res, STATE_COOKIE, config);
    if (error?.code === 'drive_reauthorization_required' || error?.code === 'drive_token_decryption_failed') clearSessionCookies(req, res, config);
    console.error('Creator Drive OAuth callback failed:', error?.message || 'unknown_error');
    return redirectDriveResult(res, config, 'error');
  }
}
