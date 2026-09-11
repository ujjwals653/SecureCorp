# SecureCorp — Project Context (Read First)

This file is the shared source of truth for every AI coding agent working on this repo. Read this in full before writing any code, regardless of which module you've been assigned. Module-specific instructions live in `modules/<module-name>/AGENT.md` — read that too.

If anything in your module's `AGENT.md` conflicts with this file, this file wins. Flag the conflict to your human teammate instead of guessing.

---

## 1. What this project is

SecureCorp is a simulated enterprise file-sharing system built for a Cryptography & Network Security course exam (CE305 CNS, ISE 2 Applied Cryptography and Network Security Design Challenge). It is graded on: problem understanding, CNS-based design and implementation, evaluation/testing/documentation/GitHub, and a live demonstration.

**The core architectural idea:** all encryption, decryption, key generation, and signing happens client-side, in the browser, using the Web Crypto API. The server never sees plaintext and never holds a private key or a symmetric file key in unwrapped form. It only ever stores and moves ciphertext. This is the single most important property of the system — do not add any server-side decryption, server-side key generation on behalf of a user, or any endpoint that accepts a plaintext file or an unwrapped key. If a task seems to require that, stop and flag it instead of implementing it.

## 2. The demo (why the code needs to behave this way)

The system will be demonstrated live in 6 acts. Code should be written so each act works reliably, not just so a feature technically exists.

1. **Login/Identity** — user logs in, receives a ticket from Auth, browser has a CA-issued TLS cert in play.
2. **Key Setup** — each browser generates an asymmetric keypair via Web Crypto and publishes the public key to the server.
3. **Alice shares a file with Bob** — Alice's browser generates a random AES-GCM key, encrypts the file, wraps the AES key with Bob's public RSA-OAEP key, signs the package, and uploads only ciphertext + wrapped key + signature. Server stores it as-is.
4. **Wireshark capture** — an observer sniffing traffic sees only ciphertext and TLS handshake data, nothing readable.
5. **Mallory attacks** — a port scan / brute-force script hits the server; the IDS module detects it and the dashboard shows a live block.
6. **Eve is denied** — an unauthorized user is blocked two independent ways: RBAC rejects her at the API layer, AND even if that failed, there is no wrapped key on the server for her to decrypt the file with. Both mechanisms must work independently — don't let one silently depend on the other.

## 3. System architecture

- **Alice's laptop / Bob's laptop** — each runs the React frontend + crypto-core module in-browser. No private keys or symmetric keys ever leave the browser unencrypted.
- **Server** — three logical modules on one Flask backend: PKI/mini-CA, Authentication, Portal API (RBAC). Stores ciphertext only, in the database.
- **IDS** — monitors traffic to/from the server, runs a classifier, drives a live dashboard.
- **Mallory** — attacker, runs scripts against the server from a separate machine.
- **Eve** — unauthorized user, denied by RBAC + absence of a wrapped key.

## 4. Tech stack (locked — do not substitute)

- **Backend:** Python, Flask
- **Frontend:** React
- **Crypto:** Web Crypto API (`window.crypto.subtle`) in the browser. Do not use Node.js `crypto` or a Python crypto library for anything client-side — it must run in-browser via Web Crypto so the "server can't decrypt" property is real, not simulated.
- **Server-side crypto** (TLS cert handling, signature *verification* where needed) may use Python's `cryptography` library.
- **Database:** SQLite is sufficient for a demo. Store ciphertext, wrapped keys, signatures, and metadata only — never plaintext, never unwrapped keys.
- **Containerization:** Docker + docker-compose. Every service (backend, frontend, IDS dashboard) must run via `docker-compose up` with no manual setup steps beyond that.

## 5. Repo structure (monorepo)

```
securecorp/
├── PROJECT_CONTEXT.md          <- this file
├── docker-compose.yml
├── README.md
├── modules/
│   ├── crypto-core/
│   │   └── AGENT.md
│   ├── pki/
│   │   └── AGENT.md
│   ├── auth/
│   │   └── AGENT.md
│   ├── backend/
│   │   └── AGENT.md
│   ├── frontend/
│   │   └── AGENT.md
│   ├── ids/
│   │   └── AGENT.md
│   └── testing/
│       └── AGENT.md
└── shared/
    └── mocks/                  <- stub servers/functions other modules build against
```

Each module owns its folder. Do not write files into another module's folder — if you need something from another module, use its published interface (below) or its mock in `shared/mocks/`.

## 6. Module dependency map

Some modules are fully independent and can be built with zero mocking. Others depend on an interface from another module — in those cases, build against the mock in `shared/mocks/`, not the real thing.

| Module | Depends on | Dependency type |
|---|---|---|
| Crypto core | — | none, fully independent |
| PKI / mini-CA | — | none, fully independent |
| Authentication | PKI (cert validation) | mockable — stub `validate_cert()` |
| Backend / Portal API | Auth (ticket validation) | mockable — stub `validate_ticket()` |
| Backend / Portal API | Crypto core's data format | contract only — no runtime call, just needs the JSON shape below |
| Frontend | Crypto core (real, runs in-browser) | runtime call — use the real module, it's local JS |
| Frontend | Portal API | mockable — stub JSON responses matching the API contract below |
| IDS | Live traffic from Portal API | needed only for final validation — classifier/scripts can be built against synthetic/recorded traffic first |

