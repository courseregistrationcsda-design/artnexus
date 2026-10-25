import { createHmac } from 'node:crypto';
import { getClientAddress } from './http.mjs';
import { supabaseServiceRequest } from './supabase.mjs';

export async function consumeRateLimit(req, config, scope, limit, windowSeconds) {
  const address = getClientAddress(req).slice(0, 160);
  const keyHash = createHmac('sha256', config.rateLimitSecret)
    .update(`${scope}:${address}`)
    .digest('hex');
  const result = await supabaseServiceRequest(config, '/rest/v1/rpc/consume_api_rate_limit', {
    method: 'POST',
    body: {
      p_key_hash: keyHash,
      p_max_requests: limit,
      p_window_seconds: windowSeconds
    }
  });
  if (!result.response.ok) throw new Error('rate_limit_service_unavailable');
  const value = Array.isArray(result.payload) ? result.payload[0] : result.payload;
  return value === true || value?.allowed === true;
}
