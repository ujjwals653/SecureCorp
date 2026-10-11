/**
 * Crypto Adapter Layer — SecureCorp Frontend
 * 
 * INTEGRATION PLACEHOLDER ONLY.
 * 
 * IMPORTANT ARCHITECTURAL DIRECTIVES:
 * 1. This file NEVER implements cryptographic algorithms or primitives.
 * 2. This file MUST NOT invoke window.crypto.subtle directly or write inline AES/RSA/signing/wrapping.
 * 3. This module acts solely as a thin proxy to import and delegate to the real
 *    Crypto Core module (modules/crypto-core) once that module is implemented.
 * 
 * Documented Crypto Core Interface (modules/crypto-core/AGENT.md):
 * - generateKeyPair() -> { publicKey, privateKey }
 * - generateSigningKeyPair() -> { publicKey, privateKey }
 * - encryptFile(fileBytes, aesKey) -> { ciphertext, iv }
 * - decryptFile(ciphertext, iv, aesKey) -> fileBytes
 * - wrapKey(aesKey, recipientPublicKey) -> wrappedKey
 * - unwrapKey(wrappedKey, myPrivateKey) -> aesKey
 * - sign(data, signingPrivateKey) -> signature
 * - verify(data, signature, signingPublicKey) -> boolean
 * - exportPublicKeyAsBase64(publicKey) -> string
 */

const CRYPTO_CORE_NOT_CONNECTED_MSG =
  "Crypto Core module is not connected. Cryptographic functions are owned by modules/crypto-core and will be linked upon implementation.";

export const cryptoAdapter = {
  isAvailable() {
    return false;
  },

  async generateKeyPair() {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async generateSigningKeyPair() {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async encryptFile(fileBytes, aesKey) {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async decryptFile(ciphertext, iv, aesKey) {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async wrapKey(aesKey, recipientPublicKey) {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async unwrapKey(wrappedKey, myPrivateKey) {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async sign(data, signingPrivateKey) {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async verify(data, signature, signingPublicKey) {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },

  async exportPublicKeyAsBase64(publicKey) {
    throw new Error(CRYPTO_CORE_NOT_CONNECTED_MSG);
  },
};
