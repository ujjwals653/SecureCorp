"""
MOCK — replace with real Auth module (modules/auth) at Integration Checkpoint 2.

validate_ticket() is the ONLY Auth dependency this module has.
It returns decoded ticket claims (dict) or None if the ticket is
invalid / expired / missing.

Ticket shape (PROJECT_CONTEXT.md §7.2):
{
  "ticket":     "opaque-signed-token-string",
  "user_id":    "alice",
  "role":       "employee | manager | admin",
  "issued_at":  "ISO-8601 string",
  "expires_at": "ISO-8601 string"
}
"""


# MOCK — replace with real Auth module (modules/auth) at Integration Checkpoint 2
def validate_ticket(ticket: str) -> dict | None:
    """
    Accept a raw Bearer token string and return the decoded claims,
    or None if the ticket is invalid or unrecognised.
    """
    MOCK_TICKETS = {
        "test-alice-ticket": {
            "ticket":     "test-alice-ticket",
            "user_id":    "alice",
            "role":       "employee",
            "issued_at":  "2026-10-10T00:00:00Z",
            "expires_at": "2099-12-31T23:59:59Z",
        },
        "test-bob-ticket": {
            "ticket":     "test-bob-ticket",
            "user_id":    "bob",
            "role":       "employee",
            "issued_at":  "2026-10-10T00:00:00Z",
            "expires_at": "2099-12-31T23:59:59Z",
        },
        "test-admin-ticket": {
            "ticket":     "test-admin-ticket",
            "user_id":    "admin",
            "role":       "admin",
            "issued_at":  "2026-10-10T00:00:00Z",
            "expires_at": "2099-12-31T23:59:59Z",
        },
    }
    return MOCK_TICKETS.get(ticket)
