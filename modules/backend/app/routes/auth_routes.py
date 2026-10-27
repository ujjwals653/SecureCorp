"""
POST /api/auth/login

This route is a thin proxy to the Auth module.
Backend itself does NOT issue tickets — it delegates to modules/auth/auth.login().

Integration Checkpoint 2 complete: wired to real Auth module.
Next: Integration Checkpoint 1 — swap PKI mock inside modules/auth/auth.py.
"""

import sys
import os

from flask import Blueprint, request, jsonify

# Ensure repo root is on the path so modules/auth resolves correctly
_REPO_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from modules.auth.auth import login as auth_login, AuthError  # Real Auth module

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    Body: { "user_id": "alice", "password": "password123" }
    Returns: ticket JSON (§7.2) or 401 / 400 error.
    No auth required on this endpoint.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id") or data.get("username")
    password = data.get("password")
    if not user_id or not password:
        return jsonify({
            "error": "bad_request",
            "message": "user_id and password are required"
        }), 400

    try:
        ticket_response = auth_login(user_id, password)
        return jsonify(ticket_response), 200
    except AuthError as e:
        status = 400 if e.code not in ("invalid_credentials", "invalid_cert") else 401
        return jsonify({"error": e.code, "message": e.message}), status
    except Exception:
        return jsonify({"error": "internal_error", "message": "Authentication service error"}), 500
