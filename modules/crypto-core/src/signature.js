/**
 * RSA-PSS (SHA-256, 32-byte salt) signing and verification.
 */
import { RSA_PSS_SALT_LENGTH } from './constants.js';
import { bytesOrBase64, bytesToBase64, toBytes, utf8Encode } from './encoding.js';
import { assertCryptoKey } from './guards.js';
import { getSubtle } from './webcrypto.js';

const PSS = Object.freeze({ name: 'RSA-PSS', saltLength: RSA_PSS_SALT_LENGTH });

/** Strings are signed as their UTF-8 bytes (NOT base64-decoded). */
function dataToBytes(data) {
  return typeof data === 'string' ? utf8Encode(data) : toBytes(data, 'data');
}

/**
 * @param {string|ArrayBuffer|ArrayBufferView} data
 * @param {CryptoKey} signingPrivateKey  RSA-PSS private key
 * @returns {Promise<string>} base64 signature (256 bytes for RSA-2048)
 */
export async function sign(data, signingPrivateKey) {
  assertCryptoKey(signingPrivateKey, {
    label: 'signingPrivateKey',
    type: 'private',
    algorithm: 'RSA-PSS',
    usage: 'sign',
  });
  const sig = await getSubtle().sign(PSS, signingPrivateKey, dataToBytes(data));
  return bytesToBase64(new Uint8Array(sig));
}

/**
 * Returns false (never throws) for a bad, tampered or malformed signature.
 * Throws only for programming errors (e.g. passing the wrong key type).
 *
 * @param {string|ArrayBuffer|ArrayBufferView} data
 * @param {string|ArrayBuffer|ArrayBufferView} signature  base64 or bytes
 * @param {CryptoKey} signingPublicKey  RSA-PSS public key
 * @returns {Promise<boolean>}
 */
export async function verify(data, signature, signingPublicKey) {
  assertCryptoKey(signingPublicKey, {
    label: 'signingPublicKey',
    type: 'public',
    algorithm: 'RSA-PSS',
    usage: 'verify',
  });
  let sigBytes;
  try {
    sigBytes = bytesOrBase64(signature, 'signature');
  } catch {
    return false;
  }
  try {
    return await getSubtle().verify(PSS, signingPublicKey, sigBytes, dataToBytes(data));
  } catch {
    return false;
  }
}
