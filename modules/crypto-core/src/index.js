/**
 * @securecorp/crypto-core — public API.
 *
 * Client-side cryptography for SecureCorp, built only on the Web Crypto API.
 * Frontend should import exclusively from this file.
 *
 *   Key wrapping : RSA-OAEP-2048 / SHA-256
 *   Signing      : RSA-PSS-2048 / SHA-256, salt 32
 *   File cipher  : AES-256-GCM, random 96-bit IV, 128-bit tag
 */

// Interface required by AGENT.md
export {
  generateKeyPair,
  generateSigningKeyPair,
  exportPublicKeyAsBase64,
} from './keys.js';
export { encryptFile, decryptFile, wrapKey, unwrapKey } from './cipher.js';
export { sign, verify } from './signature.js';

// Additional helpers Frontend will need
export {
  generateFileKey,
  importEncryptionPublicKey,
  importSigningPublicKey,
  getPublicKeyFingerprint,
} from './keys.js';
export {
  createEncryptedEnvelope,
  openEncryptedEnvelope,
  validateEnvelope,
  buildSignaturePayload,
  createPublicKeyRegistration,
  ENVELOPE_FIELDS,
  PUBLIC_KEY_REGISTRATION_FIELDS,
} from './envelope.js';
export { bytesToBase64, base64ToBytes, utf8Encode, utf8Decode } from './encoding.js';
export { isWebCryptoAvailable } from './webcrypto.js';
export { CryptoCoreError, ErrorCodes } from './errors.js';
export { ALGORITHMS } from './constants.js';

export const CRYPTO_CORE_VERSION = '0.1.0';
