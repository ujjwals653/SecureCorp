"""
modules/auth/auth.py — Kerberos-style ticket authentication

Public interface (see AGENT.md):
    login(user_id, password) -> dict          # §7.2 ticket, or raises AuthError
    validate_ticket(ticket_str) -> dict|None  # decoded claims, or None if invalid/expired

Ticket signing:
    Tickets are HMAC-SHA256 signed so that any field tampering (e.g. changing
    role "employee" -> "admin") invalidates the signature.  The signing key is
    loaded from the environment variable AUTH_SECRET_KEY (or falls back to a
    dev-only hard-coded value that is intentionally NOT a secret — set the env
    var in production/.env).

PKI dependency:
    # MOCK — replace with real PKI module (modules/pki) at Integration Checkpoint 1
    from shared.mocks.mock_validate_cert import validate_cert
"""

import base64
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone, timedelta

# ---------------------------------------------------------------------------
# PKI dependency — MOCK until Integration Checkpoint 1
# ---------------------------------------------------------------------------
try:
    # Real swap: replace the import path below with the real PKI module
    # from modules.pki.pki import validate_cert
    from shared.mocks.mock_validate_cert import validate_cert  # MOCK
except ImportError:
    # Fallback stub so the module works standalone (e.g., during pytest without
    # the shared/ folder on the path — tests can patch this directly).
    def validate_cert(cert) -> bool:  # type: ignore[misc]
        """MOCK fallback — always returns True."""
        return True


# ---------------------------------------------------------------------------
# Signing key
# ---------------------------------------------------------------------------
_SIGNING_KEY: bytes = os.environ.get(
    "AUTH_SECRET_KEY",
    # DEV-ONLY default — never commit a real secret here.
    "dev-only-insecure-signing-key-replace-in-prod",
).encode()


# ---------------------------------------------------------------------------
# User table  (hardcoded for demo — passwords stored as SHA-256 hashes)
# ---------------------------------------------------------------------------
def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


_USERS: dict[str, dict] = {
    "alice": {"password_hash": _sha256("password123"), "role": "employee"},
    "bob":   {"password_hash": _sha256("password456"), "role": "employee"},
    "admin": {"password_hash": _sha256("adminpass"),   "role": "admin"},
}

# Ticket lifetime
_TICKET_TTL_SECONDS = 3600  # 1 hour


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class AuthError(Exception):
    """Raised by login() on invalid credentials or other auth failures."""

    def __init__(self, message: str, code: str = "auth_error"):
        super().__init__(message)
        self.message = message
        self.code = code


# ---------------------------------------------------------------------------
# Internal signing helpers
# ---------------------------------------------------------------------------

def _sign(payload: dict) -> str:
    """
    Return a URL-safe base64 encoded HMAC-SHA256 signature over the
    canonical JSON serialisation of payload (keys sorted, no whitespace).
    """
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    sig = hmac.new(_SIGNING_KEY, canonical.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode()


def _build_ticket_token(payload: dict) -> str:
    """
    Encode a signed ticket as:
        base64url(json(payload)) + "." + base64url(hmac)

    The two parts are separated by a "." so the token is a single opaque
    string that can be verified without a database round-trip.
    """
    header = base64.urlsafe_b64encode(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    sig = _sign(payload)
    return f"{header}.{sig}"


def _decode_and_verify_token(token: str) -> dict | None:
    """
    Decode a ticket token string produced by _build_ticket_token().
    Returns the payload dict if the signature is valid, else None.
    """
    try:
        header_b64, sig_b64 = token.rsplit(".", 1)
        # Restore padding
        padding = "=" * (4 - len(header_b64) % 4) if len(header_b64) % 4 else ""
        payload = json.loads(base64.urlsafe_b64decode(header_b64 + padding))
    except Exception:
        return None

    expected_sig = _sign(payload)
    if not hmac.compare_digest(sig_b64, expected_sig):
        return None  # tampered

    return payload


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def login(user_id: str, password: str, cert=None) -> dict:
    """
    Verify credentials and return a signed ticket matching PROJECT_CONTEXT.md §7.2.

    Args:
        user_id:  the user's identifier string
        password: plaintext password (compared against stored hash)
        cert:     optional client cert passed to validate_cert() (PKI integration)

    Returns:
        dict — ticket JSON matching §7.2 shape

    Raises:
        AuthError — on invalid credentials, unknown user, or bad cert
    """
    # Optional cert validation (PKI — mocked until Checkpoint 1)
    if cert is not None and not validate_cert(cert):
        raise AuthError("Client certificate validation failed", "invalid_cert")

    user = _USERS.get(user_id)
    if user is None or user["password_hash"] != _sha256(password):
        # Identical message for both cases — don't leak which is wrong
        raise AuthError("Invalid user_id or password", "invalid_credentials")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=_TICKET_TTL_SECONDS)

    payload = {
        "jti":        str(uuid.uuid4()),      # unique token ID (prevents replay)
        "user_id":    user_id,
        "role":       user["role"],
        "issued_at":  now.isoformat(),
        "expires_at": expires.isoformat(),
    }

    token = _build_ticket_token(payload)

    # Return shape matches PROJECT_CONTEXT.md §7.2 exactly
    return {
        "ticket":     token,
        "user_id":    user_id,
        "role":       user["role"],
        "issued_at":  now.isoformat(),
        "expires_at": expires.isoformat(),
    }


def validate_ticket(ticket_str: str) -> dict | None:
    """
    Validate a raw Bearer token string.

    Returns the decoded claims dict on success:
        { "ticket", "user_id", "role", "issued_at", "expires_at" }
    Returns None if the ticket is:
        - malformed / can't be decoded
        - signature invalid (tampered fields)
        - expired
        - issued for an unknown user
    """
    payload = _decode_and_verify_token(ticket_str)
    if payload is None:
        return None

    # Expiry check
    try:
        expires_at = datetime.fromisoformat(payload["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            return None  # expired
    except (KeyError, ValueError):
        return None

    # Sanity: user must still exist (protects against revoked-but-valid tokens)
    if payload.get("user_id") not in _USERS:
        return None

    # Re-expose the §7.2 shaped claims dict (ticket field = the original string)
    return {
        "ticket":     ticket_str,
        "user_id":    payload["user_id"],
        "role":       payload["role"],
        "issued_at":  payload["issued_at"],
        "expires_at": payload["expires_at"],
    }
