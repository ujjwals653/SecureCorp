/**
 * Crypto Adapter Layer — SecureCorp Frontend
 *
 * Thin proxy to @securecorp/crypto-core (modules/crypto-core).
 * This file NEVER implements cryptographic primitives directly.
 * All crypto work is delegated to the real crypto-core module which
 * runs exclusively in the browser via the Web Crypto API.
 */

import {
  generateKeyPair,
  generateSigningKeyPair,
  exportPublicKeyAsBase64,
  importEncryptionPublicKey,
  importSigningPublicKey,
  encryptFile,
  decryptFile,
  wrapKey,
  unwrapKey,
  sign,
  verify,
  createEncryptedEnvelope,
  openEncryptedEnvelope,
  createPublicKeyRegistration,
  buildSignaturePayload,
  isWebCryptoAvailable,
  CryptoCoreError,
  ErrorCodes,
} from "@securecorp/crypto-core";

export { CryptoCoreError, ErrorCodes };

export const cryptoAdapter = {
  /** Returns true when the browser exposes window.crypto.subtle in a secure context. */
  isAvailable() {
    return isWebCryptoAvailable();
  },

  /**
   * Generate an RSA-OAEP-2048 keypair for file key wrapping.
   * @returns {{ publicKey: CryptoKey, privateKey: CryptoKey }}
   */
  async generateKeyPair() {
    return generateKeyPair();
  },

  /**
   * Generate an RSA-PSS-2048 keypair for signing envelopes.
   * @returns {{ publicKey: CryptoKey, privateKey: CryptoKey }}
   */
  async generateSigningKeyPair() {
    return generateSigningKeyPair();
  },

  /**
   * Export a CryptoKey to base64-encoded SPKI DER format for upload to Portal API.
   * @param {CryptoKey} publicKey
   * @returns {string} Base64 SPKI
   */
  async exportPublicKeyAsBase64(publicKey) {
    return exportPublicKeyAsBase64(publicKey);
  },

  /**
   * Import a base64 SPKI string as an RSA-OAEP CryptoKey (for wrapping).
   * @param {string} spkiBase64
   * @returns {CryptoKey}
   */
  async importEncryptionPublicKey(spkiBase64) {
    return importEncryptionPublicKey(spkiBase64);
  },

  /**
   * Import a base64 SPKI string as an RSA-PSS CryptoKey (for signature verification).
   * @param {string} spkiBase64
   * @returns {CryptoKey}
   */
  async importSigningPublicKey(spkiBase64) {
    return importSigningPublicKey(spkiBase64);
  },

  /**
   * AES-256-GCM encrypt raw file bytes.
   * @param {Uint8Array|ArrayBuffer} fileBytes
   * @param {CryptoKey} aesKey
   * @returns {{ ciphertext: string, iv: string }} Base64-encoded
   */
  async encryptFile(fileBytes, aesKey) {
    return encryptFile(fileBytes, aesKey);
  },

  /**
   * AES-256-GCM decrypt ciphertext back to raw bytes.
   * @param {string} ciphertextB64
   * @param {string} ivB64
   * @param {CryptoKey} aesKey
   * @returns {Uint8Array}
   */
  async decryptFile(ciphertextB64, ivB64, aesKey) {
    return decryptFile(ciphertextB64, ivB64, aesKey);
  },

  /**
   * RSA-OAEP wrap an AES key with a recipient's public key.
   * @param {CryptoKey} aesKey
   * @param {CryptoKey} recipientPublicKey
   * @returns {string} Base64-encoded wrapped key
   */
  async wrapKey(aesKey, recipientPublicKey) {
    return wrapKey(aesKey, recipientPublicKey);
  },

  /**
   * RSA-OAEP unwrap a wrapped AES key using the caller's private key.
   * @param {string} wrappedKeyB64
   * @param {CryptoKey} myPrivateKey
   * @returns {CryptoKey}
   */
  async unwrapKey(wrappedKeyB64, myPrivateKey) {
    return unwrapKey(wrappedKeyB64, myPrivateKey);
  },

  /**
   * RSA-PSS sign data (binary concat of ciphertext + iv bytes).
   * @param {Uint8Array} data
   * @param {CryptoKey} signingPrivateKey
   * @returns {string} Base64-encoded signature
   */
  async sign(data, signingPrivateKey) {
    return sign(data, signingPrivateKey);
  },

  /**
   * RSA-PSS verify a signature.
   * @param {Uint8Array} data
   * @param {string} signatureB64
   * @param {CryptoKey} signingPublicKey
   * @returns {boolean}
   */
  async verify(data, signatureB64, signingPublicKey) {
    return verify(data, signatureB64, signingPublicKey);
  },

  /**
   * Concat ciphertext bytes and IV bytes for signature payload.
   * @param {string} ciphertext Base64
   * @param {string} iv Base64
   * @returns {Uint8Array}
   */
  buildSignaturePayload(ciphertext, iv) {
    return buildSignaturePayload(ciphertext, iv);
  },

  // ─── High-Level Envelope Helpers ──────────────────────────────────────────

  /**
   * End-to-end: generate AES key, encrypt file, wrap key for recipient,
   * sign (ciphertext‖iv), and assemble the §7.1 envelope.
   *
   * @param {{ fileBytes: File|Blob, filename: string, senderId: string,
   *            recipientId: string, recipientPublicKey: CryptoKey,
   *            signingPrivateKey: CryptoKey }} params
   * @returns {Object} §7.1 encrypted file envelope ready for POST /api/files/upload
   */
  async createEncryptedEnvelope(params) {
    return createEncryptedEnvelope(params);
  },

  /**
   * End-to-end: verify sender signature, unwrap AES key, decrypt file bytes.
   *
   * @param {Object} envelope  §7.1 envelope from GET /api/files/<file_id>
   * @param {{ recipientPrivateKey: CryptoKey, senderSigningPublicKey: CryptoKey }} keys
   * @returns {{ fileBytes: Uint8Array, filename: string, signatureValid: boolean }}
   */
  async openEncryptedEnvelope(envelope, keys) {
    return openEncryptedEnvelope(envelope, keys);
  },

  /**
   * Build a §7.3 public key registration payload for POST /api/keys/register.
   *
   * @param {{ userId: string, publicKey: CryptoKey, cert?: string|null }} params
   * @returns {Object} §7.3 registration payload
   */
  async createPublicKeyRegistration(params) {
    return createPublicKeyRegistration(params);
  },
};
