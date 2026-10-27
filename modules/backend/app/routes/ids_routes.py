"""
IDS alerts route.

GET /api/ids/alerts — list IDS alerts; requires ticket + admin role.

The IDS module owns alert generation. This route surfaces alerts
logged to the shared DB, or queries the live IDS dashboard service.
"""

import json
import os
import urllib.request

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
        alerts = [dict(row) for row in rows]
    finally:
        db.close()

    # If no DB alerts yet, query the live IDS dashboard service
    if not alerts:
        ids_alerts_url = os.environ.get("IDS_ALERTS_URL", "http://ids-dashboard:5001/api/alerts")
        try:
            req = urllib.request.Request(ids_alerts_url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    if isinstance(data, list):
                        alerts = data
        except Exception:
            pass

    return jsonify(alerts), 200
