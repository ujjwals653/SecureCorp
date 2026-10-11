/**
 * Thin access layer over the Web Crypto API (globalThis.crypto).
 * Works identically in browsers (secure contexts) and Node >= 20,
 * which ships the same W3C Web Crypto implementation — no Node `crypto`
 * module and no third-party crypto libraries are used anywhere.
 */
import { CryptoCoreError, ErrorCodes } from './errors.js';

function getCrypto() {
  const c = globalThis.crypto;
  if (!c || !c.subtle || typeof c.getRandomValues !== 'function') {
    throw new CryptoCoreError(
      ErrorCodes.WEBCRYPTO_UNAVAILABLE,
      'Web Crypto API is unavailable. The page must be served from a secure context (HTTPS, localhost or 127.0.0.1).',
    );
  }
  return c;
}

/** @returns {SubtleCrypto} */
export function getSubtle() {
  return getCrypto().subtle;
}

/** Cryptographically secure random bytes (handles the 65,536-byte per-call limit). */
export function randomBytes(length) {
  const out = new Uint8Array(length);
  const c = getCrypto();
  for (let offset = 0; offset < length; offset += 65536) {
    c.getRandomValues(out.subarray(offset, Math.min(offset + 65536, length)));
  }
  return out;
}

/** RFC 4122 v4 UUID. */
export function randomUUID() {
  const c = getCrypto();
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** True when Web Crypto is usable in the current runtime. */
export function isWebCryptoAvailable() {
  try {
    getCrypto();
    return true;
  } catch {
    return false;
  }
}
