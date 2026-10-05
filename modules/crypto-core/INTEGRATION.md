# Crypto Core — Integration Guide

> **Module:** `modules/crypto-core`  
> **Package:** `@securecorp/crypto-core`  
> **Target Audience:** Frontend, Backend, PKI, Testing & Benchmarking module leads.

This document describes how every module in the SecureCorp monorepo integrates with `crypto-core`, the client-side Web Crypto engine.

---

## Table of Contents
1. [Core Cryptographic Contract & Guarantees](#1-core-cryptographic-contract--guarantees)
2. [Frontend Integration Guide (React)](#2-frontend-integration-guide-react)
3. [Backend Integration Guide (Flask Portal API)](#3-backend-integration-guide-flask-portal-api)
4. [PKI / mini-CA Integration Guide](#4-pki--mini-ca-integration-guide)
5. [Testing & Benchmarking Integration Guide](#5-testing--benchmarking-integration-guide)
6. [Shared JSON Schema Specifications](#6-shared-json-schema-specifications)
7. [Error Handling & Error Codes](#7-error-handling--error-codes)
8. [Cross-Module Gotchas & Checklist](#8-cross-module-gotchas--checklist)

---

## 1. Core Cryptographic Contract & Guarantees

Crypto Core implements zero-knowledge client-side encryption. The server **never** holds unwrapped keys and **never** sees plaintext.

| Operation | Scheme | Standard | Parameters |
|---|---|---|---|
| **Key Wrapping** | RSA-OAEP | RFC 8017 | 2048-bit modulus, $e=65537$, SHA-256 |
| **File Encryption** | AES-GCM | NIST SP 800-38D | 256-bit key, 12-byte random IV per file, 128-bit auth tag |
| **Digital Signing** | RSA-PSS | RFC 8017 | 2048-bit modulus, SHA-256, salt length = 32 bytes |
| **Signed Payload** | Binary concat | Internal rule | `base64_decode(ciphertext) || base64_decode(iv)` |
| **Data Boundary** | Base64 | RFC 4648 | Standard `+/` with `=` padding |

---

## 2. Frontend Integration Guide (React)

The Frontend module (`modules/frontend`) has a direct **runtime dependency** on `crypto-core`. Both run inside the client's browser.

### 2.1 Installation / Linking
In `modules/frontend/package.json`, add the local file dependency:

```json
{
  "dependencies": {
    "@securecorp/crypto-core": "file:../crypto-core"
  }
}
```
Then run `npm install` inside `modules/frontend`.

*(Alternatively, if using npm workspaces from repo root, `@securecorp/crypto-core` is automatically linked).*

---

### 2.2 Act 2: Identity Setup & Key Registration Flow

When a user logs in, generate their keypairs in memory and register the public key with the Portal API:

```javascript
import { 
  generateKeyPair, 
  generateSigningKeyPair, 
  createPublicKeyRegistration 
} from '@securecorp/crypto-core';

// 1. Generate asymmetric keypairs (private keys remain non-extractable in browser memory)
const wrappingKeys = await generateKeyPair();        // RSA-OAEP-2048
const signingKeys  = await generateSigningKeyPair(); // RSA-PSS-2048

// Store keys in your React state / context / session store
setUserKeys({
  wrapping: wrappingKeys,
  signing: signingKeys
});

// 2. Assemble the §7.3 registration payload
const registrationPayload = await createPublicKeyRegistration({
  userId: currentUser.id,
  publicKey: wrappingKeys.publicKey,
  cert: currentUser.x509Cert || null // optional cert from PKI
});

// 3. Register public key with Backend
// POST /api/keys/register (Header: Authorization: Bearer <ticket>)
await api.registerPublicKey(registrationPayload);
```

---

### 2.3 Act 3: File Encryption & Upload Flow (Alice)

When Alice shares a file with Bob:

```javascript
import { 
  importEncryptionPublicKey, 
  createEncryptedEnvelope 
} from '@securecorp/crypto-core';

// 1. Fetch Bob's registered public key from Backend
// GET /api/keys/bob
const { public_key: bobSpkiBase64 } = await api.getPublicKey('bob');
const bobPublicKey = await importEncryptionPublicKey(bobSpkiBase64);

// 2. Encrypt the file, wrap AES key for Bob, and sign with Alice's key
// fileInput is a browser File or Blob object from <input type="file">
const envelope = await createEncryptedEnvelope({
  fileBytes: selectedFile,
  filename: selectedFile.name,
  senderId: 'alice',
  recipientId: 'bob',
  recipientPublicKey: bobPublicKey,
  signingPrivateKey: userKeys.signing.privateKey,
});

// 3. Upload envelope directly to Portal API (Server only receives ciphertext)
// POST /api/files/upload (Body: envelope)
await api.uploadEnvelope(envelope);
```

---

### 2.4 Act 3 & Act 6: File Retrieval & Decryption Flow (Bob)

When Bob downloads an envelope from `/api/files/<file_id>`:

```javascript
import { 
  importSigningPublicKey, 
  openEncryptedEnvelope, 
  ErrorCodes 
} from '@securecorp/crypto-core';

try {
  // 1. Fetch Alice's signing public key (from /api/keys/alice or envelope)
  const aliceSigningKey = await importSigningPublicKey(aliceSigningKeyBase64);

  // 2. Verify signature, unwrap AES key, and decrypt bytes
  const { fileBytes, filename, signatureValid } = await openEncryptedEnvelope(envelope, {
    recipientPrivateKey: userKeys.wrapping.privateKey,
    senderSigningPublicKey: aliceSigningKey,
  });

  // 3. Provide file for download / view in React
  const blob = new Blob([fileBytes], { type: 'application/octet-stream' });
  const downloadUrl = URL.createObjectURL(blob);
  triggerDownload(downloadUrl, filename);

} catch (err) {
  if (err.code === ErrorCodes.SIGNATURE_INVALID) {
    // Attack detected! Ciphertext or IV was modified, or sender was forged.
    showSecurityAlert('Integrity Verification Failed: Envelope was tampered with.');
  } else if (err.code === ErrorCodes.UNWRAP_FAILED) {
    // Act 6: Eve attempting to decrypt a file not wrapped for her.
    showSecurityAlert('Access Denied: You do not possess the private key to unwrap this file.');
  } else {
    showSecurityAlert(`Decryption error: ${err.message}`);
  }
}
```

---

## 3. Backend Integration Guide (Flask Portal API)

The Backend module (`modules/backend`) never executes client decryption and does not store unencrypted files.

### 3.1 Data Storage Responsibilities
Store the fields of the §7.1 envelope in SQLite:
* `file_id`: String (UUID primary key)
* `sender_id`: String
* `recipient_id`: String
* `ciphertext`: Text (Base64)
* `iv`: Text (Base64)
* `wrapped_key`: Text (Base64)
* `signature`: Text (Base64)
* `filename`: Text
* `timestamp`: Text (ISO-8601)

### 3.2 Optional Server-Side Signature Verification (Python)
If the backend wants to verify Alice's signature before accepting `POST /api/files/upload`:

```python
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_der_public_key

def verify_envelope_signature(envelope_json, sender_spki_b64):
    """
    Verifies RSA-PSS signature matching Crypto Core's specification:
    Signed Payload = base64_decode(ciphertext) + base64_decode(iv)
    """
    ciphertext_bytes = base64.b64decode(envelope_json['ciphertext'])
    iv_bytes = base64.b64decode(envelope_json['iv'])
    signature_bytes = base64.b64decode(envelope_json['signature'])
    
    # Must match Crypto Core's binary concatenation rule:
    signed_payload = ciphertext_bytes + iv_bytes
    
    # Load sender's RSA-PSS public key from SPKI DER
    spki_der = base64.b64decode(sender_spki_b64)
    public_key = load_der_public_key(spki_der)
    
    try:
        public_key.verify(
            signature_bytes,
            signed_payload,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=32  # Must be 32 bytes
            ),
            hashes.SHA256()
        )
        return True
    except Exception:
        return False
```

---

## 4. PKI / mini-CA Integration Guide

The PKI module (`modules/pki`) issues X.509 certificates to bind identity (`user_id`) to public keys.

* **Key Format:** When a client registers via `createPublicKeyRegistration()`, `public_key` is a standard **Base64-encoded SubjectPublicKeyInfo (SPKI) DER** structure.
* **Algorithm:** RSA 2048-bit with SHA-256.
* **CA Co-signing:** The mini-CA can read the base64 SPKI, sign it, and return the certificate in the `cert` field of `GET /api/keys/<user_id>`.

---

## 5. Testing & Benchmarking Integration Guide

The Testing module (`modules/testing`) can use `crypto-core` for benchmark numbers and integration tests:

### 5.1 Running Crypto Core Unit Tests
```bash
cd modules/crypto-core
npm test
```
* **Status:** 30 unit tests covering keygen, AES-GCM, RSA-OAEP, RSA-PSS, envelope round-trip, tamper detection, and error conditions.
* **Environment:** Standalone Node.js $\ge 20$ (native Web Crypto, zero mocking required).

### 5.2 Standalone Interactive Test UI
To manually run the interactive lab during testing or demo rehearsals:
```bash
cd modules/crypto-core
npm run harness
# Open http://127.0.0.1:3100/harness/
```

### 5.3 Benchmarks to Collect for CNS Exam Submission
Crypto Core functions can be measured with `performance.now()`:
1. **Key Generation Latency:** Time taken by `generateKeyPair()` vs `generateSigningKeyPair()`.
2. **AES-GCM Encryption Throughput:** Time taken by `encryptFile()` on 1 KB, 1 MB, and 10 MB payloads.
3. **Wrap / Unwrap Latency:** Time taken by `wrapKey()` and `unwrapKey()`.

---

## 6. Shared JSON Schema Specifications

### 6.1 Encrypted File Envelope (`PROJECT_CONTEXT.md §7.1`)
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_id": "alice",
  "recipient_id": "bob",
  "ciphertext": "base64-string...",
  "iv": "16-char-base64...",
  "wrapped_key": "344-char-base64...",
  "signature": "344-char-base64...",
  "filename": "quarterly_report.pdf",
  "timestamp": "2026-10-05T16:00:00.000Z"
}
```

### 6.2 Public Key Registration (`PROJECT_CONTEXT.md §7.3`)
```json
{
  "user_id": "bob",
  "public_key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
  "algorithm": "RSA-OAEP-2048",
  "cert": null
}
```

---

## 7. Error Handling & Error Codes

All errors thrown by `crypto-core` are instances of `CryptoCoreError` with a standard `.code` attribute:

```javascript
import { CryptoCoreError, ErrorCodes } from '@securecorp/crypto-core';

try {
  await openEncryptedEnvelope(envelope, keys);
} catch (err) {
  if (err instanceof CryptoCoreError) {
    console.error(err.code); // String error code
  }
}
```

| Error Code | Trigger Condition | Recommended Handling |
|---|---|---|
| `WEBCRYPTO_UNAVAILABLE` | Browser not running in secure context (needs localhost or HTTPS) | Prompt user to access via HTTPS |
| `INVALID_ENVELOPE` | Missing envelope field or bad Base64 | Reject envelope schema |
| `SIGNATURE_INVALID` | Ciphertext or IV modified in transit / sender forgery | Block decryption, notify user of tampering |
| `UNWRAP_FAILED` | Attempted unwrap with wrong private key (Act 6 Eve scenario) | Block access, unauthorized user |
| `DECRYPTION_FAILED` | AES-GCM 128-bit authentication tag mismatch | Tamper detected |
| `INVALID_KEY` | Incorrect key type or algorithm passed | Development assertion |

---

## 8. Cross-Module Gotchas & Checklist

- [ ] **Secure Context Requirement:** `window.crypto.subtle` is **disabled by browsers on insecure origins** (e.g. `http://192.168.x.x`). For live multi-device demo (Alice's laptop vs Bob's laptop), the frontend must be served over **HTTPS** (using PKI module's TLS cert) or through `localhost`.
- [ ] **Docker Context:** When building `modules/frontend/Dockerfile`, set the Docker build context to the repo root or `./modules`, otherwise Docker cannot resolve the `file:../crypto-core` relative path.
- [ ] **Separate Signing Key Registration:** PROJECT_CONTEXT.md §7.3 has one `public_key` field. To enable Bob to verify Alice's digital signature, Bob must obtain Alice's **RSA-PSS signing public key**. Ensure Backend supports either:
  1. An extra field: `signing_public_key` in `POST /api/keys/register` and `GET /api/keys/<user_id>`, OR
  2. Separate key records per purpose.
- [ ] **No Key Persistence by Default:** Keys reside in browser memory (`CryptoKey` objects). Page reload creates fresh keys unless Frontend persists them in IndexedDB.
- [ ] **No Raw Key Transmission:** Ensure no debug logs print raw key buffers or exported private key material.
