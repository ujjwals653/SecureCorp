/**
 * Error model for crypto-core.
 *
 * Every failure thrown by this module is a CryptoCoreError with a stable
 * `code`, so Frontend can branch on `err.code` instead of parsing messages.
 * Error messages never include key material or plaintext.
 */

export const ErrorCodes = Object.freeze({
  WEBCRYPTO_UNAVAILABLE: 'WEBCRYPTO_UNAVAILABLE',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_BASE64: 'INVALID_BASE64',
  INVALID_KEY: 'INVALID_KEY',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  UNWRAP_FAILED: 'UNWRAP_FAILED',
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  INVALID_ENVELOPE: 'INVALID_ENVELOPE',
});

export class CryptoCoreError extends Error {
  /**
   * @param {keyof typeof ErrorCodes} code
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(code, message, options) {
    super(message, options);
    this.name = 'CryptoCoreError';
    this.code = code;
  }
}
