"""DEV-ONLY throwaway Portal API stub (NOT part of the real system).

Exists for one reason: let Mallory's attack scripts be demoed end-to-end
BEFORE Backend's real Portal API server is ready. It mimics just enough
of the Portal API:

  GET  /                       -> 200 (server banner)
  GET  /api/files              -> 200 (empty list)
  GET  /api/files/<id>         -> 200
  GET  /api/users/me           -> 200 (stub user)
  GET  /api/share/<token>      -> 200
  POST /api/auth/login         -> 401 (bad creds) / 200 (demo creds only)
  anything else                 -> 404 JSON (this is what makes port
                                   scans visible: 20 bogus paths = 20 404s)

Every request is converted to a log entry
{source_ip, endpoint, method, status_code, timestamp} and:
  1. fed to the local detector via ingest_log_entry(), and
  2. forwarded to the live dashboard's POST /api/ingest (default
     http://127.0.0.1:5001/api/ingest) so the dashboard flags it live.

Standalone run (from repo root):
    python modules/ids/dev_target_stub.py            # target = localhost:5000
    python modules/ids/dev_target_stub.py --port 5000 --dashboard-url http://127.0.0.1:5001/api/ingest

DELETE or stop using this the moment Backend's real server exists —
at Integration Checkpoint 4 Mallory re-runs against the real server
(see modules/ids/README.md). Touches modules/ids/ only.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone

_THIS_FILE = pathlib.Path(__file__).resolve()
REPO_ROOT = _THIS_FILE
for parent in _THIS_FILE.parents:
    if (parent / "shared" / "mocks" / "synthetic_traffic.py").exists():
        REPO_ROOT = parent
        break
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
_IDS_DIR = _THIS_FILE.parent
if str(_IDS_DIR) not in sys.path:
    sys.path.insert(0, str(_IDS_DIR))

try:
    import detector as engine  # running inside modules/ids/
except ImportError:  # running from repo root
    from modules.ids import detector as engine

from flask import Flask, jsonify, request

app = Flask(__name__)
FORWARD_URL = "http://127.0.0.1:5001/api/ingest"
DO_LOCAL = True
DO_FORWARD = True

# One documented demo credential so a "good login" path exists; everything
# else 401s (which is exactly what Mallory's brute-force needs).
DEMO_USER = "alice"
DEMO_PASS = "wonderland-demo"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _forward(entry: dict) -> None:
    try:
        data = json.dumps(entry).encode("utf-8")
        req = urllib.request.Request(
            FORWARD_URL, data=data,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as exc:  # noqa: BLE001 — forwarding must never break the stub
        print(f"[stub] forward to dashboard failed ({exc}); "
              f"is dashboard.py running on 5001?")


@app.after_request
def _log_to_ids(response):
    entry = {
        "source_ip": request.remote_addr or "unknown",
        "endpoint": request.path,
        "method": request.method,
        "status_code": response.status_code,
        "timestamp": _now_iso(),
    }
    if DO_LOCAL:
        engine.ingest_log_entry(entry)
    if DO_FORWARD:
        _forward(entry)
    return response


@app.get("/")
def root():
    return jsonify({"service": "DEV-STUB portal api (not the real backend)"})


@app.get("/api/files")
def files():
    return jsonify({"files": []})


@app.get("/api/files/<file_id>")
def file_by_id(file_id: str):
    return jsonify({"id": file_id, "ciphertext": "stub-only"})


@app.get("/api/users/me")
def me():
    return jsonify({"username": "alice"})


@app.get("/api/share/<token>")
def share(token: str):
    return jsonify({"token": token})


@app.post("/api/auth/login")
def login():
    body = request.get_json(force=True, silent=True) or {}
    if body.get("username") == DEMO_USER and body.get("password") == DEMO_PASS:
        return jsonify({"ticket": "dev-stub-ticket"}), 200
    return jsonify({"error": "invalid credentials (dev stub)"}), 401


@app.errorhandler(404)
def not_found(_err):
    return jsonify({"error": "not found (dev stub)"}), 404


def main() -> None:
    global FORWARD_URL, DO_LOCAL, DO_FORWARD
    parser = argparse.ArgumentParser(description="DEV-ONLY stub Portal API (demo target)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--dashboard-url", default=FORWARD_URL)
    parser.add_argument("--no-forward", action="store_true",
                        help="don't forward log entries to the dashboard")
    parser.add_argument("--no-local", action="store_true",
                        help="don't feed the local detector copy")
    args = parser.parse_args()
    FORWARD_URL = args.dashboard_url
    DO_FORWARD = not args.no_forward
    DO_LOCAL = not args.no_local
    print("[stub] DEV-ONLY stub Portal API (NOT the real backend) on "
          f"http://{args.host}:{args.port}")
    print(f"[stub] Forwarding hits to dashboard ingest: "
          f"{FORWARD_URL if DO_FORWARD else 'disabled'}")
    app.run(host=args.host, port=args.port, use_reloader=False)


if __name__ == "__main__":
    main()
