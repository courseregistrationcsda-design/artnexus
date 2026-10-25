import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { methodOnly, normalizedEmail, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson, setSessionCookies } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { supabaseAuthRequest, verifiedSupabaseUser } from '../../server/_lib/supabase.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured', message: 'Secure account updates are not configured on this deployment.' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;

  let body;
  try { body = await readJsonBody(req, 8 * 1024); }
  catch (error) { return sendJson(res, safeErrorStatus(error, 400), { error: 'invalid_request', message: 'Enter a valid new email address.' }); }
  const email = normalizedEmail(body.email);
  if (!email) return sendJson(res, 400, { error: 'invalid_email', message: 'Enter a valid new email address.' });

  try {
    const session = await verifiedSupabaseUser(req, res, config);
    if (!session) return sendJson(res, 401, { error: 'authentication_required', message: 'Sign in again before changing your account email.' });
    if (!(session.user.email_confirmed_at || session.user.confirmed_at)) {
      return sendJson(res, 403, { error: 'email_verification_required', message: 'Verify your current account email before requesting an email change.' });
    }
    if (normalizedEmail(session.user.email) === email) {
      return sendJson(res, 409, { error: 'email_unchanged', message: 'That is already the current account email.' });
    }
    if (!(await consumeRateLimit(req, config, 'auth-email-change', 5, 60 * 60))) {
      return sendJson(res, 429, { error: 'rate_limited', message: 'Too many email-change requests. Try again later.' });
    }

    const callbackUrl = `${config.appUrl}/api/auth/callback`;
    const result = await supabaseAuthRequest(config, `/user?redirect_to=${encodeURIComponent(callbackUrl)}`, {
      method: 'PUT',
      accessToken: session.accessToken,
      body: { email }
    });
    if (!result.response.ok) {
      if (result.response.status === 401) return sendJson(res, 401, { error: 'authentication_required', message: 'Your secure session expired. Sign in again and retry.' });
      if (result.response.status === 429) return sendJson(res, 429, { error: 'rate_limited', message: 'Too many email-change requests. Try again later.' });
      if ([400, 422, 409].includes(result.response.status)) return sendJson(res, 400, { error: 'email_change_rejected', message: 'Supabase Auth could not start this email change. Check the address and retry.' });
      throw new Error('auth_email_change_unavailable');
    }

    const user = result.payload?.user && typeof result.payload.user === 'object' ? result.payload.user : result.payload;
    if (result.payload?.access_token && result.payload?.refresh_token) setSessionCookies(req, res, result.payload, config);
    const providerEmail = normalizedEmail(user?.email);
    const confirmedImmediately = providerEmail === email && !!(user?.email_confirmed_at || user?.confirmed_at);
    const message = confirmedImmediately
      ? 'Supabase Auth reports this email change is confirmed. Refresh your account session to use the updated address.'
      : 'Supabase Auth has started the email change. Follow the confirmation instructions sent by Supabase; your current sign-in email remains active until confirmation completes.';
    return sendJson(res, 200, {
      ok: true,
      email: confirmedImmediately ? providerEmail : normalizedEmail(session.user.email),
      requestedEmail: email,
      emailChangePending: !confirmedImmediately,
      emailVerified: confirmedImmediately,
      message
    });
  } catch (error) {
    console.error('Auth email change failed:', error?.message || 'unknown_error');
    return sendJson(res, safeErrorStatus(error, 503), { error: 'email_change_unavailable', message: 'The secure email change could not be completed. Your current account email is unchanged; retry later.' });
  }
}
