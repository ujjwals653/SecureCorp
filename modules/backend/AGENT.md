# AGENT.md — Backend / Portal API

Read `/PROJECT_CONTEXT.md` at the repo root first. This file only covers what's specific to this module.

## Scope

You are building the Flask API that Alice's and Bob's browsers talk to. This module stores ciphertext, enforces RBAC, and is the piece that must NEVER be able to decrypt anything — no plaintext or unwrapped key should ever pass through here. Follow the API contract in PROJECT_CONTEXT.md §8 exactly; Frontend is building against it in parallel.

## What you own

- All Flask routes listed in PROJECT_CONTEXT.md §8
- RBAC enforcement (this must be real server-side logic, not trusted from the client — see §8 note on `/files/<file_id>`)
- Database schema and storage: ciphertext, wrapped keys, signatures, public keys, tickets metadata — never plaintext, never unwrapped keys
- Request validation (reject malformed envelopes, missing fields, etc.)

## What you do NOT own

- Do not implement any encryption, decryption, or key-wrapping logic here. If you find yourself importing a crypto library to "just decrypt this for a sanity check," stop — that breaks the core architectural property of the whole project.
- Do not implement ticket issuance or cert issuance — you validate tickets (via Auth's function), you don't create them.
- Do not build the IDS classifier — you may optionally log requests in a format IDS can consume, but detection logic lives in the IDS module.

## Dependencies

**Auth, for ticket validation — mockable.** Until Auth's real module is ready, use this stub, clearly marked:

```python
# MOCK — replace with real Auth module (modules/auth) at Integration Checkpoint 2
def validate_ticket(ticket: str) -> dict | None:
    if ticket == "test-alice-ticket":
        return {"user_id": "alice", "role": "employee"}
    if ticket == "test-bob-ticket":
        return {"user_id": "bob", "role": "employee"}
    return None
```

**Crypto core's data format — contract only, not a runtime call.** You never call Crypto core's code. You only need to know the exact JSON shape of the encrypted file envelope (PROJECT_CONTEXT.md §7.1) so you can store and return it correctly. Use a hardcoded sample envelope (matching that shape) for your own testing.

## Interface you must expose

The full REST API from PROJECT_CONTEXT.md §8. Match method, path, and JSON shapes exactly — Frontend is mocking against this contract right now and will swap to your real endpoints at Integration Checkpoint 3.

## Definition of done

- [ ] Every endpoint in §8 implemented and returns the documented shape
- [ ] `/files/upload` accepts a valid envelope (§7.1 shape) and stores it; rejects malformed ones with a clear error
- [ ] `/files/<file_id>` returns `403` when the caller (from ticket) is neither sender nor recipient — test this explicitly, it's the Act 6 mechanism
- [ ] All protected routes reject requests with missing/invalid `Authorization` header
- [ ] No code path in this module ever imports a decryption function or handles an unwrapped key
- [ ] Tests pass using the mocked `validate_ticket()` and a hardcoded sample envelope, no dependency on real Auth or real Crypto core required
