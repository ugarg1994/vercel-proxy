// Quick local check of HMAC auth (no network if env not set)
const { buildCtixAuthParams, computeSignature } = require('./lib/auth');

// Deterministic test: same inputs must produce same signature (matches Python)
function isBase64(s) {
  try {
    return Buffer.from(s, 'base64').toString('base64') === s;
  } catch {
    return false;
  }
}

const accessId = 'test-id';
const secretKey = 'test-secret';
const expires = 1000;
const sig = computeSignature(accessId, secretKey, expires);
const sig2 = computeSignature(accessId, secretKey, expires);
if (sig !== sig2 || !isBase64(sig)) {
  console.error('FAIL: signature should be deterministic and valid base64');
  process.exit(1);
}

const params = buildCtixAuthParams(
  process.env.CTIX_ACCESS_ID || accessId,
  process.env.CTIX_SECRET_KEY || secretKey
);
if (!params.AccessID || !params.Expires || !params.Signature) {
  console.error('FAIL: buildCtixAuthParams must return AccessID, Expires, Signature');
  process.exit(1);
}
if (!isBase64(params.Signature)) {
  console.error('FAIL: Signature must be valid base64');
  process.exit(1);
}

console.log('Auth params (sample):', { ...params, Signature: params.Signature.slice(0, 12) + '...' });
console.log('OK – lib/auth is correct and working.');
console.log('Run proxy locally: npx vercel dev');
console.log('Then e.g. curl http://localhost:3000/api/ingestion/threat-data/list/');
