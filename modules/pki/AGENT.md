# AGENT.md — PKI / mini-CA

Read `/PROJECT_CONTEXT.md` at the repo root first. This file only covers what's specific to this module.

## Scope

You are building a minimal certificate authority for the demo — not a production PKI. It needs to be real enough to issue and validate certs live during Act 1 (Login/Identity) and to back up the "CA-issued TLS cert" talking point, but it does not need to be a fully general X.509 implementation.

## What you own

- Root CA keypair generation (self-signed root cert)
- Issuing certs for Alice, Bob, and the server, signed by the root CA
- Certificate validation: given a cert, verify it chains back to your root CA and hasn't expired
- Exposing the root CA's public cert so other modules (Auth, Backend) can validate against it

## What you do NOT own

- Do not implement ticket issuance or session logic — that's Authentication's job. You issue and validate certs, Auth issues and validates tickets. Don't blur the two.
- Do not implement the actual TLS termination for the Flask server — that's a deployment/docker-compose concern (Testing module can help wire this), you just need to be able to *issue* a cert that could plausibly be used for it.
- Do not touch RBAC or role assignment — that's Backend's job.

## Dependencies

None. This module is fully independent. Start here alongside Crypto Core — both are foundational and everything else eventually needs one or both.

## Interface you must expose

Python functions, importable by Auth and Backend:

```python
generate_root_ca() -> (ca_cert, ca_private_key)
issue_cert(subject_name: str, subject_public_key) -> cert
validate_cert(cert) -> bool  # True if signed by our root CA and not expired
get_root_ca_cert() -> cert   # public cert other modules can validate against
```

Certs should be returned/accepted in a standard serializable form (PEM string is fine) so they can travel over JSON as a base64 or PEM string field, matching the `cert` field in PROJECT_CONTEXT.md §7.3.

## Definition of done

- [ ] Can generate a self-signed root CA
- [ ] Can issue a cert for a given name + public key, signed by the root CA
- [ ] `validate_cert()` returns `True` for a genuinely issued cert and `False` for a self-signed or tampered one
- [ ] `get_root_ca_cert()` returns something Auth and Backend can import and validate against without needing your private key
- [ ] Standalone test script demonstrates issuing 3 certs (Alice, Bob, server) and validating all 3, with zero dependency on any other module
