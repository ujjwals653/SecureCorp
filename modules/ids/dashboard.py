"""SecureCorp IDS — Phase 2 live dashboard (Flask, port 5001).

Standalone run (from repo root):
    python modules/ids/dashboard.py
Or (from inside modules/ids/):
    python dashboard.py

What it does:
  - Serves a live HTML dashboard polling /api/alerts + /api/blocked
    every 1.5s (no websockets).
  - POST /api/ingest accepts one log entry -> detector.ingest_log_entry().
  - POST /api/demo/start streams shared/mocks/synthetic_traffic.py
    entries in-process so the dashboard visibly updates with no backend.
  - POST /api/demo/reset clears detector state.

Reads detection state only via the Phase-1 interface:
  ingest_log_entry(), get_alerts(), is_blocked(), reset().
Does NOT change detector.py logic or thresholds.
"""

from __future__ import annotations

import argparse
import pathlib
import sys
import threading
import time

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

try:
    from shared.mocks.synthetic_traffic import generate_synthetic_traffic
except ImportError:  # pragma: no cover — fallback for odd path setups
    from synthetic_traffic import generate_synthetic_traffic  # type: ignore[no-redef]

from flask import Flask, jsonify, request

app = Flask(__name__)

HOST = "127.0.0.1"
PORT = 5001
POLL_MS = 1500

_demo_thread: threading.Thread | None = None
_demo_lock = threading.Lock()
_demo_running = False


PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SecureCorp IDS - Live Dashboard</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: Consolas, Menlo, monospace; background: #0d1117; color: #e6edf3; margin: 0; padding: 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .sub { color: #8b949e; margin-bottom: 16px; font-size: 13px; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px 16px; min-width: 180px; }
  .card .label { color: #8b949e; font-size: 12px; }
  .card .value { font-size: 24px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border-radius: 8px; overflow: hidden; }
  th, td { padding: 8px 12px; border-bottom: 1px solid #30363d; text-align: left; font-size: 13px; }
  th { color: #8b949e; font-weight: normal; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; }
  .sev-low { background: #1a472a; color: #7ee787; }
  .sev-medium { background: #4d3a00; color: #f0b72f; }
  .sev-high { background: #5a1f1f; color: #ff7b72; }
  .act-blocked { background: #5a1f1f; color: #ff7b72; }
  .act-flagged { background: #4d3a00; color: #f0b72f; }
  .act-none { background: #30363d; color: #e6edf3; }
  .blocked-ip { background: #5a1f1f; color: #ffb3ab; border: 1px solid #ff7b72; border-radius: 6px; padding: 4px 10px; margin: 2px 4px 2px 0; display: inline-block; font-size: 13px; }
  .ok-ip { background: #1a472a; color: #7ee787; border: 1px solid #2ea043; border-radius: 6px; padding: 4px 10px; margin: 2px 4px 2px 0; display: inline-block; font-size: 13px; }
  button { background: #238636; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 13px; margin-right: 8px; }
  button.secondary { background: #30363d; }
  #status { color: #8b949e; font-size: 12px; margin-top: 12px; }
  .empty { color: #8b949e; padding: 16px; text-align: center; }
</style>
</head>
<body>
<h1>SecureCorp IDS &mdash; Live Dashboard</h1>
<div class="sub">Port-scan + brute-force detection &middot; polling every 1.5s &middot; port 5001</div>
<div class="row">
  <div class="card"><div class="label">Total alerts</div><div class="value" id="stat-total">0</div></div>
  <div class="card"><div class="label">Port scans</div><div class="value" id="stat-scan">0</div></div>
  <div class="card"><div class="label">Brute-force</div><div class="value" id="stat-brute">0</div></div>
  <div class="card"><div class="label">Blocked IPs</div><div class="value" id="stat-blocked">0</div></div>
</div>
<div style="margin-bottom:16px">
  <button onclick="startDemo()">Start demo traffic</button>
  <button class="secondary" onclick="resetDemo()">Reset</button>
</div>
<h3>Alerts</h3>
<table>
  <thead><tr><th>Type</th><th>Source IP</th><th>Severity</th><th>Detected at</th><th>Action</th></tr></thead>
  <tbody id="alerts-body"><tr><td colspan="5" class="empty">No alerts yet - start demo traffic.</td></tr></tbody>
</table>
<h3>Blocked IPs <span style="color:#8b949e;font-size:12px">(is_blocked() per alert IP)</span></h3>
<div id="blocked-panel"><span style="color:#8b949e">None blocked yet.</span></div>
<div id="status">Last update: never</div>
<script>
const POLL_MS = 1500;
async function refresh() {
  try {
    const [aRes, bRes] = await Promise.all([
      fetch('/api/alerts'), fetch('/api/blocked')
    ]);
    const alerts = await aRes.json();
    const blocked = await bRes.json();
    renderAlerts(alerts);
    renderBlocked(alerts, blocked);
    document.getElementById('status').textContent = 'Last update: ' + new Date().toLocaleTimeString() + ' - ' + alerts.length + ' alert(s)';
  } catch (e) {
    document.getElementById('status').textContent = 'Poll error: ' + e;
  }
}
function renderAlerts(alerts) {
  document.getElementById('stat-total').textContent = alerts.length;
  document.getElementById('stat-scan').textContent = alerts.filter(a => a.type === 'port_scan').length;
  document.getElementById('stat-brute').textContent = alerts.filter(a => a.type === 'brute_force').length;
  const body = document.getElementById('alerts-body');
  if (!alerts.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No alerts yet - start demo traffic.</td></tr>';
    return;
  }
  const rows = [...alerts].reverse().map(a =>
    '<tr><td>' + a.type + '</td><td>' + a.source_ip + '</td>' +
    '<td><span class="badge sev-' + a.severity + '">' + a.severity + '</span></td>' +
    '<td>' + a.detected_at + '</td>' +
    '<td><span class="badge act-' + a.action_taken + '">' + a.action_taken + '</span></td></tr>'
  );
  body.innerHTML = rows.join('');
}
function renderBlocked(alerts, blocked) {
  document.getElementById('stat-blocked').textContent = blocked.blocked_ips.length;
  const panel = document.getElementById('blocked-panel');
  const ips = [...new Set(alerts.map(a => a.source_ip))];
  if (!ips.length) { panel.innerHTML = '<span style="color:#8b949e">None blocked yet.</span>'; return; }
  panel.innerHTML = ips.map(ip =>
    blocked.blocked_ips.includes(ip)
      ? '<span class="blocked-ip">BLOCKED ' + ip + '</span>'
      : '<span class="ok-ip">allowed ' + ip + '</span>'
  ).join('');
}
async function startDemo() {
  await fetch('/api/demo/start', {method: 'POST'});
  refresh();
}
async function resetDemo() {
  await fetch('/api/demo/reset', {method: 'POST'});
  refresh();
}
setInterval(refresh, POLL_MS);
refresh();
</script>
</body>
</html>
"""


def _blocked_ips() -> list[str]:
    seen: list[str] = []
    for alert in engine.get_alerts():
        ip = alert.get("source_ip")
        if ip and ip not in seen:
            seen.append(ip)
    return [ip for ip in seen if engine.is_blocked(ip)]


@app.get("/")
def index():
    return PAGE_HTML


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "port": PORT})


@app.get("/api/alerts")
def api_alerts():
    return jsonify(engine.get_alerts())


@app.get("/api/blocked")
def api_blocked():
    return jsonify({"blocked_ips": _blocked_ips()})


@app.post("/api/ingest")
def api_ingest():
    entry = request.get_json(force=True, silent=True)
    if not isinstance(entry, dict):
        return jsonify({"ok": False, "error": "body must be a log-entry object"}), 400
    engine.ingest_log_entry(entry)
    return jsonify({"ok": True, "alerts": len(engine.get_alerts())})


def _stream_entries(n_normal: int = 200, n_attack_bursts: int = 2, interval: float = 0.05):
    global _demo_running
    try:
        for entry in generate_synthetic_traffic(
            n_normal=n_normal, n_attack_bursts=n_attack_bursts
        ):
            engine.ingest_log_entry(entry)
            time.sleep(interval)
    finally:
        with _demo_lock:
            _demo_running = False


@app.post("/api/demo/start")
def api_demo_start():
    global _demo_thread, _demo_running
    with _demo_lock:
        if _demo_running:
            return jsonify({"ok": True, "message": "demo stream already running"})
        _demo_running = True
        _demo_thread = threading.Thread(
            target=_stream_entries, kwargs={"interval": 0.05}, daemon=True
        )
        _demo_thread.start()
    return jsonify({"ok": True, "message": "demo stream started"})


@app.post("/api/demo/reset")
def api_demo_reset():
    engine.reset()
    return jsonify({"ok": True, "message": "detector state cleared"})


def main() -> None:
    parser = argparse.ArgumentParser(description="SecureCorp IDS live dashboard")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()
    print(f"[dashboard] SecureCorp IDS live dashboard on http://{args.host}:{args.port}")
    print("[dashboard] Endpoints: / /api/alerts /api/blocked /api/ingest /api/demo/start /api/demo/reset /api/health")
    app.run(host=args.host, port=args.port, use_reloader=False)


if __name__ == "__main__":
    main()
