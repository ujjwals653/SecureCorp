"""Canonical synthetic-traffic mock (owned by the Testing module).

Standalone mock — no dependency on any live backend or other module.
Consumed by modules/ids/ and the dashboard for Phase-1 testing.

Log entry schema (consumed by ingest_log_entry):
    {
        "source_ip": str,
        "endpoint": str,
        "method": str,        # e.g. "GET", "POST"
        "status_code": int,   # e.g. 200, 401, 404
        "timestamp": str,     # ISO-8601 string
    }

Known attacker constants are exported so tests can assert on them
without brittle reverse-engineering:
    PORT_SCAN_IP, BRUTE_FORCE_IP, BENIGN_IPS
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone

PORT_SCAN_IP = "203.0.113.99"      # TEST-NET-3, documentation range
BRUTE_FORCE_IP = "198.51.100.77"   # TEST-NET-2, documentation range
BENIGN_IPS = ["10.0.0.5", "10.0.0.12", "10.0.0.23", "192.168.1.50"]

LOGIN_ENDPOINT = "/api/auth/login"

VALID_ENDPOINTS = [
    "/",
    "/api/files",
    "/api/files/123",
    "/api/users/me",
    "/api/share/abc",
    LOGIN_ENDPOINT,
]

# Distinct, mostly-invalid endpoints used only by the port-scan burst.
SCAN_ENDPOINTS = [
    "/api/admin",
    "/api/admin/users",
    "/api/config",
    "/api/debug",
    "/.env",
    "/backup.zip",
    "/server-status",
    "/wp-admin",
    "/wp-login.php",
    "/api/v1/users",
    "/api/v2/orders",
    "/api/internal/metrics",
    "/api/files/99999",
    "/api/share/zzz-invalid",
    "/etc/passwd",
    "/.git/config",
    "/api/auth/admin",
    "/phpmyadmin",
    "/actuator/health",
    "/api/private/keys",
]

# Internal realism constants (not part of the canonical signature).
_SEED = 42
_NORMAL_WINDOW_SECONDS = 300
_N_SCAN_PROBES = 20
_SCAN_WINDOW_SECONDS = 30
_N_BRUTE_ATTEMPTS = 10
_BRUTE_WINDOW_SECONDS = 40


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def generate_synthetic_traffic(n_normal=200, n_attack_bursts=2):
    """
    Returns a list of log entries: mostly normal traffic, with injected
    attack bursts (port scan + brute force).
    Each entry: {source_ip, endpoint, method, status_code, timestamp}
    """
    # Deterministic internally so live demos are reproducible.
    rng = random.Random(_SEED)
    base = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(
        seconds=_NORMAL_WINDOW_SECONDS
    )

    traffic: list[dict] = []

    # ---- 1. Normal background traffic -----------------------------------
    # Spread thinly so no benign IP trips the IDS sliding-window rules:
    # valid endpoints only (max 6 distinct < 10 threshold), rare one-off
    # 401s/404s that never cluster into a burst.
    for _ in range(max(0, int(n_normal))):
        ip = rng.choice(BENIGN_IPS)
        endpoint = rng.choices(
            VALID_ENDPOINTS,
            weights=[15, 25, 15, 10, 15, 20],
            k=1,
        )[0]
        if endpoint == LOGIN_ENDPOINT:
            if rng.random() < 0.9:
                method, status = "POST", 200
            else:
                method, status = "POST", 401
        else:
            method = "GET" if rng.random() < 0.85 else "POST"
            status = 404 if rng.random() < 0.03 else 200
        ts = base + timedelta(seconds=rng.uniform(0, _NORMAL_WINDOW_SECONDS))
        traffic.append(
            {
                "source_ip": ip,
                "endpoint": endpoint,
                "method": method,
                "status_code": status,
                "timestamp": _iso(ts),
            }
        )

    n_bursts = max(0, int(n_attack_bursts))

    # ---- 2. Port-scan burst (burst #1) ----------------------------------
    # Near the end of the window so the demo reads chronologically.
    if n_bursts >= 1:
        scan_start = base + timedelta(
            seconds=_NORMAL_WINDOW_SECONDS - _SCAN_WINDOW_SECONDS - 5
        )
        probes = SCAN_ENDPOINTS[: max(1, min(_N_SCAN_PROBES, len(SCAN_ENDPOINTS)))]
        for i, endpoint in enumerate(probes):
            offset = (_SCAN_WINDOW_SECONDS / len(probes)) * i + rng.uniform(0, 0.4)
            ts = scan_start + timedelta(seconds=offset)
            traffic.append(
                {
                    "source_ip": PORT_SCAN_IP,
                    "endpoint": endpoint,
                    "method": "GET",
                    "status_code": 404,
                    "timestamp": _iso(ts),
                }
            )

    # ---- 3. Brute-force burst (burst #2) ---------------------------------
    if n_bursts >= 2:
        scan_start = base + timedelta(
            seconds=_NORMAL_WINDOW_SECONDS - _SCAN_WINDOW_SECONDS - 5
        )
        brute_start = scan_start + timedelta(seconds=5)
        for i in range(_N_BRUTE_ATTEMPTS):
            offset = (_BRUTE_WINDOW_SECONDS / _N_BRUTE_ATTEMPTS) * i + rng.uniform(0, 0.4)
            ts = brute_start + timedelta(seconds=offset)
            traffic.append(
                {
                    "source_ip": BRUTE_FORCE_IP,
                    "endpoint": LOGIN_ENDPOINT,
                    "method": "POST",
                    "status_code": 401,
                    "timestamp": _iso(ts),
                }
            )

    traffic.sort(key=lambda e: e["timestamp"])
    return traffic


def sample_alert():
    """
    Returns one example alert matching PROJECT_CONTEXT.md §7.4 exactly,
    for testing the dashboard without a live classifier run.
    """
    return {
        "alert_id": str(uuid.uuid4()),
        "type": "brute_force",
        "source_ip": BRUTE_FORCE_IP,
        "severity": "high",
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "action_taken": "blocked",
    }


if __name__ == "__main__":
    demo = generate_synthetic_traffic()
    print(f"Generated {len(demo)} entries")
    print(f"  port-scan IP: {PORT_SCAN_IP}")
    print(f"  brute-force IP: {BRUTE_FORCE_IP}")
    print(f"  benign IPs: {BENIGN_IPS}")
    print(f"  sample alert: {sample_alert()}")
    for e in demo[:3]:
        print("  normal-sample:", e)