**Rule:** if your module's `AGENT.md` says a dependency is mockable, do not block on the real module being finished. Use the stub, note it clearly in your code (`# MOCK — replace with real Auth module`), and move on.

## 7. Shared data formats (contracts — do not deviate)

These are the exact JSON shapes that cross module boundaries. Every module that produces or consumes these must match this exactly, field names included.

### 7.1 Encrypted file envelope
Produced by: Crypto core (Alice's browser). Consumed by: Backend (stores it), Frontend (Bob's browser, to decrypt).

```json
{
  "file_id": "uuid-string",
  "sender_id": "alice",
  "recipient_id": "bob",
  "ciphertext": "base64-encoded AES-GCM ciphertext",
  "iv": "base64-encoded 12-byte IV",
  "wrapped_key": "base64-encoded RSA-OAEP wrapped AES key",
  "signature": "base64-encoded RSA-PSS signature over ciphertext+iv",
  "filename": "original_filename.ext",
  "timestamp": "ISO-8601 string"
}
```

### 7.2 Ticket (Authentication)
Produced by: Auth module. Consumed by: Backend/Portal API (validates on every protected request).

```json
{
  "ticket": "opaque-signed-token-string",
  "user_id": "alice",
  "role": "employee | manager | admin",
  "issued_at": "ISO-8601 string",
  "expires_at": "ISO-8601 string"
}
```

### 7.3 Public key registration
Produced by: Crypto core (each browser, on Key Setup). Consumed by: Backend (stores it), PKI (may co-sign it).

```json
{
  "user_id": "bob",
  "public_key": "base64-encoded SPKI public key",
  "algorithm": "RSA-OAEP-2048 | ECDH-P256",
  "cert": "base64-encoded X.509 cert issued by mini-CA (optional if PKI not yet integrated)"
}
```

### 7.4 IDS alert
Produced by: IDS module. Consumed by: IDS dashboard (same module), optionally logged by Backend.

```json
{
  "alert_id": "uuid-string",
  "type": "port_scan | brute_force | other",
  "source_ip": "string",
  "severity": "low | medium | high",
  "detected_at": "ISO-8601 string",
  "action_taken": "blocked | flagged | none"
}
```

## 8. API contract (Portal API — Flask backend)

Base URL in dev: `http://localhost:5000/api`

| Method | Endpoint | Auth required | Purpose |
|---|---|---|---|
| POST | `/auth/login` | no | Returns a ticket (see 7.2) |
| POST | `/keys/register` | ticket | Registers a public key (see 7.3) |
| GET | `/keys/<user_id>` | ticket | Fetch a user's public key + cert |
| POST | `/files/upload` | ticket | Accepts an encrypted file envelope (see 7.1) |
| GET | `/files/<file_id>` | ticket | Returns an encrypted file envelope, only if caller is sender or recipient (RBAC-checked) |
| GET | `/files/inbox` | ticket | Lists file envelopes where caller is recipient |
| GET | `/ids/alerts` | ticket, admin role | Lists IDS alerts (see 7.4) |

**Auth header:** `Authorization: Bearer <ticket>` on every protected route.

**RBAC:** enforced in Portal API, not trusted from the client. A request for `/files/<file_id>` where the caller is neither sender nor recipient returns `403`, regardless of what the client claims. This is the Act 6 mechanism — it must be real, not cosmetic.

**Error format (all endpoints):**
```json
{ "error": "short_error_code", "message": "human readable message" }
```

## 9. Coding conventions

- **Branching:** feature branches per person, e.g. `feature/crypto-core-aes`. PR into `main`, one reviewer approval before merge. `main` should stay demo-runnable at all times.
- **Commits:** `[module] short description` (e.g. `[crypto-core] add AES-GCM encrypt function`). Commit under your own GitHub account — commit distribution across teammates is part of grading.
- **Env vars:** use `.env` files, never commit secrets. `.env.example` in each module folder shows required vars with dummy values.
- **Ports (dev defaults):** Flask backend `5000`, React frontend `3000`, IDS dashboard `5001`.
- **No plaintext or unwrapped keys ever touch the backend, the database, or a log file.** If you're debugging and need to print a key, delete the print statement before committing.

## 10. Integration checkpoints

Mocks get swapped for real modules at these points, one dependency at a time, so failures are traceable to a single seam:

1. **Checkpoint 1:** PKI's real `validate_cert()` replaces Auth's mock.
2. **Checkpoint 2:** Auth's real `validate_ticket()` replaces Portal API's mock.
3. **Checkpoint 3:** Portal API's real endpoints replace Frontend's mocked JSON responses.
4. **Checkpoint 4:** Full system up via docker-compose; IDS validated against real live traffic, including a real Mallory run.
5. **Full dry run:** all 6 acts, end to end, on the actual demo-day network setup.

## 11. GitHub requirements (graded)

- Repo is public.
- `README.md` at root: project overview, architecture diagram, setup/run instructions (`docker-compose up` should be close to the whole story), how to run the demo.
- Commits distributed across all teammates under their own accounts — no single-person dump at the end.
- `.gitignore` excludes `node_modules/`, `__pycache__/`, `.env`, any key material, `*.db`.
- Branch protection on `main` (require PR + 1 review).
