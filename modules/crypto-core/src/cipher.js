/**
 * AES-GCM file encryption and RSA-OAEP key wrapping.
 */
import { AES_GCM_IV_LENGTH, AES_GCM_TAG_LENGTH } from './constants.js';
import { bytesOrBase64, bytesToBase64, readBytes } from './encoding.js';
import { CryptoCoreError, ErrorCodes } from './errors.js';
import { assertCryptoKey } from './guards.js';
import { getSubtle, randomBytes } from './webcrypto.js';

const GCM_TAG_BYTES = AES_GCM_TAG_LENGTH / 8;

/**
 * Encrypt file bytes with AES-GCM. A fresh random 96-bit IV is generated
 * on every call — an IV is never reused with the same key.
 *
 * @param {ArrayBuffer|ArrayBufferView|Blob} fileBytes
 * @param {CryptoKey} aesKey  from generateFileKey()
 * @returns {Promise<{ ciphertext: string, iv: string }>} both base64
 */
export async function encryptFile(fileBytes, aesKey) {
  assertCryptoKey(aesKey, { label: 'aesKey', type: 'secret', algorithm: 'AES-GCM', usage: 'encrypt' });
  const plaintext = await readBytes(fileBytes, 'fileBytes');
  const iv = randomBytes(AES_GCM_IV_LENGTH);
  const ct = await getSubtle().encrypt(
    { name: 'AES-GCM', iv, tagLength: AES_GCM_TAG_LENGTH },
    aesKey,
    plaintext,
  );
  return { ciphertext: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

/**
 * Decrypt AES-GCM ciphertext. Fails (DECRYPTION_FAILED) if the key is wrong
 * or if ciphertext/iv were modified — GCM's auth tag detects tampering.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} ciphertext  base64 or bytes
 * @param {string|ArrayBuffer|ArrayBufferView} iv          base64 or bytes
 * @param {CryptoKey} aesKey
 * @returns {Promise<Uint8Array>} original file bytes
 */
export async function decryptFile(ciphertext, iv, aesKey) {
  assertCryptoKey(aesKey, { label: 'aesKey', type: 'secret', algorithm: 'AES-GCM', usage: 'decrypt' });
  const ivBytes = bytesOrBase64(iv, 'iv');
  if (ivBytes.length !== AES_GCM_IV_LENGTH) {
    throw new CryptoCoreError(
      ErrorCodes.INVALID_INPUT,
      `iv must be ${AES_GCM_IV_LENGTH} bytes, got ${ivBytes.length}.`,
    );
  }
  const ctBytes = bytesOrBase64(ciphertext, 'ciphertext');
  if (ctBytes.length < GCM_TAG_BYTES) {
    throw new CryptoCoreError(ErrorCodes.INVALID_INPUT, 'ciphertext is too short to contain a GCM tag.');
  }
  try {
    const pt = await getSubtle().decrypt(
      { name: 'AES-GCM', iv: ivBytes, tagLength: AES_GCM_TAG_LENGTH },
      aesKey,
      ctBytes,
    );
    return new Uint8Array(pt);
  } catch (cause) {
    throw new CryptoCoreError(
      ErrorCodes.DECRYPTION_FAILED,
      'AES-GCM authentication failed: wrong key, or the ciphertext/iv was tampered with.',
      { cause },
    );
  }
}

/**
 * Wrap (encrypt) an AES key with the recipient's RSA-OAEP public key.
 *
 * @param {CryptoKey} aesKey               extractable AES-GCM key
 * @param {CryptoKey} recipientPublicKey   RSA-OAEP public key
 * @returns {Promise<string>} base64 wrapped key (256 bytes for RSA-2048)
 */
export async function wrapKey(aesKey, recipientPublicKey) {
  assertCryptoKey(aesKey, { label: 'aesKey', type: 'secret', algorithm: 'AES-GCM' });
  if (!aesKey.extractable) {
    throw new CryptoCoreError(
      ErrorCodes.INVALID_KEY,
      'aesKey must be extractable to be wrapped — create it with generateFileKey().',
    );
  }
  assertCryptoKey(recipientPublicKey, {
    label: 'recipientPublicKey',
    type: 'public',
    algorithm: 'RSA-OAEP',
    usage: 'wrapKey',
  });
  const wrapped = await getSubtle().wrapKey('raw', aesKey, recipientPublicKey, { name: 'RSA-OAEP' });
  return bytesToBase64(new Uint8Array(wrapped));
}

/**
 * Unwrap an AES key with my RSA-OAEP private key. Fails (UNWRAP_FAILED) if
 * the key was wrapped for someone else — this is the Act 6 "Eve has no
 * usable wrapped key" defense.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} wrappedKey  base64 or bytes
 * @param {CryptoKey} myPrivateKey                         RSA-OAEP private key
 * @param {{ extractable?: boolean }} [options]
 * @returns {Promise<CryptoKey>} AES-GCM key (non-extractable, decrypt-only by default)
 */
export async function unwrapKey(wrappedKey, myPrivateKey, { extractable = false } = {}) {
  assertCryptoKey(myPrivateKey, {
    label: 'myPrivateKey',
    type: 'private',
    algorithm: 'RSA-OAEP',
    usage: 'unwrapKey',
  });
  const wrappedBytes = bytesOrBase64(wrappedKey, 'wrappedKey');
  try {
    return await getSubtle().unwrapKey(
      'raw',
      wrappedBytes,
      myPrivateKey,
      { name: 'RSA-OAEP' },
      { name: 'AES-GCM' },
      extractable,
      ['decrypt'],
    );
  } catch (cause) {
    throw new CryptoCoreError(
      ErrorCodes.UNWRAP_FAILED,
      'Could not unwrap the file key: it was not wrapped for this private key, or it is corrupted.',
      { cause },
    );
  }
}
