"""
SecureCorp Backend — Flask application factory.
"""

import json
import os
import threading
import urllib.request
from datetime import datetime, timezone

from flask import Flask, request, jsonify
from flask_cors import CORS

from .database import init_db
from .routes.auth_routes import auth_bp
from .routes.keys_routes import keys_bp
from .routes.files_routes import files_bp
from .routes.ids_routes import ids_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Initialise the SQLite database
    init_db()

    # Register blueprints under /api prefix
    app.register_blueprint(auth_bp,   url_prefix="/api/auth")
    app.register_blueprint(keys_bp,   url_prefix="/api/keys")
    app.register_blueprint(files_bp,  url_prefix="/api/files")
    app.register_blueprint(ids_bp,    url_prefix="/api/ids")

    # IDS integration URLs
    ids_ingest_url = os.environ.get("IDS_INGEST_URL", "http://ids-dashboard:5001/api/ingest")
    ids_blocked_url = os.environ.get("IDS_BLOCKED_URL", "http://ids-dashboard:5001/api/blocked")
    _blocked_cache = {"ips": set(), "last_check": 0.0}

    @app.before_request
    def check_ids_block():
        """Check if incoming request IP is blocked by the IDS firewall."""
        if request.path.startswith("/api/ids") or not ids_blocked_url:
            return None

        now = datetime.now(timezone.utc).timestamp()
        if now - _blocked_cache["last_check"] > 1.0:
            try:
                req = urllib.request.Request(ids_blocked_url, headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=0.5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        _blocked_cache["ips"] = set(data.get("blocked_ips", []))
                        _blocked_cache["last_check"] = now
            except Exception:
                pass

        forwarded = request.headers.get("X-Forwarded-For")
        source_ip = forwarded.split(",")[0].strip() if forwarded else (request.remote_addr or "127.0.0.1")

        if source_ip in _blocked_cache["ips"]:
            return jsonify({
                "error": "ip_blocked",
                "message": f"Access denied: IP {source_ip} is blocked by IDS firewall"
            }), 403

    @app.after_request
    def log_request_to_ids(response):
        """Forward request metadata to the IDS detector so attacks are caught live."""
        if request.path.startswith("/api/ids") or not ids_ingest_url:
            return response

        # Use X-Forwarded-For if available, otherwise remote_addr
        forwarded = request.headers.get("X-Forwarded-For")
        source_ip = forwarded.split(",")[0].strip() if forwarded else (request.remote_addr or "127.0.0.1")

        entry = {
            "source_ip": source_ip,
            "endpoint": request.path,
            "method": request.method,
            "status_code": response.status_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        def _forward():
            try:
                data = json.dumps(entry).encode("utf-8")
                req = urllib.request.Request(
                    ids_ingest_url,
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=1):
                    pass
            except Exception:
                pass

        threading.Thread(target=_forward, daemon=True).start()
        return response

    return app
