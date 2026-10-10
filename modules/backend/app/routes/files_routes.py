"""
File upload, download, and inbox routes.

POST /api/files/upload       — store an encrypted file envelope (§7.1)
GET  /api/files/inbox        — list envelopes where caller is recipient
GET  /api/files/<file_id>    — retrieve an envelope (RBAC: sender or recipient only)

IMPORTANT: /inbox MUST be declared before /<file_id> so Flask does not
greedily match the literal string "inbox" as a file_id parameter.

RBAC on GET /files/<file_id> is the Act 6 mechanism — it is real
server-side enforcement, NOT a client-side check.
"""

import uuid
from flask import Blueprint, request, jsonify

from app.helpers import require_auth, error
from app.database import get_db

files_bp = Blueprint("files", __name__)

# Exact required fields from the encrypted file envelope contract (§7.1)
REQUIRED_ENVELOPE_FIELDS = {
    "sender_id",
    "recipient_id",
    "ciphertext",
    "iv",
    "wrapped_key",
    "signature",
    "filename",
    "timestamp",
}


@files_bp.route("/upload", methods=["POST"])
def upload_file():
    """
    POST /api/files/upload
    Auth required: Bearer ticket.
    Body: encrypted file envelope (PROJECT_CONTEXT.md §7.1).
    Stores the envelope exactly as-is (ciphertext only — no decryption ever).
    """
    claims, err = require_auth()
    if err:
        return err

    data = request.get_json(silent=True)
    if not data:
        return error("bad_request", "Request body must be JSON", 400)

    # Validate all required envelope fields are present
    missing = REQUIRED_ENVELOPE_FIELDS - data.keys()
    if missing:
        return error(
            "malformed_envelope",
            f"Missing required envelope fields: {', '.join(sorted(missing))}",
            400,
        )

    # Sender in ticket must match sender_id in envelope
    if data["sender_id"] != claims["user_id"]:
        return error(
            "forbidden",
            "sender_id in envelope does not match authenticated user",
            403,
        )

    # Use the client-provided file_id if present, otherwise generate one
    file_id = data.get("file_id") or str(uuid.uuid4())

    db = get_db()
    try:
        existing = db.execute(
            "SELECT file_id FROM files WHERE file_id = ?", (file_id,)
        ).fetchone()
        if existing:
            return error("conflict", f"File with id '{file_id}' already exists", 409)

        db.execute(
            """
            INSERT INTO files
                (file_id, sender_id, recipient_id, ciphertext, iv,
                 wrapped_key, signature, filename, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file_id,
                data["sender_id"],
                data["recipient_id"],
                data["ciphertext"],   # base64 AES-GCM ciphertext — stored as-is
                data["iv"],           # base64 IV — stored as-is
                data["wrapped_key"],  # base64 wrapped AES key — stored as-is
                data["signature"],    # base64 RSA-PSS signature — stored as-is
                data["filename"],
                data["timestamp"],
            ),
        )
        db.commit()
    finally:
        db.close()

    return jsonify({"file_id": file_id, "status": "stored"}), 201


# NOTE: /inbox MUST stay above /<file_id> — Flask resolves routes in
# declaration order and would otherwise capture 'inbox' as a file_id.
@files_bp.route("/inbox", methods=["GET"])
def inbox():
    """
    GET /api/files/inbox
    Auth required: Bearer ticket.
    Returns list of envelope metadata where caller is the recipient.
    """
    claims, err = require_auth()
    if err:
        return err

    db = get_db()
    try:
        rows = db.execute(
            """
            SELECT file_id, sender_id, recipient_id, filename, timestamp
            FROM files
            WHERE recipient_id = ?
            ORDER BY timestamp DESC
            """,
            (claims["user_id"],),
        ).fetchall()
    finally:
        db.close()

    return jsonify([dict(row) for row in rows]), 200


@files_bp.route("/<file_id>", methods=["GET"])
def get_file(file_id: str):
    """
    GET /api/files/<file_id>
    Auth required: Bearer ticket.

    RBAC (Act 6 mechanism):
      Returns 403 if the authenticated caller is NEITHER the sender NOR the recipient.
      This check is performed server-side against the stored record — the client
      cannot influence this decision. Even if RBAC is the only layer that failed,
      Eve still cannot decrypt because there is no wrapped key for her on the server.

    Returns the full encrypted envelope (§7.1) on success.
    """
    claims, err = require_auth()
    if err:
        return err

    db = get_db()
    try:
        row = db.execute(
            "SELECT * FROM files WHERE file_id = ?", (file_id,)
        ).fetchone()
    finally:
        db.close()

    if row is None:
        return error("not_found", f"File '{file_id}' not found", 404)

    caller = claims["user_id"]
    # --- Act 6 RBAC gate --- real server-side check, not cosmetic ---
    if caller != row["sender_id"] and caller != row["recipient_id"]:
        return error(
            "forbidden",
            "You are not authorised to access this file",
            403,
        )

    # Return the full envelope exactly matching §7.1
    return jsonify({
        "file_id":      row["file_id"],
        "sender_id":    row["sender_id"],
        "recipient_id": row["recipient_id"],
        "ciphertext":   row["ciphertext"],
        "iv":           row["iv"],
        "wrapped_key":  row["wrapped_key"],
        "signature":    row["signature"],
        "filename":     row["filename"],
        "timestamp":    row["timestamp"],
    }), 200
