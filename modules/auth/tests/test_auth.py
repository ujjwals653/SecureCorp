"""
modules/auth/tests/test_auth.py — Standalone tests for the Auth module.

All tests run using the mocked validate_cert() — no real PKI module required.

Run with:
    cd modules/auth
    pytest tests/ -v
"""

import json
import base64
import pytest
import sys
import os

# ---------------------------------------------------------------------------
# Make the shared mock importable when running pytest from modules/auth/
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..")
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from modules.auth.auth import login, validate_ticket, AuthError, _build_ticket_token


# ===========================================================================
# 1. login() — success cases
# ===========================================================================

class TestLoginSuccess:
    def test_alice_returns_ticket(self):
        ticket = login("alice", "password123")
        assert ticket["user_id"] == "alice"
        assert ticket["role"] == "employee"
        assert "ticket" in ticket
        assert "issued_at" in ticket
        assert "expires_at" in ticket

    def test_bob_returns_ticket(self):
        ticket = login("bob", "password456")
        assert ticket["user_id"] == "bob"
        assert ticket["role"] == "employee"

    def test_admin_returns_admin_role(self):
        ticket = login("admin", "adminpass")
        assert ticket["user_id"] == "admin"
        assert ticket["role"] == "admin"

    def test_ticket_shape_matches_spec(self):
        """Ticket must have exactly the §7.2 fields and no fewer."""
        ticket = login("alice", "password123")
        required_fields = {"ticket", "user_id", "role", "issued_at", "expires_at"}
        assert required_fields.issubset(ticket.keys())

    def test_each_login_produces_unique_ticket(self):
        t1 = login("alice", "password123")
        t2 = login("alice", "password123")
        assert t1["ticket"] != t2["ticket"]  # jti ensures uniqueness


# ===========================================================================
# 2. login() — failure cases
# ===========================================================================

class TestLoginFailure:
    def test_wrong_password_raises_auth_error(self):
        with pytest.raises(AuthError) as exc:
            login("alice", "wrongpassword")
        assert exc.value.code == "invalid_credentials"

    def test_unknown_user_raises_auth_error(self):
        with pytest.raises(AuthError) as exc:
            login("eve", "anything")
        assert exc.value.code == "invalid_credentials"

    def test_empty_password_raises_auth_error(self):
        with pytest.raises(AuthError):
            login("alice", "")

    def test_empty_user_id_raises_auth_error(self):
        with pytest.raises(AuthError):
            login("", "password123")

    def test_bad_cert_raises_auth_error(self):
        """If a cert is provided but invalid, login must fail."""
        import modules.auth.auth as auth_module
        original = auth_module.validate_cert
        auth_module.validate_cert = lambda cert: False
        try:
            with pytest.raises(AuthError) as exc:
                login("alice", "password123", cert="bad-cert")
            assert exc.value.code == "invalid_cert"
        finally:
            auth_module.validate_cert = original

    def test_valid_cert_does_not_block_login(self):
        """cert=None (no cert presented) must not block a valid login."""
        ticket = login("alice", "password123", cert=None)
        assert ticket["user_id"] == "alice"


# ===========================================================================
# 3. validate_ticket() — success cases
# ===========================================================================

class TestValidateTicketSuccess:
    def test_freshly_issued_ticket_is_valid(self):
        ticket_data = login("alice", "password123")
        claims = validate_ticket(ticket_data["ticket"])
        assert claims is not None
        assert claims["user_id"] == "alice"
        assert claims["role"] == "employee"

    def test_validate_returns_correct_shape(self):
        ticket_data = login("bob", "password456")
        claims = validate_ticket(ticket_data["ticket"])
        required_fields = {"ticket", "user_id", "role", "issued_at", "expires_at"}
        assert required_fields.issubset(claims.keys())

    def test_validate_ticket_field_matches_input(self):
        ticket_data = login("alice", "password123")
        claims = validate_ticket(ticket_data["ticket"])
        assert claims["ticket"] == ticket_data["ticket"]


# ===========================================================================
# 4. validate_ticket() — failure / tamper cases
# ===========================================================================

class TestValidateTicketFailure:
    def test_random_string_returns_none(self):
        assert validate_ticket("not-a-real-ticket") is None

    def test_empty_string_returns_none(self):
        assert validate_ticket("") is None

    def test_tampered_role_returns_none(self):
        """
        Decode the payload, change role to 'admin', re-encode the header —
        but leave the signature from the original token.  Must be rejected.

        This is the Act-6 critical test: Mallory forging admin role must not work.
        """
        ticket_data = login("alice", "password123")
        token = ticket_data["ticket"]
        header_b64, original_sig = token.rsplit(".", 1)

        # Decode header
        padding = "=" * (4 - len(header_b64) % 4) if len(header_b64) % 4 else ""
        payload = json.loads(base64.urlsafe_b64decode(header_b64 + padding))

        # Tamper role
        payload["role"] = "admin"

        # Re-encode header with tampered payload, keep old signature
        new_header = base64.urlsafe_b64encode(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).decode().rstrip("=")
        tampered_token = f"{new_header}.{original_sig}"

        assert validate_ticket(tampered_token) is None

    def test_tampered_user_id_returns_none(self):
        """Changing user_id should invalidate the signature."""
        ticket_data = login("alice", "password123")
        token = ticket_data["ticket"]
        header_b64, original_sig = token.rsplit(".", 1)

        padding = "=" * (4 - len(header_b64) % 4) if len(header_b64) % 4 else ""
        payload = json.loads(base64.urlsafe_b64decode(header_b64 + padding))
        payload["user_id"] = "admin"

        new_header = base64.urlsafe_b64encode(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).decode().rstrip("=")
        tampered_token = f"{new_header}.{original_sig}"

        assert validate_ticket(tampered_token) is None

    def test_expired_ticket_returns_none(self):
        """Build a token with expires_at in the past — must be rejected."""
        payload = {
            "jti":        "test-expired",
            "user_id":    "alice",
            "role":       "employee",
            "issued_at":  "2020-01-01T00:00:00+00:00",
            "expires_at": "2020-01-01T01:00:00+00:00",  # well in the past
        }
        token = _build_ticket_token(payload)
        assert validate_ticket(token) is None

    def test_wrong_signature_returns_none(self):
        """Strip real sig, attach garbage."""
        ticket_data = login("alice", "password123")
        token = ticket_data["ticket"]
        header_b64, _ = token.rsplit(".", 1)
        bad_sig = base64.urlsafe_b64encode(b"garbage-sig").decode()
        assert validate_ticket(f"{header_b64}.{bad_sig}") is None

    def test_unknown_user_in_valid_token_returns_none(self):
        """Even a perfectly signed token for a non-existent user must be rejected."""
        from datetime import datetime, timezone, timedelta

        payload = {
            "jti":        "test-unknown",
            "user_id":    "mallory",
            "role":       "admin",
            "issued_at":  datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        }
        token = _build_ticket_token(payload)
        assert validate_ticket(token) is None
