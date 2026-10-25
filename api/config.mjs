import { getRuntimeConfig, publicRuntimeConfig } from '../server/_lib/config.mjs';
import { methodOnly, sendJson } from '../server/_lib/http.mjs';

export default function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  if (config.localCommunityMode) {
    return sendJson(res, 403, { error: 'local_community_mode', message: 'External provider routes are disabled in local community mode.' });
  }
  sendJson(res, 200, publicRuntimeConfig(config));
}
