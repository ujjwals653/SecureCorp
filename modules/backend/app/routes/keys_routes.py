"""
Key registration and retrieval routes.

POST /api/keys/register   — store a user's public key (§7.3)
GET  /api/keys/<user_id>  — fetch a user's public key + cert
"""

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from app.helpers import require_auth, error
from app.database import get_db

keys_bp = Blueprint("keys", __name__)

# Required fields for a public key registration payload (§7.3)
REQUIRED_KEY_FIELDS = {"user_id", "public_key", "algorithm"}
VALID_ALGORITHMS = {"RSA-OAEP-2048", "ECDH-P256"}


@keys_bp.route("/register", methods=["POST"])
def register_key():
    """
    POST /api/keys/register
    Auth required: Bearer ticket.
    Body: public key registration JSON (§7.3).
    Stores the key; rejects malformed payloads.
    """
    claims, err = require_auth()
    if err:
        return err

    data = request.get_json(silent=True)
    if not data:
        return error("bad_request", "Request body must be JSON", 400)

    missing = REQUIRED_KEY_FIELDS - data.keys()
    if missing:
        return error("bad_request", f"Missing required fields: {', '.join(missing)}", 400)

    if data["algorithm"] not in VALID_ALGORITHMS:
        return error(
            "bad_request",
            f"algorithm must be one of: {', '.join(VALID_ALGORITHMS)}",
            400,
        )

    # A user may only register their own key
    if data["user_id"] != claims["user_id"]:
        return error("forbidden", "You may only register keys for your own user_id", 403)

    now = datetime.now(timezone.utc).isoformat()

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO public_keys (user_id, public_key, algorithm, cert, registered_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                public_key    = excluded.public_key,
                algorithm     = excluded.algorithm,
                cert          = excluded.cert,
                registered_at = excluded.registered_at
            """,
            (
                data["user_id"],
                data["public_key"],
                data["algorithm"],
                data.get("cert"),          # optional
                now,
            ),
        )
        db.commit()
    finally:
        db.close()

    return jsonify({
        "status": "registered",
        "user_id": data["user_id"],
        "registered_at": now,
    }), 201


@keys_bp.route("/<user_id>", methods=["GET"])
def get_key(user_id: str):
    """
    GET /api/keys/<user_id>
    Auth required: Bearer ticket.
    Returns the user's public key + cert matching §7.3 shape.
    """
    claims, err = require_auth()
    if err:
        return err

    db = get_db()
    try:
        row = db.execute(
            "SELECT user_id, public_key, algorithm, cert FROM public_keys WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    finally:
        db.close()

    if row is None:
        return error("not_found", f"No public key registered for user '{user_id}'", 404)

    return jsonify({
        "user_id":    row["user_id"],
        "public_key": row["public_key"],
        "algorithm":  row["algorithm"],
        "cert":       row["cert"],
    }), 200
