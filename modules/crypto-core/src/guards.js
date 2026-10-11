/**
 * CryptoKey validation — catches "wrong key passed to wrong function"
 * mistakes early with a clear error instead of an opaque DOMException.
 */
import { CryptoCoreError, ErrorCodes } from './errors.js';

/**
 * @param {unknown} key
 * @param {{ label: string, type?: 'public'|'private'|'secret', algorithm?: string, usage?: KeyUsage }} expect
 */
export function assertCryptoKey(key, { label, type, algorithm, usage }) {
  const looksLikeKey =
    key && typeof key === 'object' && 'type' in key && 'algorithm' in key && 'usages' in key;
  if (!looksLikeKey) {
    throw new CryptoCoreError(ErrorCodes.INVALID_KEY, `${label} must be a CryptoKey.`);
  }
  if (type && key.type !== type) {
    throw new CryptoCoreError(
      ErrorCodes.INVALID_KEY,
      `${label} must be a ${type} key, got a ${key.type} key.`,
    );
  }
  if (algorithm && key.algorithm.name !== algorithm) {
    throw new CryptoCoreError(
      ErrorCodes.INVALID_KEY,
      `${label} must be an ${algorithm} key, got ${key.algorithm.name}.`,
    );
  }
  if (usage && !key.usages.includes(usage)) {
    throw new CryptoCoreError(ErrorCodes.INVALID_KEY, `${label} is not permitted for "${usage}".`);
  }
}

/** @param {unknown} value @param {string} label */
export function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CryptoCoreError(ErrorCodes.INVALID_INPUT, `${label} must be a non-empty string.`);
  }
}
