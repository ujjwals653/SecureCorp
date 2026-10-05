/**
 * Builders for the cross-module JSON contracts:
 *   - Encrypted file envelope   (PROJECT_CONTEXT.md §7.1)
 *   - Public key registration   (PROJECT_CONTEXT.md §7.3)
 *
 * SIGNED PAYLOAD RULE (must match anyone who verifies, incl. Backend):
 *   signed_bytes = base64decode(ciphertext) || base64decode(iv)
 */
import { AES_GCM_IV_LENGTH, ALGORITHMS, RSA_OAEP_KEYGEN } from './constants.js';
import { decryptFile, encryptFile, unwrapKey, wrapKey } from './cipher.js';
import { base64ToBytes, bytesOrBase64, concatBytes } from './encoding.js';
import { CryptoCoreError, ErrorCodes } from './errors.js';
import { assertCryptoKey, assertNonEmptyString } from './guards.js';
import { exportPublicKeyAsBase64, generateFileKey } from './keys.js';
import { sign, verify } from './signature.js';
import { randomUUID } from './webcrypto.js';

/** §7.1 field order — produced envelopes have exactly these keys. */
export const ENVELOPE_FIELDS = Object.freeze([
  'file_id',
  'sender_id',
  'recipient_id',
  'ciphertext',
  'iv',
  'wrapped_key',
  'signature',
  'filename',
  'timestamp',
]);

/** §7.3 field order. */
export const PUBLIC_KEY_REGISTRATION_FIELDS = Object.freeze([
  'user_id',
  'public_key',
  'algorithm',
  'cert',
]);

/**
 * Bytes covered by the envelope signature: ciphertext || iv (raw bytes).
 * @param {string|ArrayBufferView} ciphertext  base64 or bytes
 * @param {string|ArrayBufferView} iv          base64 or bytes
 * @returns {Uint8Array}
 */
export function buildSignaturePayload(ciphertext, iv) {
  return concatBytes(bytesOrBase64(ciphertext, 'ciphertext'), bytesOrBase64(iv, 'iv'));
}

/**
 * Alice's side: encrypt + wrap + sign → §7.1 envelope.
 * The AES file key is created and consumed inside this function only.
 *
 * @param {object} p
 * @param {ArrayBuffer|ArrayBufferView|Blob} p.fileBytes
 * @param {string} p.filename
 * @param {string} p.senderId
 * @param {string} p.recipientId
 * @param {CryptoKey} p.recipientPublicKey   recipient's RSA-OAEP public key
 * @param {CryptoKey} p.signingPrivateKey    sender's RSA-PSS private key
 * @param {string} [p.fileId]                defaults to a random UUID v4
 * @param {string} [p.timestamp]             defaults to now (ISO-8601)
 * @returns {Promise<Record<typeof ENVELOPE_FIELDS[number], string>>}
 */
export async function createEncryptedEnvelope({
  fileBytes,
  filename,
  senderId,
  recipientId,
  recipientPublicKey,
  signingPrivateKey,
  fileId = randomUUID(),
  timestamp = new Date().toISOString(),
}) {
  assertNonEmptyString(filename, 'filename');
  assertNonEmptyString(senderId, 'senderId');
  assertNonEmptyString(recipientId, 'recipientId');

  const aesKey = await generateFileKey();
  const { ciphertext, iv } = await encryptFile(fileBytes, aesKey);
  const wrapped_key = await wrapKey(aesKey, recipientPublicKey);
  const signature = await sign(buildSignaturePayload(ciphertext, iv), signingPrivateKey);

  return {
    file_id: fileId,
    sender_id: senderId,
    recipient_id: recipientId,
    ciphertext,
    iv,
    wrapped_key,
    signature,
    filename,
    timestamp,
  };
}

/**
 * Structural validation of a §7.1 envelope. Extra fields are ignored
 * (Backend may add metadata); the 9 contract fields are required.
 * @throws {CryptoCoreError} INVALID_ENVELOPE
 */
