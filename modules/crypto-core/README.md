# Crypto Core

Client-side cryptography for SecureCorp. Runs in the browser using **only the Web Crypto API** (`crypto.subtle`), with no external crypto libraries and no server calls. This is the module that makes "the server can't decrypt" true.

## Algorithms

| Purpose | Algorithm | Notes |
|---|---|---|
| Key wrapping | RSA-OAEP-2048, SHA-256, e=65537 | `generateKeyPair()` |
| Signing | **RSA-PSS-2048**, SHA-256, salt 32 B | Chosen because §7.1 specifies RSA-PSS |
| File encryption | AES-256-GCM, random 96-bit IV per file, 128-bit tag | One fresh key per file |
| Signed bytes | `base64decode(ciphertext) ‖ base64decode(iv)` | Backend must use the same rule if it verifies |

Private keys are **non-extractable** by default, so JavaScript can use them but can't read or export them.

## Run the tests

```bash
cd modules/crypto-core
npm test          # Node >= 20, zero dependencies
```

Node's built-in `globalThis.crypto.subtle` is the same W3C Web Crypto API that browsers have. The tests run standalone: no server, no mocks, no other module.

## API

Everything is imported from `src/index.js`. Binary values at the JSON boundary are **base64 strings**.

### Interface from AGENT.md

| Function | Returns |
|---|---|
| `generateKeyPair()` | `{ publicKey, privateKey }`, RSA-OAEP-2048 |
| `generateSigningKeyPair()` | `{ publicKey, privateKey }`, RSA-PSS-2048 |
| `encryptFile(fileBytes, aesKey)` | `{ ciphertext, iv }` (base64). Accepts `ArrayBuffer`, `TypedArray` or `Blob`/`File` |
| `decryptFile(ciphertext, iv, aesKey)` | `Uint8Array` |
| `wrapKey(aesKey, recipientPublicKey)` | base64 wrapped key |
| `unwrapKey(wrappedKey, myPrivateKey)` | AES-GCM `CryptoKey` (decrypt-only, non-extractable) |
| `sign(data, signingPrivateKey)` | base64 signature |
| `verify(data, signature, signingPublicKey)` | `boolean` (never throws on a bad signature) |
| `exportPublicKeyAsBase64(publicKey)` | base64 SPKI |

### Additional helpers

| Function | Purpose |
|---|---|
| `generateFileKey()` | Fresh AES-256-GCM key |
| `createEncryptedEnvelope({...})` | Encrypt, wrap and sign in one call. Returns the exact §7.1 JSON |
| `openEncryptedEnvelope(envelope, {...})` | Validate, **verify**, unwrap, then decrypt. Returns `{ fileBytes, filename, ... }` |
| `validateEnvelope(envelope)` | Checks the §7.1 shape |
| `createPublicKeyRegistration({ userId, publicKey, cert })` | Returns the §7.3 JSON |
| `importEncryptionPublicKey(b64)` / `importSigningPublicKey(b64)` | Turns base64 SPKI (from `GET /keys/<id>`) into a `CryptoKey` |
| `getPublicKeyFingerprint(publicKey)` | SHA-256 hex, for showing which key is in use |
| `isWebCryptoAvailable()` | Feature/secure-context check |

### Errors

Every failure is a `CryptoCoreError` with a stable `err.code`:

| Code | Meaning |
|---|---|
| `WEBCRYPTO_UNAVAILABLE` | The page is not in a secure context (needs HTTPS, localhost or 127.0.0.1) |
| `INVALID_INPUT` / `INVALID_BASE64` / `INVALID_KEY` | Programming or input error |
| `SIGNATURE_INVALID` | Envelope was tampered with, or signed by someone other than the claimed sender |
| `UNWRAP_FAILED` | The file key wasn't wrapped for this user (Eve, Act 6) |
| `DECRYPTION_FAILED` | AES-GCM auth tag mismatch |
| `INVALID_ENVELOPE` | Envelope doesn't match the §7.1 shape |

## Integration steps for Frontend

1. **Add the dependency.** In `modules/frontend/package.json`:
   ```json
   "dependencies": { "@securecorp/crypto-core": "file:../crypto-core" }
   ```
   Then run `npm install`. It's plain ES modules, so no build step is needed.

2. **Key setup (Act 2).** Run this once per user session:
   ```js
   import { generateKeyPair, generateSigningKeyPair, createPublicKeyRegistration } from '@securecorp/crypto-core';

   const encKeys = await generateKeyPair();
   const sigKeys = await generateSigningKeyPair();
   const registration = await createPublicKeyRegistration({ userId, publicKey: encKeys.publicKey });
   // POST /api/keys/register with `registration`
   ```

3. **Share (Alice, Act 3):**
   ```js
   import { importEncryptionPublicKey, createEncryptedEnvelope } from '@securecorp/crypto-core';

   const { public_key } = (await api.getPublicKey('bob')).body;   // GET /api/keys/bob
   const envelope = await createEncryptedEnvelope({
     fileBytes: file,                 // File from <input type="file">
     filename: file.name,
     senderId: 'alice',
     recipientId: 'bob',
     recipientPublicKey: await importEncryptionPublicKey(public_key),
     signingPrivateKey: sigKeys.privateKey,
   });
   // POST /api/files/upload with `envelope`
   ```

4. **Receive (Bob):**
   ```js
   import { importSigningPublicKey, openEncryptedEnvelope, ErrorCodes } from '@securecorp/crypto-core';

   try {
     const { fileBytes, filename } = await openEncryptedEnvelope(envelope, {
       recipientPrivateKey: encKeys.privateKey,
       senderSigningPublicKey: await importSigningPublicKey(aliceSigningKeyB64), // see open question 1
     });
     // new Blob([fileBytes]) → download link
   } catch (err) {
     if (err.code === ErrorCodes.SIGNATURE_INVALID) { /* tampered / forged */ }
     if (err.code === ErrorCodes.UNWRAP_FAILED)     { /* not meant for this user */ }
   }
   ```

5. **Serve over a secure context.** `crypto.subtle` is `undefined` over plain HTTP on a LAN IP. Vite or CRA on `localhost` is fine. For the multi-laptop demo, serve over HTTPS using the mini-CA cert.

6. **Docker.** `docker-compose.yml` builds the frontend from `./modules/frontend`, so it can't see `../crypto-core`. Change the build context to `./modules` (with `dockerfile: frontend/Dockerfile`), or copy crypto-core in during the build.

## Open questions for the team

1. **Signing public key has no slot in §7.3.** Bob needs Alice's RSA-PSS public key to verify. Proposal: add a `signing_public_key` field (base64 SPKI) to §7.3 and to `GET /keys/<user_id>`. This needs agreement with Backend before `createPublicKeyRegistration` is changed.
2. **Key persistence.** Keys are in memory only, so a page refresh loses them and the user must re-register. Non-extractable `CryptoKey`s can be stored in IndexedDB. Not implemented, per AGENT.md; the team needs to decide.
3. **Metadata is not signed.** The §7.1 signature covers only `ciphertext‖iv`, so `filename`, `sender_id` and `recipient_id` can be changed without detection. Consider extending the signed payload.
