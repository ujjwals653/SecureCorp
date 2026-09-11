# AGENT.md — Crypto Core

Read `/PROJECT_CONTEXT.md` at the repo root first. This file only covers what's specific to this module.

## Scope

You are building the client-side cryptography layer that runs inside the browser (used by the Frontend module). This is the module that makes the "server can't decrypt" property real. Everything here runs via the **Web Crypto API** (`window.crypto.subtle`) — no Node.js `crypto`, no server-side crypto libraries, no external crypto packages. If Web Crypto can't do something you need, say so instead of reaching for a library.

## What you own

- Keypair generation (RSA-OAEP for key wrapping, RSA-PSS or ECDSA for signing — pick one signing scheme and note which)
- AES-GCM file encryption / decryption
- RSA-OAEP key wrapping / unwrapping (wrapping an AES key with a recipient's public key)
- Signing and signature verification
- Producing the **encrypted file envelope** JSON (see PROJECT_CONTEXT.md §7.1) and the **public key registration** JSON (§7.3)

## What you do NOT own

- Do not write any UI. That's Frontend's job — you expose functions, they call them.
- Do not write any server code or network calls. This module never talks to the backend directly — Frontend does that using your output.
- Do not implement key storage/persistence strategy beyond in-memory or browser-native (e.g. IndexedDB) — if persistence design is needed, flag it, don't invent a scheme unilaterally.

## Dependencies

None. This module is fully independent and can be developed and unit-tested with zero mocking. Start here if you're unsure where to begin.

## Interface you must expose

Expose these as plain JS functions (module export), so Frontend can call them directly:

```js
generateKeyPair() -> { publicKey, privateKey }        // RSA-OAEP-2048
generateSigningKeyPair() -> { publicKey, privateKey }  // RSA-PSS or ECDSA
encryptFile(fileBytes, aesKey) -> { ciphertext, iv }
decryptFile(ciphertext, iv, aesKey) -> fileBytes
wrapKey(aesKey, recipientPublicKey) -> wrappedKey
unwrapKey(wrappedKey, myPrivateKey) -> aesKey
sign(data, signingPrivateKey) -> signature
verify(data, signature, signingPublicKey) -> boolean
exportPublicKeyAsBase64(publicKey) -> string
```

All binary outputs (ciphertext, iv, wrapped keys, signatures) must be returned as base64 strings when they're going into the JSON envelope formats in PROJECT_CONTEXT.md §7 — Frontend and Backend expect base64, not raw ArrayBuffers, at that boundary.

## Definition of done

- [ ] Can generate a keypair and export the public key as base64
- [ ] Can encrypt a file with a fresh AES-GCM key and decrypt it back to the original bytes
- [ ] Can wrap an AES key with an RSA-OAEP public key and unwrap it with the matching private key
- [ ] Can sign data and verify a valid signature; verification correctly fails on tampered data
- [ ] Output of `encryptFile` + `wrapKey` + `sign`, assembled together, matches the exact JSON shape in PROJECT_CONTEXT.md §7.1
- [ ] Unit tests demonstrating all of the above run standalone (no server, no other module needed)
