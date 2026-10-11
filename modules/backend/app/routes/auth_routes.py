"""
POST /api/auth/login

This route is a THIN PROXY to the Auth module.
Backend itself does NOT issue tickets — it delegates to Auth.

For the current mock phase, it accepts the mock credentials and
returns a mock ticket matching PROJECT_CONTEXT.md §7.2 exactly.

MOCK — replace with real Auth module call at Integration Checkpoint 2.
"""

from flask import Blueprint, request, jsonify

auth_bp = Blueprint("auth", __name__)


# MOCK user table — replace with real Auth module at Integration Checkpoint 2
MOCK_USERS = {
    "alice": "password123",
    "bob":   "password456",
    "admin": "adminpass",
}

MOCK_TICKET_MAP = {
    "alice": "test-alice-ticket",
    "bob":   "test-bob-ticket",
    "admin": "test-admin-ticket",
}

MOCK_ROLE_MAP = {
    "alice": "employee",
    "bob":   "employee",
    "admin": "admin",
}


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    Body: { "user_id": "alice", "password": "password123" }
    Returns: ticket JSON (§7.2) or 401 error.
    No auth required on this endpoint.
    """
    data = request.get_json(silent=True)
    if not data or "user_id" not in data or "password" not in data:
        return jsonify({
            "error": "bad_request",
            "message": "user_id and password are required"
        }), 400

    user_id  = data["user_id"]
    password = data["password"]

    if MOCK_USERS.get(user_id) != password:
        return jsonify({
            "error": "invalid_credentials",
            "message": "Invalid user_id or password"
        }), 401

    # MOCK — replace with real Auth module (modules/auth) at Integration Checkpoint 2
    ticket_response = {
        "ticket":     MOCK_TICKET_MAP[user_id],
        "user_id":    user_id,
        "role":       MOCK_ROLE_MAP[user_id],
        "issued_at":  "2026-10-10T00:00:00Z",
        "expires_at": "2099-12-31T23:59:59Z",
    }
    return jsonify(ticket_response), 200
