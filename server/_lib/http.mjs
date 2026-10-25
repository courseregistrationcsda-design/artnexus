export function sendJson(res, statusCode, body, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

export function sendRedirect(res, location, statusCode = 303, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end();
}

export function methodOnly(req, res, allowed) {
  const methods = Array.isArray(allowed) ? allowed : [allowed];
  if (methods.includes(String(req.method || '').toUpperCase())) return true;
  res.setHeader('Allow', methods.join(', '));
  sendJson(res, 405, { error: 'method_not_allowed' });
  return false;
}

export function readRawBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const add = chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        const error = new Error('request_too_large');
        error.statusCode = 413;
        fail(error);
        if (typeof req.destroy === 'function') req.destroy();
        return;
      }
      chunks.push(buffer);
    };
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      add(req.body);
      if (!settled) resolve(Buffer.concat(chunks));
      return;
    }
    if (req.body && typeof req.body === 'object') {
      const serialized = Buffer.from(JSON.stringify(req.body));
      add(serialized);
      if (!settled) resolve(Buffer.concat(chunks));
      return;
    }
    req.on('data', add);
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', fail);
    req.on('aborted', () => {
      const error = new Error('request_aborted');
      error.statusCode = 400;
      fail(error);
    });
  });
}

export async function readJsonBody(req, maxBytes = 64 * 1024) {
  const raw = await readRawBody(req, maxBytes);
  if (!raw.length) return {};
  try {
    const value = JSON.parse(raw.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_json_object');
    return value;
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

export function requestHasSameOrigin(req, appUrl) {
  const originHeader = req.headers?.origin;
  if (typeof originHeader !== 'string' || !originHeader) return false;
  try {
    return new URL(originHeader).origin === appUrl;
  } catch {
    return false;
  }
}

export function requireSameOrigin(req, res, appUrl) {
  if (requestHasSameOrigin(req, appUrl)) return true;
  sendJson(res, 403, { error: 'origin_not_allowed' });
  return false;
}

export function getCookie(req, name) {
  const raw = req.headers?.cookie;
  if (typeof raw !== 'string') return '';
  for (const entry of raw.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    const key = entry.slice(0, separator).trim();
    if (key !== name) continue;
    const value = entry.slice(separator + 1).trim();
    try { return decodeURIComponent(value); } catch { return ''; }
  }
  return '';
}

function cookieSecure(req, config) {
  if (config?.isProduction) return true;
  const forwarded = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwarded === 'https' || String(req.socket?.encrypted || '') === 'true';
}

export function setSessionCookies(req, res, session, config) {
  const secure = cookieSecure(req, config);
  const accessSeconds = Math.min(60 * 60, Math.max(60, Number(session.expires_in) || 3600));
  const refreshSeconds = Math.min(60 * 60 * 24 * 30, Math.max(60 * 60, Number(session.refresh_expires_in) || 60 * 60 * 24 * 30));
  const base = `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  appendSetCookie(res, [
    `an_access=${encodeURIComponent(session.access_token)}; Max-Age=${accessSeconds}; ${base}`,
    `an_refresh=${encodeURIComponent(session.refresh_token)}; Max-Age=${refreshSeconds}; ${base}`
  ]);
}

export function clearSessionCookies(req, res, config) {
  const secure = cookieSecure(req, config);
  const base = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`;
  appendSetCookie(res, [`an_access=; ${base}`, `an_refresh=; ${base}`]);
}

export function setTransientCookie(req, res, name, value, config, maxAgeSeconds = 600) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(name || '')) || typeof value !== 'string' || value.length > 2048) return;
  const secure = cookieSecure(req, config);
  const maxAge = Math.max(0, Math.min(1800, Math.trunc(Number(maxAgeSeconds) || 0)));
  const attributes = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  appendSetCookie(res, [`${name}=${encodeURIComponent(value)}; ${attributes}`]);
}

export function clearTransientCookie(req, res, name, config) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(name || ''))) return;
  const secure = cookieSecure(req, config);
  const attributes = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`;
  appendSetCookie(res, [`${name}=; ${attributes}`]);
}

function appendSetCookie(res, values) {
  const existing = res.getHeader('Set-Cookie');
  const combined = existing ? (Array.isArray(existing) ? existing : [existing]).concat(values) : values;
  res.setHeader('Set-Cookie', combined);
}

export function getClientAddress(req) {
  const vercel = String(req.headers?.['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return vercel || forwarded || String(req.socket?.remoteAddress || 'unknown').slice(0, 120);
}

export function normalizedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return '';
  return email;
}

export function cleanText(value, maxLength) {
  return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function safeErrorStatus(error, fallback = 500) {
  const value = Number(error?.statusCode);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : fallback;
}
