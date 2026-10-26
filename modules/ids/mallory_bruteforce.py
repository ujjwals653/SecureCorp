"""Mallory's brute-force login script (Phase 3, standalone attacker).

Simulates an external attacker hammering POST /api/auth/login with bad
credentials. Against the SecureCorp IDS this crosses the brute-force rule
(>=5 failed 401 logins from one source IP within 60s) and the live
dashboard raises a 'brute_force' alert and blocks the IP.

Standalone: stdlib only, imports NOTHING from modules/ids or shared/.
Only needs network access to the target. Safe to run from any machine.

Usage:
    python mallory_bruteforce.py localhost:5000
    python mallory_bruteforce.py 127.0.0.1:5000 --attempts 10 --interval 0.3
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def parse_target(target: str) -> str:
    """Normalize 'host:port' (or 'http://host:port') to a base URL."""
    target = target.strip()
    if target.startswith("http://") or target.startswith("https://"):
        return target.rstrip("/")
    if ":" not in target:
        target = f"{target}:5000"
    return f"http://{target.rstrip('/')}"


def try_login(base_url: str, username: str, password: str,
              timeout: float = 5) -> int | str:
    url = base_url + "/api/auth/login"
    body = json.dumps({"username": username, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code  # 401s are the expected signal, not a failure
    except Exception as exc:  # noqa: BLE001 — report connectivity problems plainly
        return f"ERROR {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Mallory brute-force login (demo attacker)")
    parser.add_argument("target", help="target as host:port, e.g. localhost:5000")
    parser.add_argument("--username", default="mallory",
                        help="username to attack (default: mallory)")
    parser.add_argument("--attempts", type=int, default=10,
                        help="login attempts (need >=5 failed 401s to trip the IDS)")
    parser.add_argument("--interval", type=float, default=0.3,
                        help="seconds between attempts")
    args = parser.parse_args()

    base_url = parse_target(args.target)
    print(f"[mallory:brute] Target: {base_url}/api/auth/login as '{args.username}'")
    print(f"[mallory:brute] Firing {args.attempts} bad-password attempts, "
          f"one every {args.interval}s (watch the IDS dashboard)...")

    n_401 = 0
    for i in range(1, args.attempts + 1):
        status = try_login(base_url, args.username, f"wrong-password-{i:03d}")
        if status == 401:
            n_401 += 1
        print(f"[mallory:brute] attempt [{i:02d}/{args.attempts}] "
              f"password='wrong-password-{i:03d}' -> {status}")
        time.sleep(args.interval)

    print(f"[mallory:brute] Done. {args.attempts} attempts, {n_401} came back 401.")
    print("[mallory:brute] If the IDS is watching, expect a 'brute_force' alert "
          "and this machine's IP to show BLOCKED within seconds.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
