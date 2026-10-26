# IDS / Attack Detection (SecureCorp)

This module watches traffic to the file-sharing server and catches two
attack patterns with a simple rule-based engine (no ML, built for a live
demo): port scans (many distinct/invalid endpoints hit rapidly from one
IP) and brute-force logins (many failed POSTs to `/api/auth/login` from
one IP). Detections appear as alerts on a live Flask dashboard with an
in-memory auto-block for brute-force attackers, and Mallory's two
standalone attack scripts exist so anyone can replay Act 5 of the demo
against a target and watch the dashboard flag/block it in real time.

## Files

| File | Purpose |
|---|---|
| `detector.py` | Core rule-based engine: `ingest_log_entry()`, `get_alerts()`, `is_blocked()`, `reset()`. Thresholds live here — don't change them without updating the tests. |
| `test_detector.py` | Phase-1 standalone test: feeds `shared/mocks/synthetic_traffic.py` through the engine and asserts both attacks flagged, zero false positives. |
| `dashboard.py` | Live dashboard (Flask, port 5001): alerts table color-coded by severity + blocked-IPs panel, polling every 1.5s. |
| `stream_synthetic.py` | Streams synthetic traffic into the running dashboard for demos with no backend. |
| `mallory_portscan.py` | Standalone port-scan attacker (stdlib only, no project imports): hammers invalid endpoints at a target `host:port`. |
| `mallory_bruteforce.py` | Standalone brute-force attacker (stdlib only, no project imports): spams bad POSTs at `/api/auth/login` on a target `host:port`. |
| `dev_target_stub.py` | **DEV-ONLY stand-in for Backend** (port 5000): throwaway stub Portal API so Mallory can be demoed before the real server exists. Remove/replace at Checkpoint 4. |

Detection rules (`detector.py`, do not retune blindly):

- port_scan: ≥10 distinct endpoints OR ≥8 404s from one IP in 60s → medium / flagged
- brute_force: ≥5 failed (401) POST `/api/auth/login` from one IP in 60s → high / blocked

## Full local demo, step by step (3 terminals, repo root, no Backend needed)

**Step 1 — start the victim.** Dev-only stand-in for Backend;
remove/replace it at Checkpoint 4 (see below).

```bash
python modules/ids/dev_target_stub.py
```

Leave it running. It listens on `http://127.0.0.1:5000` and forwards
every hit to the dashboard.

**Step 2 — start the dashboard and open it.**

```bash
python modules/ids/dashboard.py
```

Open `http://127.0.0.1:5001` in a browser. You should see empty stat
cards, an empty alerts table ("No alerts yet"), and "None blocked yet."

**Step 3a — run the port scan against the stub.**

```bash
python modules/ids/mallory_portscan.py 127.0.0.1:5000
```

**What you should see on the dashboard:** within ~2 seconds of the
script finishing, Total alerts goes 0 → 1 and a `port_scan` row appears
for `127.0.0.1` with an amber `medium` pill and an amber `flagged`
pill. The Blocked IPs panel still shows `127.0.0.1` as allowed (green) —
port scans are flagged, not blocked.

**Step 3b — run the brute force against the stub.**

```bash
python modules/ids/mallory_bruteforce.py 127.0.0.1:5000
```

**What you should see on the dashboard:** a `brute_force` row appears
for `127.0.0.1` with a red `high` pill and a red `blocked` pill, the
Blocked IPs stat goes to 1, and the Blocked IPs panel shows a red
`BLOCKED 127.0.0.1` chip (`is_blocked("127.0.0.1") == True`).

Reset between runs with the dashboard's **Reset** button (or
`POST /api/demo/reset`).

No-target alternative (dashboard only, no stub/Mallory):

```bash
python modules/ids/stream_synthetic.py   # with dashboard.py running
```

## At Integration Checkpoint 4

Per PROJECT_CONTEXT.md §10: retire `dev_target_stub.py` and re-run both
Mallory scripts against the **real live Backend server** instead:

```bash
python modules/ids/mallory_portscan.py <backend-host>:<backend-port>
python modules/ids/mallory_bruteforce.py <backend-host>:<backend-port>
```

Confirm the dashboard still flags the scan and blocks the brute-forcer
against real traffic. Coordinate the log-entry format with Backend
(`{source_ip, endpoint, method, status_code, timestamp}` per request —
exactly what the stub forwards today), then delete the stub. Mallory's
scripts need no changes: they only need the target's HTTP port.

## Phase-1 test suite (standalone, no servers needed)

```bash
python modules/ids/test_detector.py
```

Expected: `ALL PHASE-1 IDS CHECKS PASSED` — both synthetic bursts
flagged, every alert matching the §7.4 shape, zero false positives.
