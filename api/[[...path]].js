/**
 * CTIX API proxy for Vercel.
 * Forwards all requests to CTIX API with HMAC auth (AccessID, Expires, Signature).
 *
 * Env: CTIX_API_URL, CTIX_ACCESS_ID, CTIX_SECRET_KEY
 * Usage: GET/POST/PUT/DELETE /api/<ctix-path> e.g. /api/ingestion/threat-data/list/
 */

const { buildCtixAuthParams } = require('../lib/auth');

const CTIX_API_URL = process.env.CTIX_API_URL || '';
const CTIX_ACCESS_ID = process.env.CTIX_ACCESS_ID || '';
const CTIX_SECRET_KEY = process.env.CTIX_SECRET_KEY || '';
const CTIX_API_VERSION = process.env.CTIX_API_VERSION || 'v3';

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
  return query ? `${base}${pathPart}?${query}` : `${base}${pathPart}`;
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
    return res.status(500).json({
      error: 'CTIX proxy not configured',
      message: 'Set CTIX_API_URL, CTIX_ACCESS_ID, and CTIX_SECRET_KEY in environment.',
    });
  }

  const pathSegments = req.query.path || [];
  const path = getTargetPath(pathSegments);
  const searchParams = { ...req.query };
  delete searchParams.path;

  const targetUrl = buildTargetUrl(CTIX_API_URL, path, searchParams);
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
    console.error('CTIX proxy error:', err.message);
    return res.status(502).json({
      error: 'Proxy error',
      message: err.message,
    });
  }
}
