/**
 * Algorithm parameters — the single place these are defined.
 * Changing anything here is a contract change (Backend may verify
 * signatures; other browsers must unwrap keys) — coordinate first.
 */

const PUBLIC_EXPONENT_65537 = new Uint8Array([0x01, 0x00, 0x01]);

/** RSA-OAEP-2048 keypair used for wrapping/unwrapping AES file keys. */
export const RSA_OAEP_KEYGEN = Object.freeze({
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: PUBLIC_EXPONENT_65537,
  hash: 'SHA-256',
});
export const RSA_OAEP_IMPORT = Object.freeze({ name: 'RSA-OAEP', hash: 'SHA-256' });

/** Signing scheme: RSA-PSS (chosen to match PROJECT_CONTEXT.md §7.1). */
export const RSA_PSS_KEYGEN = Object.freeze({
  name: 'RSA-PSS',
  modulusLength: 2048,
  publicExponent: PUBLIC_EXPONENT_65537,
  hash: 'SHA-256',
});
export const RSA_PSS_IMPORT = Object.freeze({ name: 'RSA-PSS', hash: 'SHA-256' });
/** Salt length = hash output length (SHA-256 → 32 bytes), the RFC 8017 recommendation. */
export const RSA_PSS_SALT_LENGTH = 32;

/** AES-256-GCM for file content. */
export const AES_GCM_KEYGEN = Object.freeze({ name: 'AES-GCM', length: 256 });
export const AES_GCM_IV_LENGTH = 12; // bytes (96-bit), per §7.1
export const AES_GCM_TAG_LENGTH = 128; // bits

export const MIN_RSA_MODULUS_BITS = 2048;

/** Labels used in the JSON contracts (§7.3). */
export const ALGORITHMS = Object.freeze({
  keyWrapping: 'RSA-OAEP-2048',
  signing: 'RSA-PSS-2048-SHA256',
  fileEncryption: 'AES-256-GCM',
});
