import { getRuntimeConfig, publicRuntimeConfig } from '../server/_lib/config.mjs';
import { methodOnly, sendJson } from '../server/_lib/http.mjs';

export default function handler(req, res) {
  if (!methodOnly(req, res, 'GET')) return;
  const config = getRuntimeConfig();
  sendJson(res, 200, { ok: true, service: 'art-nexus-api', ...publicRuntimeConfig(config) });
}
