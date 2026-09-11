# shared/mocks

Stub implementations that let each module be built and tested without waiting on another module to finish. See PROJECT_CONTEXT.md §6 for the full dependency map and §10 for when each mock gets swapped for the real thing.

| File | Stands in for | Used by | Swapped at |
|---|---|---|---|
| `mock_validate_cert.py` | PKI's `validate_cert()` | Auth | Checkpoint 1 |
| `mock_validate_ticket.py` | Auth's `validate_ticket()` | Backend | Checkpoint 2 |
| `sample_envelope.json` | A real Crypto Core output | Backend (own tests) | Checkpoint 3 (real envelopes flow in from the browser) |
| `mock_portal_api.js` | Backend's REST API | Frontend | Checkpoint 3 |
| `synthetic_traffic.py` | Live server traffic | IDS | Checkpoint 4 |

**Rules for using these:**
- Import from here directly — don't copy-paste the code elsewhere, so there's one source of truth.
- Every call site using a mock should have a `# MOCK — replace with real X at Checkpoint N` comment, so it's grep-able when it's time to swap.
- If a mock's shape stops matching the real module being built (e.g. Backend changes a field name), update the mock here and flag it to whoever's building against it — don't let them silently drift apart.
- These mocks are for development speed, not for the actual demo. By the full dry run (PROJECT_CONTEXT.md §10), nothing here should still be in the live code path.
