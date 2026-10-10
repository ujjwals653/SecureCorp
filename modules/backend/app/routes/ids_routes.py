"""
IDS alerts route.

GET /api/ids/alerts — list IDS alerts; requires ticket + admin role.

The IDS module owns alert generation.  This route simply surfaces
alerts that were logged to the shared DB (or optionally ingested from
the IDS module) — it does NOT run the classifier.
"""

from flask import Blueprint, jsonify

from app.helpers import require_auth, require_role
from app.database import get_db

ids_bp = Blueprint("ids", __name__)


@ids_bp.route("/alerts", methods=["GET"])
def get_alerts():
    """
    GET /api/ids/alerts
    Auth required: Bearer ticket with role = admin.
    Returns a list of IDS alerts matching PROJECT_CONTEXT.md §7.4.
    """
    claims, err = require_auth()
    if err:
        return err

    ok, err = require_role(claims, "admin")
    if not ok:
        return err

    db = get_db()
    try:
        rows = db.execute(
            """
            SELECT alert_id, type, source_ip, severity, detected_at, action_taken
            FROM ids_alerts
            ORDER BY detected_at DESC
            """,
        ).fetchall()
    finally:
        db.close()

    return jsonify([dict(row) for row in rows]), 200
