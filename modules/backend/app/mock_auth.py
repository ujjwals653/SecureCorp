"""
Integration Checkpoint 2 — Auth module wired in.

validate_ticket() now delegates to the real modules/auth implementation.
The old hardcoded MOCK_TICKETS table has been retired.

Ticket shape (PROJECT_CONTEXT.md §7.2):
{
  "ticket":     "opaque-signed-token-string",
  "user_id":    "alice",
  "role":       "employee | manager | admin",
  "issued_at":  "ISO-8601 string",
  "expires_at": "ISO-8601 string"
}

Next swap: Integration Checkpoint 1 — replace shared.mocks.mock_validate_cert
with the real PKI module inside modules/auth/auth.py.
"""

import sys
import os

# Ensure repo root is on the path so modules/auth resolves correctly
_REPO_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from modules.auth.auth import validate_ticket  # Real Auth module

__all__ = ["validate_ticket"]
