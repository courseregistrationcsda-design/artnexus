import { getRuntimeConfig } from '../../server/_lib/config.mjs';
import { cleanText, methodOnly, normalizedEmail, readJsonBody, requireSameOrigin, safeErrorStatus, sendJson } from '../../server/_lib/http.mjs';
import { consumeRateLimit } from '../../server/_lib/rate-limit.mjs';
import { supabaseAuthRequest } from '../../server/_lib/supabase.mjs';

export default async function handler(req, res) {
  if (!methodOnly(req, res, 'POST')) return;
  const config = getRuntimeConfig();
  if (!config.authConfigured) return sendJson(res, 503, { error: 'auth_not_configured', message: 'Secure sign-in is not configured on this deployment.' });
  if (!requireSameOrigin(req, res, config.appUrl)) return;

  let body;
  try { body = await readJsonBody(req, 16 * 1024); }
  catch (error) { return sendJson(res, safeErrorStatus(error, 400), { error: 'invalid_request' }); }
  const email = normalizedEmail(body.email);
  const intent = body.intent === 'signup' ? 'signup' : body.intent === 'signin' ? 'signin' : '';
  const displayName = cleanText(body.displayName, 80);
  if (!email || !intent || (intent === 'signup' && !displayName)) return sendJson(res, 400, { error: 'invalid_request' });

  try {
    const allowed = await consumeRateLimit(req, config, 'auth-start', 8, 15 * 60);
    if (!allowed) return sendJson(res, 429, { error: 'rate_limited', message: 'Please wait before requesting another sign-in email.' });

    const callbackUrl = `${config.appUrl}/api/auth/callback`;
    const response = await supabaseAuthRequest(config, `/otp?redirect_to=${encodeURIComponent(callbackUrl)}`, {
      method: 'POST',
      body: {
        email,
        create_user: intent === 'signup',
        data: intent === 'signup' ? { display_name: displayName } : {}
      }
    });
    if (!response.response.ok) {
      // Deliberately generic so the endpoint does not disclose whether an address has an account.
      console.warn('Supabase OTP request rejected; provider detail omitted.');
      return sendJson(res, 200, { ok: true, message: 'If that address can receive a sign-in link, check its inbox and spam folder.' });
    }
    return sendJson(res, 200, { ok: true, message: 'If that address can receive a sign-in link, check its inbox and spam folder.' });
  } catch (error) {
    console.error('Auth start failed:', error?.message || 'unknown_error');
    return sendJson(res, safeErrorStatus(error, 503), { error: 'auth_temporarily_unavailable', message: 'Secure sign-in is temporarily unavailable. Please try again later.' });
  }
}
