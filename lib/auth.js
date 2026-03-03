const crypto = require('crypto');

/**
 * CTIX HMAC auth (matches Python pattern in cloud_run_ctix_function):
 *   to_sign = AccessID + "\n" + Expires (unix timestamp)
 *   Signature = Base64(HMAC-SHA1(secret_key, to_sign))
 * Pass AccessID, Expires, Signature as query params on each request.
 */

/**
 * Compute HMAC-SHA1 signature for given expires (for testing or custom expiry).
 * @param {string} accessId
 * @param {string} secretKey
 * @param {number} expires - Unix timestamp
 * @returns {string} Base64-encoded signature
 */
function computeSignature(accessId, secretKey, expires) {
  const toSign = `${accessId}\n${expires}`;
  return crypto
    .createHmac('sha1', secretKey)
    .update(toSign, 'utf8')
    .digest('base64');
}

/**
 * Build auth query params for CTIX API (AccessID, Expires, Signature).
 * Uses current time + 20s for Expires to match Python client.
 */
function buildCtixAuthParams(accessId, secretKey) {
  const expires = Math.floor(Date.now() / 1000) + 20;
  const signature = computeSignature(accessId, secretKey, expires);
  return {
    AccessID: accessId,
    Expires: String(expires),
    Signature: signature,
  };
}

module.exports = { buildCtixAuthParams, computeSignature };
