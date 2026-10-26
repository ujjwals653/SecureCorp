"""Mallory's port-scan script (Phase 3, standalone attacker).

Simulates an external attacker probing a target's HTTP API with a burst
of requests to made-up/invalid endpoints. Against the SecureCorp IDS this
crosses the port-scan rule (>=10 distinct endpoints OR >=8 404s from one
source IP within 60s) and the live dashboard flags it.

Standalone: stdlib only, imports NOTHING from modules/ids or shared/.
Only needs network access to the target. Safe to run from any machine.

Usage:
    python mallory_portscan.py localhost:5000
    python mallory_portscan.py 127.0.0.1:5000 --count 20 --interval 0.15
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.error
import urllib.request

# Local probe list (deliberately NOT imported from shared mocks so this
# script stays zero-dependency and attacker-independent).
PROBES = [
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


def parse_target(target: str) -> str:
    """Normalize 'host:port' (or 'http://host:port') to a base URL."""
    target = target.strip()
    if target.startswith("http://") or target.startswith("https://"):
        return target.rstrip("/")
    if ":" not in target:
        target = f"{target}:5000"
    return f"http://{target.rstrip('/')}"


def probe(base_url: str, path: str, timeout: float = 5) -> int | str:
    url = base_url + path
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code  # 404s etc. still count — that IS the scan signal
    except Exception as exc:  # noqa: BLE001 — report connectivity problems plainly
        return f"ERROR {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Mallory port-scan (demo attacker)")
    parser.add_argument("target", help="target as host:port, e.g. localhost:5000")
    parser.add_argument("--count", type=int, default=len(PROBES),
                        help="how many probes to send (need >=10 to trip the IDS)")
    parser.add_argument("--interval", type=float, default=0.15,
                        help="seconds between probes")
    args = parser.parse_args()

    base_url = parse_target(args.target)
    probes = PROBES[: max(1, min(args.count, len(PROBES)))]
    print(f"[mallory:scan] Target: {base_url}")
    print(f"[mallory:scan] Firing {len(probes)} probes, "
          f"one every {args.interval}s (watch the IDS dashboard)...")

    results: list = []
    for i, path in enumerate(probes, 1):
        status = probe(base_url, path)
        results.append(status)
        print(f"[mallory:scan] [{i:02d}/{len(probes)}] GET {path} -> {status}")
        time.sleep(args.interval)

    n_404 = sum(1 for r in results if r == 404)
    print(f"[mallory:scan] Done. {len(probes)} probes sent, {n_404} came back 404.")
    print("[mallory:scan] If the IDS is watching, expect a 'port_scan' alert "
          "for this machine's IP within seconds.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
