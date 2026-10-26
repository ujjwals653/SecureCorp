"""Stream synthetic traffic into the IDS (demo mode, no live backend).

Two modes:
  1. HTTP mode (default): POSTs entries to a running dashboard at
     http://127.0.0.1:5001/api/ingest — use while the dashboard is up so
     the page visibly updates live.
  2. Direct mode (--direct): calls detector.ingest_log_entry() in-process
     (no dashboard needed; useful for headless checks).

Usage (from repo root):
    python modules/ids/dashboard.py        # terminal 1: start dashboard
    python modules/ids/stream_synthetic.py  # terminal 2: stream demo traffic

Only touches modules/ids/ + shared/mocks/. Stdlib only (urllib).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
import urllib.request

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
    from shared.mocks.synthetic_traffic import generate_synthetic_traffic
except ImportError:  # pragma: no cover
    from synthetic_traffic import generate_synthetic_traffic  # type: ignore[no-redef]


def _post_entry(url: str, entry: dict) -> dict:
    data = json.dumps(entry).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Stream synthetic IDS traffic")
    parser.add_argument("--url", default="http://127.0.0.1:5001/api/ingest")
    parser.add_argument("--n-normal", type=int, default=200)
    parser.add_argument("--n-attack-bursts", type=int, default=2)
    parser.add_argument("--interval", type=float, default=0.05,
                        help="seconds between entries")
    parser.add_argument("--direct", action="store_true",
                        help="ingest in-process instead of HTTP POST")
    args = parser.parse_args()

    traffic = generate_synthetic_traffic(
        n_normal=args.n_normal, n_attack_bursts=args.n_attack_bursts
    )
    print(f"[streamer] Streaming {len(traffic)} entries "
          f"({'direct ingest' if args.direct else 'POST ' + args.url}) ...")

    if args.direct:
        try:
            import detector as engine
        except ImportError:
            from modules.ids import detector as engine
        for i, entry in enumerate(traffic, 1):
            engine.ingest_log_entry(entry)
            if i % 50 == 0 or i == len(traffic):
                print(f"[streamer] {i}/{len(traffic)} ingested, "
                      f"alerts={len(engine.get_alerts())}")
            time.sleep(args.interval)
        print(f"[streamer] Done. alerts={engine.get_alerts()}")
        return 0

    ok = 0
    for i, entry in enumerate(traffic, 1):
        try:
            _post_entry(args.url, entry)
            ok += 1
        except Exception as exc:  # noqa: BLE001 — demo script, report and stop
            print(f"[streamer] POST failed at entry {i}: {exc}")
            print("[streamer] Is the dashboard running? (python modules/ids/dashboard.py)")
            return 1
        if i % 50 == 0 or i == len(traffic):
            print(f"[streamer] {i}/{len(traffic)} posted.")
        time.sleep(args.interval)
    print(f"[streamer] Done. {ok}/{len(traffic)} entries posted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
