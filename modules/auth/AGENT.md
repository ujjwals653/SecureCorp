# AGENT.md — Authentication

Read `/PROJECT_CONTEXT.md` at the repo root first. This file only covers what's specific to this module.

## Scope

You are building a Kerberos-style ticket-based authentication flow: a user logs in, gets a signed ticket, and that ticket is what proves their identity and role to the Portal API on every subsequent request. You are not building password storage/hashing infrastructure from scratch beyond what's needed for the demo login screen — keep it simple (a small hardcoded or seeded user table is fine for a course demo).

## What you own

- Login endpoint logic: verify credentials, issue a ticket (see PROJECT_CONTEXT.md §7.2 for exact shape)
- Ticket signing (so it can't be forged) and validation
- Ticket expiry handling

## What you do NOT own

- Do not implement cert issuance — that's PKI's job. You call PKI's `validate_cert()` if you need to check a client's cert during login; you don't generate certs yourself.
- Do not implement RBAC enforcement on file/resource access — you issue the `role` field in the ticket, but Backend/Portal API is the one that decides what a role can access. Don't put access-control logic here.
- Do not write the login UI — that's Frontend's job, you expose the endpoint.

## Dependencies

**PKI, for cert validation — mockable.** Until PKI's real module is ready, use this stub in your code, clearly marked:

```python
# MOCK — replace with real PKI module (modules/pki) at Integration Checkpoint 1
def validate_cert(cert) -> bool:
    return True
```

Build and test your entire ticket-issuance flow against this stub. Don't wait on PKI.

## Interface you must expose

```python
login(user_id: str, password: str) -> ticket_json   # see §7.2 shape, or raises AuthError
validate_ticket(ticket: str) -> dict | None          # returns decoded ticket claims, or None if invalid/expired
```

`validate_ticket` is what Portal API will call (as a mock initially, then for real) on every protected request — get this interface right, Backend is building directly against it.

## Definition of done

- [ ] `login()` returns a ticket matching the exact JSON shape in PROJECT_CONTEXT.md §7.2, for a valid user/password
- [ ] `login()` fails cleanly (no ticket, clear error) for bad credentials
- [ ] `validate_ticket()` correctly accepts a genuine, unexpired ticket and rejects a tampered or expired one
- [ ] Ticket is signed such that modifying the `role` field invalidates it (this is what makes Act 6's RBAC denial trustworthy — a forged "admin" role must fail validation)
- [ ] Standalone tests pass using the mocked `validate_cert()`, no dependency on real PKI module required
