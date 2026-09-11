# AGENT.md — Frontend (Alice & Bob UI)

Read `/PROJECT_CONTEXT.md` at the repo root first. This file only covers what's specific to this module.

## Scope

You are building the React UI both Alice and Bob use: login, key setup, file sharing, and file receiving screens. This is where Crypto Core's functions actually get called — the browser is where encryption happens, so this module and Crypto Core are tightly linked in practice even though they're separately owned.

## What you own

- Login screen (calls Auth's `/auth/login` endpoint)
- Key setup screen/flow (calls Crypto Core to generate keys, calls Portal API's `/keys/register`)
- File share screen (Alice: pick file + recipient, calls Crypto Core to encrypt/wrap/sign, calls Portal API's `/files/upload`)
- File receive/inbox screen (Bob: calls Portal API's `/files/inbox` and `/files/<file_id>`, calls Crypto Core to unwrap/decrypt)
- All client-side state and UX for the above

## What you do NOT own

- Do not implement any crypto primitives yourself. If Crypto Core doesn't expose a function you need, request it — don't write your own AES/RSA calls inline.
- Do not implement RBAC logic client-side. The UI can hide buttons a user shouldn't see for UX polish, but that is not a security boundary — Backend enforces the real one. Don't treat client-side checks as sufficient anywhere in this codebase.
- Do not build the IDS dashboard — that's a separate UI owned by the IDS module.

## Dependencies

**Crypto Core — real, runtime call.** This runs locally in the browser alongside your code, so use the actual module, not a mock. Import its exposed functions directly (see `modules/crypto-core/AGENT.md` for the interface).

**Portal API — mockable.** Until Backend's real endpoints are ready, mock fetch responses matching PROJECT_CONTEXT.md §8 exactly, e.g.:

```js
// MOCK — replace with real call to Backend (modules/backend) at Integration Checkpoint 3
async function mockUploadFile(envelope) {
  return { status: 200, body: { file_id: envelope.file_id, status: "stored" } };
}
```

Keep every mock clearly labeled and isolated (e.g. a single `mockApi.js` file) so swapping to the real API later is a one-line change per call site, not a rewrite.

## Definition of done

- [ ] Login screen works against a mocked `/auth/login` response
- [ ] Key setup screen calls real Crypto Core `generateKeyPair()` and displays/exports the public key
- [ ] Share screen produces a real encrypted envelope (via Crypto Core) and sends it to the mocked upload endpoint, matching §7.1 shape exactly
- [ ] Receive screen can take a sample envelope + Bob's real private key and decrypt it back to original file bytes, using real Crypto Core functions
- [ ] All mocked API calls are isolated in one identifiable place, ready to be swapped for real Backend calls
- [ ] No security-relevant decision (who can see a file) is enforced only in this module
