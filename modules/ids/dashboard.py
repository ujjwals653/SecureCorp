"""SecureCorp IDS — Phase 2 live dashboard (Flask, port 5001).

Standalone run (from repo root):
    python modules/ids/dashboard.py
Or (from inside modules/ids/):
    python dashboard.py

What it does:
  - Serves a live HTML dashboard polling /api/alerts, /api/blocked,
    and /api/traffic every 1.5s (no websockets).
  - Displays all traffic (normal, port scans, and brute-force/blocked).
  - POST /api/ingest accepts one log entry -> detector.ingest_log_entry().
  - POST /api/demo/start streams shared/mocks/synthetic_traffic.py
    entries in-process so the dashboard visibly updates with no backend.
  - POST /api/demo/reset clears detector state.

Reads detection state only via the Phase-1 interface:
  ingest_log_entry(), get_alerts(), is_blocked(), get_traffic(), reset().
Does NOT change detector.py logic or thresholds.
"""

from __future__ import annotations

import os
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

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5001"))
POLL_MS = 1500

_demo_thread: threading.Thread | None = None
_demo_lock = threading.Lock()
_demo_running = False


PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SecureCorp IDS - Live Dashboard & Traffic Monitor</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Consolas, Menlo, monospace; background: #0d1117; color: #e6edf3; margin: 0; padding: 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
  .badge-live { background: #238636; color: white; font-size: 11px; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; animation: pulse 2s infinite; }
  @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
  .sub { color: #8b949e; margin-bottom: 20px; font-size: 13px; }
  .row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px 18px; min-width: 150px; flex: 1; }
  .card .label { color: #8b949e; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .card .value { font-size: 26px; font-weight: bold; font-family: Consolas, monospace; }
  .card-total { border-left: 4px solid #58a6ff; }
  .card-normal { border-left: 4px solid #2ea043; }
  .card-alerts { border-left: 4px solid #d29922; }
  .card-blocked { border-left: 4px solid #f85149; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin: 24px 0 12px; }
  h3 { margin: 0; font-size: 16px; color: #e6edf3; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
  th, td { padding: 9px 12px; border-bottom: 1px solid #21262d; text-align: left; font-size: 12.5px; font-family: Consolas, monospace; }
  th { background: #0f1319; color: #8b949e; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  tr:hover td { background: #1b212a; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-transform: uppercase; }
  .sev-low { background: #1a472a; color: #7ee787; }
  .sev-medium { background: #4d3a00; color: #f0b72f; }
  .sev-high { background: #5a1f1f; color: #ff7b72; }
  .act-blocked { background: #5a1f1f; color: #ff7b72; }
  .act-flagged { background: #4d3a00; color: #f0b72f; }
  .act-none { background: #30363d; color: #e6edf3; }
  
  .traffic-normal { background: #13231b; color: #7ee787; border: 1px solid #238636; }
  .traffic-blocked { background: #3d1418; color: #ff7b72; border: 1px solid #da3633; font-weight: bold; }
  .traffic-flagged { background: #332308; color: #f0b72f; border: 1px solid #9e6a03; }

  .status-2xx { color: #7ee787; font-weight: 600; }
  .status-4xx { color: #f0b72f; font-weight: 600; }
  .status-401 { color: #ff7b72; font-weight: 600; }
  .status-other { color: #8b949e; }

  .blocked-ip { background: #5a1f1f; color: #ffb3ab; border: 1px solid #ff7b72; border-radius: 6px; padding: 4px 10px; margin: 2px 6px 2px 0; display: inline-block; font-size: 12px; font-weight: bold; }
  .ok-ip { background: #1a472a; color: #7ee787; border: 1px solid #2ea043; border-radius: 6px; padding: 4px 10px; margin: 2px 6px 2px 0; display: inline-block; font-size: 12px; }
  
  .btn-group { display: flex; gap: 8px; margin-bottom: 20px; }
  button { background: #238636; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.15s; }
  button:hover { background: #2ea043; }
  button.secondary { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; }
  button.secondary:hover { background: #30363d; }
  
  .filter-tabs { display: flex; gap: 4px; background: #0f1319; border: 1px solid #30363d; border-radius: 6px; padding: 3px; }
  .filter-btn { background: transparent; border: none; border-radius: 4px; padding: 4px 12px; font-size: 12px; color: #8b949e; cursor: pointer; font-weight: 500; }
  .filter-btn.active { background: #21262d; color: #e6edf3; font-weight: 600; }

  .table-scroll { max-height: 380px; overflow-y: auto; border: 1px solid #30363d; border-radius: 8px; background: #161b22; margin-bottom: 20px; }
  .table-scroll table { border: none; margin-bottom: 0; }
  .table-scroll th { position: sticky; top: 0; z-index: 2; }
  
  #status { color: #8b949e; font-size: 12px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; }
  .empty { color: #8b949e; padding: 24px; text-align: center; }
</style>
</head>
<body>

<h1>
  SecureCorp IDS &mdash; Live Attack Detection & Traffic Monitor
  <span class="badge-live">LIVE</span>
</h1>
<div class="sub">Continuous rule-based intrusion detection &middot; Port-scan &amp; Brute-force monitoring &middot; Port 5001</div>

<div class="row">
  <div class="card card-total">
    <div class="label">Total Requests</div>
    <div class="value" id="stat-traffic">0</div>
  </div>
  <div class="card card-normal">
    <div class="label">Normal Traffic</div>
    <div class="value" id="stat-normal">0</div>
  </div>
  <div class="card card-alerts">
    <div class="label">Total Alerts</div>
    <div class="value" id="stat-total">0</div>
  </div>
  <div class="card card-alerts">
    <div class="label">Port Scans</div>
    <div class="value" id="stat-scan">0</div>
  </div>
  <div class="card card-blocked">
    <div class="label">Brute-Force</div>
    <div class="value" id="stat-brute">0</div>
  </div>
  <div class="card card-blocked">
    <div class="label">Blocked IPs</div>
    <div class="value" id="stat-blocked">0</div>
  </div>
</div>

<div class="btn-group">
  <button onclick="startDemo()">Start Synthetic Stream</button>
  <button class="secondary" onclick="resetDemo()">Reset State &amp; Logs</button>
</div>

<!-- Section: Security Alerts -->
<div class="section-header">
  <h3>Generated Security Alerts</h3>
  <span style="color:#8b949e;font-size:12px">PROJECT_CONTEXT §7.4 alert schema</span>
</div>
<table>
  <thead>
    <tr>
      <th>Type</th>
      <th>Source IP</th>
      <th>Severity</th>
      <th>Detected At</th>
      <th>Action Taken</th>
    </tr>
  </thead>
  <tbody id="alerts-body">
    <tr><td colspan="5" class="empty">No security alerts detected.</td></tr>
  </tbody>
</table>

<!-- Section: Blocked IPs Panel -->
<div class="section-header">
  <h3>Firewall / In-Memory Blocklist Status</h3>
  <span style="color:#8b949e;font-size:12px">Auto-blocks high-severity brute-force attackers</span>
</div>
<div id="blocked-panel" style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px 16px;margin-bottom:24px">
  <span style="color:#8b949e">None blocked yet.</span>
</div>

<!-- Section: All Ingested Traffic Feed -->
<div class="section-header">
  <h3>Live Traffic Feed &mdash; All Requests (Normal &amp; Blocked)</h3>
  <div class="filter-tabs">
    <button class="filter-btn active" id="btn-all" onclick="setFilter('all')">All Requests (<span id="count-all">0</span>)</button>
    <button class="filter-btn" id="btn-normal" onclick="setFilter('normal')">Normal Traffic (<span id="count-normal">0</span>)</button>
    <button class="filter-btn" id="btn-threats" onclick="setFilter('threats')">Blocked / Flagged (<span id="count-threats">0</span>)</button>
  </div>
</div>

<div class="table-scroll">
  <table>
    <thead>
      <tr>
        <th style="width:170px">Timestamp</th>
        <th style="width:130px">Source IP</th>
        <th style="width:70px">Method</th>
        <th>Endpoint</th>
        <th style="width:90px">Status Code</th>
        <th style="width:120px">Classification</th>
      </tr>
    </thead>
    <tbody id="traffic-body">
      <tr><td colspan="6" class="empty">Waiting for incoming traffic logs...</td></tr>
    </tbody>
  </table>
</div>

<div id="status">
  <span id="status-text">Connecting to IDS backend...</span>
  <span style="color:#6e7681">Auto-refreshing every 1.5s</span>
</div>

<script>
const POLL_MS = 1500;
let currentFilter = 'all';
let cachedTraffic = [];
let cachedAlerts = [];
let cachedBlocked = [];

function setFilter(filter) {
  currentFilter = filter;
  document.getElementById('btn-all').classList.toggle('active', filter === 'all');
  document.getElementById('btn-normal').classList.toggle('active', filter === 'normal');
  document.getElementById('btn-threats').classList.toggle('active', filter === 'threats');
  renderTraffic(cachedTraffic, cachedAlerts, cachedBlocked);
}

async function refresh() {
  try {
    const [aRes, bRes, tRes] = await Promise.all([
      fetch('/api/alerts'),
      fetch('/api/blocked'),
      fetch('/api/traffic')
    ]);
    const alerts = await aRes.json();
    const blocked = await bRes.json();
    const traffic = await tRes.json();

    cachedAlerts = alerts;
    cachedBlocked = blocked;
    cachedTraffic = traffic;

    renderAlerts(alerts);
    renderBlocked(alerts, blocked);
    renderTraffic(traffic, alerts, blocked);

    document.getElementById('status-text').textContent =
      'Last sync: ' + new Date().toLocaleTimeString() + ' | ' + traffic.length + ' request(s) monitored | ' + alerts.length + ' alert(s)';
  } catch (e) {
    document.getElementById('status-text').textContent = 'Sync error: ' + e;
  }
}

function renderAlerts(alerts) {
  document.getElementById('stat-total').textContent = alerts.length;
  document.getElementById('stat-scan').textContent = alerts.filter(a => a.type === 'port_scan').length;
  document.getElementById('stat-brute').textContent = alerts.filter(a => a.type === 'brute_force').length;
  const body = document.getElementById('alerts-body');
  if (!alerts.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No security alerts detected.</td></tr>';
    return;
  }
  const rows = [...alerts].reverse().map(a =>
    '<tr><td><strong>' + a.type + '</strong></td><td>' + a.source_ip + '</td>' +
    '<td><span class="badge sev-' + a.severity + '">' + a.severity + '</span></td>' +
    '<td>' + a.detected_at + '</td>' +
    '<td><span class="badge act-' + a.action_taken + '">' + a.action_taken + '</span></td></tr>'
  );
  body.innerHTML = rows.join('');
}

function renderBlocked(alerts, blocked) {
  const blockedList = blocked.blocked_ips || [];
  document.getElementById('stat-blocked').textContent = blockedList.length;
  const panel = document.getElementById('blocked-panel');
  const alertIps = [...new Set(alerts.map(a => a.source_ip))];
  const allKnownIps = [...new Set([...alertIps, ...blockedList])];
  if (!allKnownIps.length) {
    panel.innerHTML = '<span style="color:#8b949e">No active blocks &mdash; all IPs currently allowed.</span>';
    return;
  }
  panel.innerHTML = allKnownIps.map(ip =>
    blockedList.includes(ip)
      ? '<span class="blocked-ip">&#x26D4; BLOCKED ' + ip + '</span>'
      : '<span class="ok-ip">&#x2714; ALLOWED ' + ip + '</span>'
  ).join('');
}

function renderTraffic(traffic, alerts, blocked) {
  const blockedIps = blocked.blocked_ips || [];
  const alertIps = new Set(alerts.map(a => a.source_ip));

  const isSuccess = (code) => code >= 200 && code < 400;

  document.getElementById('stat-traffic').textContent = traffic.length;
  const blockedOrFlaggedCount = traffic.filter(t => {
    const code = Number(t.status_code);
    if (isSuccess(code)) return false;
    return t.blocked || code === 403 || code === 401 || (code === 404 && alertIps.has(t.source_ip));
  }).length;
  const normalCount = traffic.length - blockedOrFlaggedCount;
  document.getElementById('stat-normal').textContent = normalCount;

  document.getElementById('count-all').textContent = traffic.length;
  document.getElementById('count-normal').textContent = normalCount;
  document.getElementById('count-threats').textContent = blockedOrFlaggedCount;

  const body = document.getElementById('traffic-body');
  if (!traffic.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Waiting for incoming traffic logs...</td></tr>';
    return;
  }

  const filtered = traffic.filter(item => {
    const code = Number(item.status_code);
    const ok = isSuccess(code);
    const isThreat = !ok && (item.blocked || code === 403 || code === 401 || (code === 404 && alertIps.has(item.source_ip)));
    if (currentFilter === 'normal') return !isThreat;
    if (currentFilter === 'threats') return isThreat;
    return true;
  });

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No requests matching filter "' + currentFilter + '".</td></tr>';
    return;
  }

  const rows = [...filtered].reverse().map(item => {
    const code = Number(item.status_code);
    const ok = isSuccess(code);

    let classBadge = '<span class="badge traffic-normal">NORMAL</span>';
    if (!ok) {
      if (item.blocked || code === 403) {
        classBadge = '<span class="badge traffic-blocked">&#x26D4; BLOCKED</span>';
      } else if (code === 401 || (code === 404 && alertIps.has(item.source_ip))) {
        classBadge = '<span class="badge traffic-flagged">&#x26A0; FLAGGED</span>';
      }
    }

    let statusClass = 'status-other';
    if (ok) statusClass = 'status-2xx';
    else if (code === 403 || code === 401) statusClass = 'status-401';
    else if (code >= 400 && code < 500) statusClass = 'status-4xx';

    return '<tr>' +
      '<td style="color:#8b949e">' + (item.timestamp ? item.timestamp.split('T')[1]?.replace('Z', '') || item.timestamp : '-') + '</td>' +
      '<td><strong>' + item.source_ip + '</strong></td>' +
      '<td>' + item.method + '</td>' +
      '<td style="color:#c9d1d9">' + item.endpoint + '</td>' +
      '<td class="' + statusClass + '">' + item.status_code + '</td>' +
      '<td>' + classBadge + '</td>' +
    '</tr>';
  });

  body.innerHTML = rows.join('');
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


@app.get("/api/traffic")
def api_traffic():
    """Return rolling history of all ingested traffic (normal and blocked)."""
    return jsonify(engine.get_traffic())


@app.post("/api/ingest")
def api_ingest():
    entry = request.get_json(force=True, silent=True)
    if not isinstance(entry, dict):
        return jsonify({"ok": False, "error": "body must be a log-entry object"}), 400
    engine.ingest_log_entry(entry)
    return jsonify({
        "ok": True,
        "alerts": len(engine.get_alerts()),
        "total_traffic": len(engine.get_traffic()),
    })


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
    print("[dashboard] Endpoints: / /api/alerts /api/blocked /api/traffic /api/ingest /api/demo/start /api/demo/reset /api/health")
    app.run(host=args.host, port=args.port, use_reloader=False)


if __name__ == "__main__":
    main()
