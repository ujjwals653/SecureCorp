"""
Shared helper utilities used across all route blueprints.
"""

from flask import request, jsonify
from .mock_auth import validate_ticket   # MOCK — swap at Integration Checkpoint 2


def require_auth():
    """
    Extract and validate the Bearer ticket from the Authorization header.

    Returns (claims_dict, None) on success.
    Returns (None, error_response) on failure — the caller must `return` that response.

    Usage in a route:
        claims, err = require_auth()
        if err:
            return err
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, (
            jsonify({"error": "missing_token", "message": "Authorization header missing or malformed"}),
            401,
        )

    ticket = auth_header[len("Bearer "):]
    claims = validate_ticket(ticket)
    if claims is None:
        return None, (
            jsonify({"error": "invalid_token", "message": "Ticket is invalid or expired"}),
            401,
        )

    return claims, None


def require_role(claims: dict, *roles: str):
    """
    Check that the authenticated user has one of the required roles.

    Returns (True, None) if the role is permitted.
    Returns (False, error_response) otherwise.
    """
    if claims.get("role") not in roles:
        return False, (
            jsonify({"error": "forbidden", "message": "Insufficient role for this resource"}),
            403,
        )
    return True, None


def error(code: str, message: str, status: int):
    """Standardised error response (PROJECT_CONTEXT.md §8)."""
    return jsonify({"error": code, "message": message}), status
