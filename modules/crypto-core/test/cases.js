/**
 * Shared crypto-core test cases.
 *
 * Environment-agnostic: no node:assert, no DOM. Executed by
 *   - Node:    test/crypto-core.test.js  (npm test)
 *   - Browser: any page can `import { cases } from '.../test/cases.js'`
 *              and run them against the browser's native Web Crypto.
 *
 * Each case maps to a Definition-of-Done item in AGENT.md (see `dod`).
 */
import * as cc from '../src/index.js';

// ---------- tiny assertion helpers ----------
class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}
const assert = {
  ok(value, msg = 'expected truthy value') {
    if (!value) throw new AssertionError(msg);
  },
  equal(actual, expected, msg) {
    if (actual !== expected) {
      throw new AssertionError(`${msg ?? 'values differ'} — expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  bytesEqual(a, b, msg = 'byte arrays differ') {
    if (a.length !== b.length) throw new AssertionError(`${msg} (length ${a.length} vs ${b.length})`);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) throw new AssertionError(`${msg} (first difference at index ${i})`);
    }
  },
  async rejects(fn, code, msg) {
    try {
      await fn();
    } catch (err) {
      if (code && err?.code !== code) {
        throw new AssertionError(`${msg ?? 'wrong error'} — expected code ${code}, got ${err?.code ?? err?.name}: ${err?.message}`);
      }
      return err;
    }
    throw new AssertionError(msg ?? `expected rejection with ${code}`);
  },
};

// ---------- helpers ----------
function randomData(length) {
  const out = new Uint8Array(length);
  for (let o = 0; o < length; o += 65536) {
    globalThis.crypto.getRandomValues(out.subarray(o, Math.min(o + 65536, length)));
  }
  return out;
}

/** Flip one bit of a base64 value's decoded bytes and re-encode. */
function flipByte(b64, index = 0) {
  const bytes = cc.base64ToBytes(b64).slice();
  bytes[index % bytes.length] ^= 0x01;
  return cc.bytesToBase64(bytes);
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// RSA keygen is slow-ish; generate identities once and share across cases.
let fixturesPromise;
function fixtures() {
  fixturesPromise ??= (async () => {
    const make = async () => ({
      enc: await cc.generateKeyPair(),
      sig: await cc.generateSigningKeyPair(),
    });
    const [alice, bob, eve] = await Promise.all([make(), make(), make()]);
    return { alice, bob, eve };
  })();
  return fixturesPromise;
}

async function aliceToBobEnvelope(text = 'Quarterly numbers — confidential') {
  const { alice, bob } = await fixtures();
  const fileBytes = cc.utf8Encode(text);
  const envelope = await cc.createEncryptedEnvelope({
    fileBytes,
    filename: 'report.txt',
    senderId: 'alice',
    recipientId: 'bob',
    recipientPublicKey: bob.enc.publicKey,
    signingPrivateKey: alice.sig.privateKey,
  });
  return { envelope, fileBytes };
}

// ---------- cases ----------
/** @type {{ group: string, name: string, dod?: number, run: () => Promise<void> }[]} */
export const cases = [
  // ===== Encoding =====
  {
    group: 'Encoding',
    name: 'base64 matches a known vector and round-trips',
    run: async () => {
      assert.equal(cc.bytesToBase64(cc.utf8Encode('hello')), 'aGVsbG8=', 'encode "hello"');
      assert.equal(cc.utf8Decode(cc.base64ToBytes('aGVsbG8=')), 'hello', 'decode "hello"');
    },
  },
  {
    group: 'Encoding',
    name: 'base64 handles 2 MiB without stack overflow',
    run: async () => {
      const data = randomData(2 * 1024 * 1024);
      assert.bytesEqual(cc.base64ToBytes(cc.bytesToBase64(data)), data);
    },
  },
  {
    group: 'Encoding',
    name: 'invalid base64 is rejected with INVALID_BASE64',
    run: async () => {
      await assert.rejects(async () => cc.base64ToBytes('not*base64!'), cc.ErrorCodes.INVALID_BASE64);
      await assert.rejects(async () => cc.base64ToBytes('abc'), cc.ErrorCodes.INVALID_BASE64);
    },
  },

  // ===== Keys =====
  {
    group: 'Keys',
    dod: 1,
    name: 'generateKeyPair → RSA-OAEP-2048/SHA-256, private key non-extractable',
    run: async () => {
      const { publicKey, privateKey } = await cc.generateKeyPair();
      assert.equal(publicKey.type, 'public');
      assert.equal(privateKey.type, 'private');
      assert.equal(publicKey.algorithm.name, 'RSA-OAEP');
      assert.equal(publicKey.algorithm.modulusLength, 2048);
      assert.equal(publicKey.algorithm.hash.name, 'SHA-256');
      assert.equal(privateKey.extractable, false, 'private key extractable');
      assert.ok(privateKey.usages.includes('unwrapKey'), 'private key can unwrap');
      assert.ok(publicKey.usages.includes('wrapKey'), 'public key can wrap');
    },
  },
  {
    group: 'Keys',
    name: 'generateSigningKeyPair → RSA-PSS-2048/SHA-256',
    run: async () => {
      const { publicKey, privateKey } = await cc.generateSigningKeyPair();
      assert.equal(publicKey.algorithm.name, 'RSA-PSS');
      assert.equal(publicKey.algorithm.modulusLength, 2048);
      assert.equal(privateKey.extractable, false);
      assert.ok(privateKey.usages.includes('sign'));
    },
  },
  {
    group: 'Keys',
    dod: 1,
    name: 'exportPublicKeyAsBase64 → SPKI base64 that re-imports identically',
    run: async () => {
      const { bob } = await fixtures();
      const b64 = await cc.exportPublicKeyAsBase64(bob.enc.publicKey);
      const der = cc.base64ToBytes(b64);
      assert.equal(der[0], 0x30, 'SPKI DER starts with SEQUENCE');
      assert.ok(der.length > 290 && der.length < 300, `RSA-2048 SPKI ~294 bytes, got ${der.length}`);
      const reimported = await cc.importEncryptionPublicKey(b64);
      assert.equal(await cc.exportPublicKeyAsBase64(reimported), b64);
    },
  },
  {
    group: 'Keys',
    name: 'exportPublicKeyAsBase64 refuses a private key',
    run: async () => {
      const { bob } = await fixtures();
      await assert.rejects(() => cc.exportPublicKeyAsBase64(bob.enc.privateKey), cc.ErrorCodes.INVALID_KEY);
    },
  },
  {
    group: 'Keys',
    name: 'fingerprint is a stable 64-hex SHA-256 and unique per key',
    run: async () => {
      const { alice, bob } = await fixtures();
      const a1 = await cc.getPublicKeyFingerprint(alice.enc.publicKey);
      const a2 = await cc.getPublicKeyFingerprint(alice.enc.publicKey);
      const b = await cc.getPublicKeyFingerprint(bob.enc.publicKey);
      assert.ok(/^[0-9a-f]{64}$/.test(a1), 'hex format');
      assert.equal(a1, a2, 'stable');
      assert.ok(a1 !== b, 'unique');
    },
  },
  {
    group: 'Keys',
    name: 'importEncryptionPublicKey rejects garbage',
    run: async () => {
      await assert.rejects(() => cc.importEncryptionPublicKey(cc.bytesToBase64(randomData(64))), cc.ErrorCodes.INVALID_KEY);
    },
  },

  // ===== AES-GCM =====
  {
    group: 'AES-GCM',
    dod: 2,
    name: 'encrypt → decrypt returns the original text bytes',
    run: async () => {
      const key = await cc.generateFileKey();
      const original = cc.utf8Encode('Top secret ✓ — ₹ unicode test');
      const { ciphertext, iv } = await cc.encryptFile(original, key);
      assert.equal(typeof ciphertext, 'string', 'ciphertext is base64 string');
      assert.equal(typeof iv, 'string', 'iv is base64 string');
      assert.bytesEqual(await cc.decryptFile(ciphertext, iv, key), original);
    },
  },
  {
    group: 'AES-GCM',
    dod: 2,
    name: 'round-trips 1 MiB of random binary data',
    run: async () => {
      const key = await cc.generateFileKey();
      const original = randomData(1024 * 1024);
      const { ciphertext, iv } = await cc.encryptFile(original, key);
      assert.bytesEqual(await cc.decryptFile(ciphertext, iv, key), original);
    },
  },
  {
    group: 'AES-GCM',
    name: 'round-trips an empty file',
    run: async () => {
      const key = await cc.generateFileKey();
      const { ciphertext, iv } = await cc.encryptFile(new Uint8Array(0), key);
      assert.equal((await cc.decryptFile(ciphertext, iv, key)).length, 0);
    },
  },
  {
    group: 'AES-GCM',
    name: 'accepts a Blob (File) as input',
    run: async () => {
      if (typeof Blob === 'undefined') return;
      const key = await cc.generateFileKey();
      const original = cc.utf8Encode('from a Blob');
      const { ciphertext, iv } = await cc.encryptFile(new Blob([original]), key);
      assert.bytesEqual(await cc.decryptFile(ciphertext, iv, key), original);
    },
  },
  {
    group: 'AES-GCM',
    name: 'every call uses a fresh 12-byte IV; ciphertext = plaintext + 16-byte tag',
    run: async () => {
      const key = await cc.generateFileKey();
      const data = cc.utf8Encode('same input');
      const a = await cc.encryptFile(data, key);
      const b = await cc.encryptFile(data, key);
      assert.equal(cc.base64ToBytes(a.iv).length, 12, 'iv length');
      assert.ok(a.iv !== b.iv, 'IVs must differ');
      assert.ok(a.ciphertext !== b.ciphertext, 'ciphertexts must differ');
      assert.equal(cc.base64ToBytes(a.ciphertext).length, data.length + 16, 'ciphertext length');
    },
  },
  {
    group: 'AES-GCM',
    name: 'wrong key → DECRYPTION_FAILED',
    run: async () => {
      const { ciphertext, iv } = await cc.encryptFile(cc.utf8Encode('x'), await cc.generateFileKey());
      await assert.rejects(() => cc.decryptFile(ciphertext, iv, undefined), cc.ErrorCodes.INVALID_KEY);
      const otherKey = await cc.generateFileKey();
      await assert.rejects(() => cc.decryptFile(ciphertext, iv, otherKey), cc.ErrorCodes.DECRYPTION_FAILED);
    },
  },
  {
    group: 'AES-GCM',
    name: 'tampered ciphertext or IV → DECRYPTION_FAILED (GCM tag)',
    run: async () => {
      const key = await cc.generateFileKey();
      const { ciphertext, iv } = await cc.encryptFile(cc.utf8Encode('integrity matters'), key);
      await assert.rejects(() => cc.decryptFile(flipByte(ciphertext, 3), iv, key), cc.ErrorCodes.DECRYPTION_FAILED);
      await assert.rejects(() => cc.decryptFile(ciphertext, flipByte(iv, 0), key), cc.ErrorCodes.DECRYPTION_FAILED);
    },
  },

  // ===== RSA-OAEP wrapping =====
  {
    group: 'Key wrapping',
    dod: 3,
    name: 'wrap with public key → unwrap with private key → decrypts the file',
    run: async () => {
      const { bob } = await fixtures();
      const fileKey = await cc.generateFileKey();
      const original = cc.utf8Encode('wrapped key test');
      const { ciphertext, iv } = await cc.encryptFile(original, fileKey);
      const wrapped = await cc.wrapKey(fileKey, bob.enc.publicKey);
      assert.equal(typeof wrapped, 'string', 'wrapped key is base64');
      assert.equal(cc.base64ToBytes(wrapped).length, 256, 'RSA-2048 output is 256 bytes');
      const unwrapped = await cc.unwrapKey(wrapped, bob.enc.privateKey);
      assert.equal(unwrapped.extractable, false, 'unwrapped key is non-extractable');
      assert.bytesEqual(await cc.decryptFile(ciphertext, iv, unwrapped), original);
    },
  },
  {
    group: 'Key wrapping',
    dod: 3,
    name: 'unwrapping with the wrong private key (Eve) → UNWRAP_FAILED',
    run: async () => {
      const { bob, eve } = await fixtures();
      const wrapped = await cc.wrapKey(await cc.generateFileKey(), bob.enc.publicKey);
      await assert.rejects(() => cc.unwrapKey(wrapped, eve.enc.privateKey), cc.ErrorCodes.UNWRAP_FAILED);
    },
  },
  {
    group: 'Key wrapping',
    name: 'wrapKey rejects a signing key used as a wrapping key',
    run: async () => {
      const { bob } = await fixtures();
      const fileKey = await cc.generateFileKey();
      await assert.rejects(() => cc.wrapKey(fileKey, bob.sig.publicKey), cc.ErrorCodes.INVALID_KEY);
    },
  },

  // ===== RSA-PSS signatures =====
  {
    group: 'Signatures',
    dod: 4,
    name: 'valid signature verifies',
    run: async () => {
      const { alice } = await fixtures();
      const data = cc.utf8Encode('signed message');
      const sig = await cc.sign(data, alice.sig.privateKey);
      assert.equal(cc.base64ToBytes(sig).length, 256, 'RSA-2048 signature is 256 bytes');
      assert.equal(await cc.verify(data, sig, alice.sig.publicKey), true);
    },
  },
  {
    group: 'Signatures',
    dod: 4,
    name: 'verification fails on tampered data',
    run: async () => {
      const { alice } = await fixtures();
      const sig = await cc.sign(cc.utf8Encode('pay bob 100'), alice.sig.privateKey);
      assert.equal(await cc.verify(cc.utf8Encode('pay bob 900'), sig, alice.sig.publicKey), false);
    },
  },
  {
    group: 'Signatures',
    dod: 4,
    name: 'verification fails with the wrong public key or a corrupted signature',
    run: async () => {
      const { alice, eve } = await fixtures();
      const data = cc.utf8Encode('hello');
      const sig = await cc.sign(data, alice.sig.privateKey);
      assert.equal(await cc.verify(data, sig, eve.sig.publicKey), false, 'wrong key');
      assert.equal(await cc.verify(data, flipByte(sig, 10), alice.sig.publicKey), false, 'flipped bit');
      assert.equal(await cc.verify(data, 'not-base64!!', alice.sig.publicKey), false, 'malformed');
    },
  },

  // ===== Envelope (§7.1) =====
  {
    group: 'Envelope §7.1',
    dod: 5,
    name: 'createEncryptedEnvelope has exactly the §7.1 fields, in order, all strings',
    run: async () => {
      const { envelope } = await aliceToBobEnvelope();
      assert.equal(JSON.stringify(Object.keys(envelope)), JSON.stringify(cc.ENVELOPE_FIELDS), 'field set/order');
      for (const [k, v] of Object.entries(envelope)) assert.equal(typeof v, 'string', `${k} type`);
      assert.ok(UUID_V4_RE.test(envelope.file_id), 'file_id is UUID v4');
      assert.ok(ISO_RE.test(envelope.timestamp), 'timestamp is ISO-8601');
      assert.equal(cc.base64ToBytes(envelope.iv).length, 12, 'iv is 12 bytes');
      assert.equal(cc.base64ToBytes(envelope.wrapped_key).length, 256, 'wrapped_key is 256 bytes');
      assert.equal(cc.base64ToBytes(envelope.signature).length, 256, 'signature is 256 bytes');
      assert.equal(envelope.sender_id, 'alice');
      assert.equal(envelope.recipient_id, 'bob');
      assert.ok(cc.validateEnvelope(JSON.parse(JSON.stringify(envelope))), 'survives JSON round-trip');
    },
  },
  {
    group: 'Envelope §7.1',
    dod: 5,
    name: 'signature covers ciphertext‖iv and verifies with the sender key',
    run: async () => {
      const { alice } = await fixtures();
      const { envelope } = await aliceToBobEnvelope();
      const payload = cc.buildSignaturePayload(envelope.ciphertext, envelope.iv);
      assert.equal(
        payload.length,
        cc.base64ToBytes(envelope.ciphertext).length + 12,
        'payload = ciphertext bytes + 12 iv bytes',
      );
      assert.equal(await cc.verify(payload, envelope.signature, alice.sig.publicKey), true);
    },
  },
  {
    group: 'Envelope §7.1',
    dod: 5,
    name: 'Alice → Bob: openEncryptedEnvelope returns the original bytes',
    run: async () => {
      const { alice, bob } = await fixtures();
      const { envelope, fileBytes } = await aliceToBobEnvelope('Act 3 demo payload');
      const opened = await cc.openEncryptedEnvelope(JSON.parse(JSON.stringify(envelope)), {
        recipientPrivateKey: bob.enc.privateKey,
        senderSigningPublicKey: alice.sig.publicKey,
      });
      assert.bytesEqual(opened.fileBytes, fileBytes);
      assert.equal(opened.filename, 'report.txt');
      assert.equal(opened.signatureValid, true);
    },
  },
  {
    group: 'Envelope §7.1',
    name: 'Eve cannot open Bob\'s envelope (no wrapped key for her) → UNWRAP_FAILED',
    run: async () => {
      const { alice, eve } = await fixtures();
      const { envelope } = await aliceToBobEnvelope();
      await assert.rejects(
        () => cc.openEncryptedEnvelope(envelope, {
          recipientPrivateKey: eve.enc.privateKey,
          senderSigningPublicKey: alice.sig.publicKey,
        }),
        cc.ErrorCodes.UNWRAP_FAILED,
      );
    },
  },
  {
    group: 'Envelope §7.1',
    name: 'ciphertext modified in transit → SIGNATURE_INVALID (rejected before decrypt)',
    run: async () => {
      const { alice, bob } = await fixtures();
      const { envelope } = await aliceToBobEnvelope();
      const tampered = { ...envelope, ciphertext: flipByte(envelope.ciphertext, 5) };
      await assert.rejects(
        () => cc.openEncryptedEnvelope(tampered, {
          recipientPrivateKey: bob.enc.privateKey,
          senderSigningPublicKey: alice.sig.publicKey,
        }),
        cc.ErrorCodes.SIGNATURE_INVALID,
      );
    },
  },
  {
    group: 'Envelope §7.1',
    name: 'forged envelope signed by someone other than the claimed sender → SIGNATURE_INVALID',
    run: async () => {
      const { alice, bob, eve } = await fixtures();
      const forged = await cc.createEncryptedEnvelope({
        fileBytes: cc.utf8Encode('fake memo'),
        filename: 'memo.txt',
        senderId: 'alice', // claims to be Alice…
        recipientId: 'bob',
        recipientPublicKey: bob.enc.publicKey,
        signingPrivateKey: eve.sig.privateKey, // …but signed with Eve's key
      });
      await assert.rejects(
        () => cc.openEncryptedEnvelope(forged, {
          recipientPrivateKey: bob.enc.privateKey,
          senderSigningPublicKey: alice.sig.publicKey,
        }),
        cc.ErrorCodes.SIGNATURE_INVALID,
      );
    },
  },
  {
    group: 'Envelope §7.1',
    name: 'validateEnvelope rejects missing fields and a wrong-length IV',
    run: async () => {
      const { envelope } = await aliceToBobEnvelope();
      const { wrapped_key, ...missing } = envelope;
      void wrapped_key;
      await assert.rejects(async () => cc.validateEnvelope(missing), cc.ErrorCodes.INVALID_ENVELOPE);
      await assert.rejects(
        async () => cc.validateEnvelope({ ...envelope, iv: cc.bytesToBase64(randomData(16)) }),
        cc.ErrorCodes.INVALID_ENVELOPE,
      );
      await assert.rejects(async () => cc.validateEnvelope(null), cc.ErrorCodes.INVALID_ENVELOPE);
    },
  },

  // ===== Registration (§7.3) =====
  {
    group: 'Registration §7.3',
    dod: 1,
    name: 'createPublicKeyRegistration matches the §7.3 shape',
    run: async () => {
      const { bob } = await fixtures();
      const reg = await cc.createPublicKeyRegistration({ userId: 'bob', publicKey: bob.enc.publicKey });
      assert.equal(JSON.stringify(Object.keys(reg)), JSON.stringify(cc.PUBLIC_KEY_REGISTRATION_FIELDS));
      assert.equal(reg.user_id, 'bob');
      assert.equal(reg.algorithm, 'RSA-OAEP-2048');
      assert.equal(reg.cert, null);
      assert.equal(reg.public_key, await cc.exportPublicKeyAsBase64(bob.enc.publicKey));
    },
  },
];

export const DEFINITION_OF_DONE = [
  'Generate a keypair and export the public key as base64',
  'Encrypt a file with a fresh AES-GCM key and decrypt it back to the original bytes',
  'Wrap an AES key with an RSA-OAEP public key and unwrap it with the matching private key',
  'Sign data and verify a valid signature; verification fails on tampered data',
  'encryptFile + wrapKey + sign assembled together match the exact §7.1 JSON shape',
  'Unit tests run standalone (no server, no other module)',
];