export function validateEnvelope(envelope) {
  const fail = (msg) => {
    throw new CryptoCoreError(ErrorCodes.INVALID_ENVELOPE, msg);
  };
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    fail('Envelope must be a JSON object.');
  }
  for (const field of ENVELOPE_FIELDS) {
    if (typeof envelope[field] !== 'string' || envelope[field].length === 0) {
      fail(`Envelope field "${field}" is missing or not a non-empty string.`);
    }
  }
  for (const field of ['ciphertext', 'iv', 'wrapped_key', 'signature']) {
    try {
      const bytes = base64ToBytes(envelope[field], field);
      if (field === 'iv' && bytes.length !== AES_GCM_IV_LENGTH) {
        fail(`Envelope iv must decode to ${AES_GCM_IV_LENGTH} bytes, got ${bytes.length}.`);
      }
    } catch (err) {
      if (err instanceof CryptoCoreError && err.code === ErrorCodes.INVALID_ENVELOPE) throw err;
      fail(`Envelope field "${field}" is not valid base64.`);
    }
  }
  if (Number.isNaN(Date.parse(envelope.timestamp))) {
    fail('Envelope timestamp is not a valid ISO-8601 date.');
  }
  return true;
}

/**
 * Bob's side: validate → verify signature → unwrap → decrypt.
 * The signature is checked BEFORE any key is used, so tampered envelopes
 * are rejected without touching the private key.
 *
 * @param {object} envelope                  §7.1 envelope
 * @param {object} keys
 * @param {CryptoKey} keys.recipientPrivateKey      my RSA-OAEP private key
 * @param {CryptoKey} keys.senderSigningPublicKey   sender's RSA-PSS public key
 * @returns {Promise<{ fileBytes: Uint8Array, filename: string, fileId: string,
 *   senderId: string, recipientId: string, timestamp: string, signatureValid: true }>}
 */
export async function openEncryptedEnvelope(envelope, { recipientPrivateKey, senderSigningPublicKey }) {
  validateEnvelope(envelope);

  const payload = buildSignaturePayload(envelope.ciphertext, envelope.iv);
  const signatureValid = await verify(payload, envelope.signature, senderSigningPublicKey);
  if (!signatureValid) {
    throw new CryptoCoreError(
      ErrorCodes.SIGNATURE_INVALID,
      `Signature check failed: the envelope was not signed by "${envelope.sender_id}"'s key or was modified in transit.`,
    );
  }

  const aesKey = await unwrapKey(envelope.wrapped_key, recipientPrivateKey);
  const fileBytes = await decryptFile(envelope.ciphertext, envelope.iv, aesKey);

  return {
    fileBytes,
    filename: envelope.filename,
    fileId: envelope.file_id,
    senderId: envelope.sender_id,
    recipientId: envelope.recipient_id,
    timestamp: envelope.timestamp,
    signatureValid: true,
  };
}

/**
 * §7.3 public key registration payload (for POST /api/keys/register).
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {CryptoKey} p.publicKey   RSA-OAEP-2048 public key
 * @param {string|null} [p.cert]    base64 X.509 from mini-CA, null until PKI is integrated
 * @returns {Promise<{ user_id: string, public_key: string, algorithm: string, cert: string|null }>}
 */
export async function createPublicKeyRegistration({ userId, publicKey, cert = null }) {
  assertNonEmptyString(userId, 'userId');
  assertCryptoKey(publicKey, { label: 'publicKey', type: 'public', algorithm: 'RSA-OAEP' });
  if (publicKey.algorithm.modulusLength !== RSA_OAEP_KEYGEN.modulusLength) {
    throw new CryptoCoreError(
      ErrorCodes.INVALID_KEY,
      `publicKey must be RSA-OAEP-${RSA_OAEP_KEYGEN.modulusLength}.`,
    );
  }
  return {
    user_id: userId,
    public_key: await exportPublicKeyAsBase64(publicKey),
    algorithm: ALGORITHMS.keyWrapping,
    cert,
  };
}
