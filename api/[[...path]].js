/**
 * CTIX API proxy for Vercel.
 * Forwards all requests to CTIX API with HMAC auth (AccessID, Expires, Signature).
 * Optional: set REQUIRE_ACCESS_ID=true to require access_id in query (must match CTIX_ACCESS_ID).
 *
 * Env: CTIX_API_URL, CTIX_ACCESS_ID, CTIX_SECRET_KEY [, REQUIRE_ACCESS_ID=true]
 * Usage: GET/POST/PUT/DELETE /api/<ctix-path> [ ?access_id=YOUR_ACCESS_ID if REQUIRE_ACCESS_ID ]
 */

const { buildCtixAuthParams } = require('../lib/auth');

// Logger: write to stderr so output appears in Vercel Runtime Logs (console.log often not shown)
const log = {
  info: (msg, data) => {
    const out = data != null ? `[CTIX proxy] ${msg} ${JSON.stringify(data)}` : `[CTIX proxy] ${msg}`;
    process.stderr.write(out + '\n');
  },
  error: (msg, data) => {
    const out = data != null ? `[CTIX proxy] ${msg} ${JSON.stringify(data)}` : `[CTIX proxy] ${msg}`;
    process.stderr.write(out + '\n');
  },
};

const CTIX_API_URL = process.env.CTIX_API_URL || '';
const CTIX_ACCESS_ID = process.env.CTIX_ACCESS_ID || '';
const CTIX_SECRET_KEY = process.env.CTIX_SECRET_KEY || '';
const CTIX_API_VERSION = process.env.CTIX_API_VERSION || 'v3';
const REQUIRE_ACCESS_ID = /^(1|true|yes)$/i.test(process.env.REQUIRE_ACCESS_ID || '');

// Headers we forward to CTIX (strip host and connection, add useful ones)
const FORWARD_HEADERS = [
  'content-type',
  'accept',
  'range',
  'accept-encoding',
];

function getTargetPath(pathSegments) {
  const segs = pathSegments == null ? [] : pathSegments;
  return Array.isArray(segs) ? segs.join('/') : '';
}

function buildTargetUrl(baseUrl, path, searchParams) {
  const base = baseUrl.replace(/\/$/, '');
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  const authParams = buildCtixAuthParams(CTIX_ACCESS_ID, CTIX_SECRET_KEY);
  const combined = new URLSearchParams(searchParams);
  if (!combined.has('version')) combined.set('version', CTIX_API_VERSION);
  Object.entries(authParams).forEach(([k, v]) => combined.set(k, v));
  const query = combined.toString();
  // Use WHATWG URL API (avoids url.parse() deprecation in Node)
  const url = new URL(pathPart + (query ? `?${query}` : ''), base);
  return url.href;
}

function getForwardHeaders(req) {
  const out = {};
  FORWARD_HEADERS.forEach((name) => {
    const v = req.headers[name];
    if (v) out[name] = v;
  });
  if (!out['content-type']) out['content-type'] = 'application/json';
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    return res.status(204).end();
  }

  if (!CTIX_API_URL || !CTIX_ACCESS_ID || !CTIX_SECRET_KEY) {
    log.error('Configuration error: CTIX_API_URL, CTIX_ACCESS_ID, or CTIX_SECRET_KEY is missing in environment.');
    return res.status(500).json({
      error: 'CTIX proxy not configured',
      message: 'Set CTIX_API_URL, CTIX_ACCESS_ID, and CTIX_SECRET_KEY in environment.',
    });
  }

  // Optional: require access_id in URL to verify the request (only when REQUIRE_ACCESS_ID is set)
  if (REQUIRE_ACCESS_ID) {
    const requestAccessId = req.query.access_id;
    if (!requestAccessId || requestAccessId !== CTIX_ACCESS_ID) {
      log.error('Unauthorized: missing or invalid access_id in query.', { path: req.url, hasAccessId: !!requestAccessId });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid access_id. Include access_id in the query string and ensure it matches the configured credential.',
      });
    }
  }

  const pathSegments = req.query.path || [];
  const path = getTargetPath(pathSegments).replace(/^\//, '').trim();

  if (!path) {
    log.error('Empty path: request must include a CTIX path after /api/.', { url: req.url });
    return res.status(400).json({
      error: 'Bad request',
      message: 'Missing path. Use /api/<ctix-path>, e.g. /api/ingestion/threat-data/list/',
    });
  }

  const searchParams = { ...req.query };
  delete searchParams.path;
  delete searchParams.access_id; // do not forward to CTIX

  const targetUrl = buildTargetUrl(CTIX_API_URL, path, searchParams);
  log.info('Sending request to:', { url: targetUrl });

  const headers = getForwardHeaders(req);

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body || undefined,
    });

    if (fetchRes.status >= 400) {
      log.error('Upstream error:', {
        method: req.method,
        path,
        status: fetchRes.status,
        statusText: fetchRes.statusText,
      });
    }

    const contentType = fetchRes.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await fetchRes.json()
      : await fetchRes.text();

    res.status(fetchRes.status);
    if (contentType) res.setHeader('Content-Type', contentType);
    if (fetchRes.headers.get('content-range'))
      res.setHeader('Content-Range', fetchRes.headers.get('content-range'));

    return res.send(data);
  } catch (err) {
    log.error('Proxy error:', {
      method: req.method,
      path,
      error: err.message,
      stack: err.stack,
    });
    return res.status(502).json({
      error: 'Proxy error',
      message: err.message,
    });
  }
}
