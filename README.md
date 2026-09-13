# SecureCorp

A simulated enterprise file-sharing system built for CE305 Cryptography & Network Security (ISE 2 — Applied Cryptography and Network Security Design Challenge).

**Core idea:** all encryption, decryption, and signing happens client-side in the browser via the Web Crypto API. The server only ever stores and moves ciphertext — it structurally cannot decrypt user files.

Full architecture, API contract, data formats, and module ownership: see [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).

## Repo structure

```
modules/
├── crypto-core/   Client-side Web Crypto (AES-GCM, RSA-OAEP, signing)
├── pki/           Mini certificate authority
├── auth/          Kerberos-style ticket authentication
├── backend/        Flask Portal API + RBAC
├── frontend/       React UI (Alice & Bob)
├── ids/            Attack detection + Mallory's attack scripts
└── testing/        Mocks, integration tests, benchmarks, docs
```

Each module folder has its own `AGENT.md` with detailed scope, interfaces, and definition of done — read `PROJECT_CONTEXT.md` first, then your module's `AGENT.md`.

## Setup

```bash
docker-compose up
```

_(Setup instructions will be filled in as services come online — see `modules/testing/AGENT.md`.)_

## Demo

The system demonstrates 6 acts: Login/Identity → Key Setup → Alice shares a file with Bob → Wireshark capture (ciphertext only) → Mallory's attack detected live by IDS → Eve denied via RBAC + missing key. Full walkthrough in `PROJECT_CONTEXT.md` §2.

## Team

| Module | Owner(s) |
|---|---|
| Crypto core | solunkepranav |
| PKI / mini-CA | ShubhSrivastava1326 |
| Authentication | kuldeepsonwane24 |
| Backend / Portal API | dipesh-23 & Brishchket |
| Frontend | Tanishka317 & eshasheth26-hash |
| IDS / attack detection | harshshinde12 & sejal772 |
| Testing / benchmarking / docs | ujjwals653 |
