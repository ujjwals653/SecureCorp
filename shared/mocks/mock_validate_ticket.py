"""
MOCK — Auth ticket validation stub.

Real module: modules/auth (see modules/auth/AGENT.md)
Used by: modules/backend, on every protected route, until Integration Checkpoint 2.

Swap instructions:
  Replace this import:
      from shared.mocks.mock_validate_ticket import validate_ticket
  with:
      from modules.auth.auth import validate_ticket
  No other code should need to change if modules/auth exposes the same
  function signature described in modules/auth/AGENT.md.

Test tickets below are hardcoded so Backend can exercise both a valid
session and an RBAC-relevant role without depending on real Auth.
"""

_MOCK_TICKETS = {
    "test-alice-ticket": {"user_id": "alice", "role": "employee"},
    "test-bob-ticket": {"user_id": "bob", "role": "employee"},
    "test-admin-ticket": {"user_id": "admin", "role": "admin"},
}


def validate_ticket(ticket: str):
    """
    MOCK. Looks up ticket in a hardcoded dict instead of verifying a
    real signed token. Returns decoded claims dict, or None if invalid.

    Real implementation (modules/auth) must verify a cryptographic
    signature and check expiry — do not treat this mock's "validity"
    as meaningful for anything beyond local development.
    """
    return _MOCK_TICKETS.get(ticket)
