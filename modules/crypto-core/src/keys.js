/**
 * Key generation, export and import.
 *
 * Private keys are generated NON-extractable by default: JavaScript can use
 * them but can never read their bytes, so they cannot leave the browser.
 * (Non-extractable CryptoKeys can still be persisted in IndexedDB via
 * structured clone if the team decides on a persistence strategy.)
 */
import {
  AES_GCM_KEYGEN,
  MIN_RSA_MODULUS_BITS,
  RSA_OAEP_IMPORT,
  RSA_OAEP_KEYGEN,
  RSA_PSS_IMPORT,
  RSA_PSS_KEYGEN,
} from './constants.js';
import { bytesToBase64, base64ToBytes, bytesToHex } from './encoding.js';
import { CryptoCoreError, ErrorCodes } from './errors.js';
import { assertCryptoKey } from './guards.js';
import { getSubtle } from './webcrypto.js';

/**
 * RSA-OAEP-2048 keypair for key wrapping.
 * @param {{ extractablePrivateKey?: boolean }} [options]
 * @returns {Promise<{ publicKey: CryptoKey, privateKey: CryptoKey }>}
 */
export async function generateKeyPair({ extractablePrivateKey = false } = {}) {
  const { publicKey, privateKey } = await getSubtle().generateKey(
    RSA_OAEP_KEYGEN,
    extractablePrivateKey,
    ['wrapKey', 'unwrapKey'],
  );
  return { publicKey, privateKey };
}

/**
 * RSA-PSS-2048 (SHA-256) keypair for signing.
 * @param {{ extractablePrivateKey?: boolean }} [options]
 * @returns {Promise<{ publicKey: CryptoKey, privateKey: CryptoKey }>}
 */
export async function generateSigningKeyPair({ extractablePrivateKey = false } = {}) {
  const { publicKey, privateKey } = await getSubtle().generateKey(
    RSA_PSS_KEYGEN,
    extractablePrivateKey,
    ['sign', 'verify'],
  );
  return { publicKey, privateKey };
}

/**
 * Fresh AES-256-GCM key for ONE file. Extractable only because
 * `wrapKey('raw', ...)` requires it; it never leaves crypto-core unwrapped.
 * @returns {Promise<CryptoKey>}
 */
export async function generateFileKey() {
  return getSubtle().generateKey(AES_GCM_KEYGEN, true, ['encrypt', 'decrypt']);
}

/**
 * Export any public key (RSA-OAEP or RSA-PSS) as base64 SPKI (DER).
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>}
 */
export async function exportPublicKeyAsBase64(publicKey) {
  assertCryptoKey(publicKey, { label: 'publicKey', type: 'public' });
  const spki = await getSubtle().exportKey('spki', publicKey);
  return bytesToBase64(new Uint8Array(spki));
}

async function importSpki(base64, algorithm, usages, label) {
  const der = base64ToBytes(base64, label);
  let key;
  try {
    key = await getSubtle().importKey('spki', der, algorithm, true, usages);
  } catch (cause) {
    throw new CryptoCoreError(
      ErrorCodes.INVALID_KEY,
      `${label} is not a valid ${algorithm.name} SPKI public key.`,
      { cause },
    );
  }
  if (key.algorithm.modulusLength < MIN_RSA_MODULUS_BITS) {
    throw new CryptoCoreError(
      ErrorCodes.INVALID_KEY,
      `${label} is ${key.algorithm.modulusLength}-bit; minimum is ${MIN_RSA_MODULUS_BITS}.`,
    );
  }
  return key;
}

/**
 * Import a recipient's RSA-OAEP public key (e.g. from GET /api/keys/<user_id>).
 * @param {string} base64Spki
 * @returns {Promise<CryptoKey>}
 */
export function importEncryptionPublicKey(base64Spki) {
  return importSpki(base64Spki, RSA_OAEP_IMPORT, ['wrapKey'], 'encryption public key');
}

/**
 * Import a sender's RSA-PSS public key for signature verification.
 * @param {string} base64Spki
 * @returns {Promise<CryptoKey>}
 */
export function importSigningPublicKey(base64Spki) {
  return importSpki(base64Spki, RSA_PSS_IMPORT, ['verify'], 'signing public key');
}

/**
 * SHA-256 fingerprint of a public key's SPKI encoding (lowercase hex).
 * Useful for showing users "which key is this" without exposing the key.
 * @param {CryptoKey} publicKey
 * @returns {Promise<string>}
 */
export async function getPublicKeyFingerprint(publicKey) {
  assertCryptoKey(publicKey, { label: 'publicKey', type: 'public' });
  const spki = await getSubtle().exportKey('spki', publicKey);
  const digest = await getSubtle().digest('SHA-256', spki);
  return bytesToHex(new Uint8Array(digest));
}
