"""Standalone Phase-1 IDS test — no dependency on any other module.

Runs the rule-based classifier against shared/mocks/synthetic_traffic.py
and asserts:
  1. The injected port-scan burst is flagged (type == "port_scan").
  2. The injected brute-force burst is flagged (type == "brute_force").
  3. No false positives on normal/benign traffic.
  4. Every alert matches the PROJECT_CONTEXT §7.4 shape exactly.

Usage (from repo root):
    python modules/ids/test_detector.py
Or (from inside modules/ids/):
    python test_detector.py
"""

from __future__ import annotations

import pathlib
import sys
import uuid
from datetime import datetime

# Make imports work regardless of CWD:
#   repo_root = <...>/CNS_PROJECT-IDS  (parent of modules/ and shared/)
_THIS_FILE = pathlib.Path(__file__).resolve()
REPO_ROOT = _THIS_FILE
for parent in _THIS_FILE.parents:
    if (parent / "shared" / "mocks" / "synthetic_traffic.py").exists():
        REPO_ROOT = parent
        break
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
# Also allow running from inside modules/ids/ (sibling import fallback).
_IDS_DIR = _THIS_FILE.parent
if str(_IDS_DIR) not in sys.path:
    sys.path.insert(0, str(_IDS_DIR))

try:
    from shared.mocks.synthetic_traffic import (
        BENIGN_IPS,
        BRUTE_FORCE_IP,
        PORT_SCAN_IP,
        generate_synthetic_traffic,
        sample_alert,
    )
except ImportError:  # pragma: no cover — fallback for odd path setups
    from synthetic_traffic import (  # type: ignore[no-redef]
        BENIGN_IPS,
        BRUTE_FORCE_IP,
        PORT_SCAN_IP,
        generate_synthetic_traffic,
        sample_alert,
    )

try:
    import detector as engine  # running inside modules/ids/
except ImportError:  # running from repo root
    from modules.ids import detector as engine


EXPECTED_KEYS = {
    "alert_id",
    "type",
    "source_ip",
    "severity",
    "detected_at",
    "action_taken",
}
VALID_TYPES = {"port_scan", "brute_force", "other"}
VALID_SEVERITIES = {"low", "medium", "high"}
VALID_ACTIONS = {"blocked", "flagged", "none"}


def validate_alert_shape(alert: dict) -> None:
    assert isinstance(alert, dict), f"alert must be dict, got {type(alert)}"
    assert set(alert.keys()) == EXPECTED_KEYS, (
        f"alert keys must be exactly {sorted(EXPECTED_KEYS)}, "
        f"got {sorted(alert.keys())}: {alert}"
    )
    uuid.UUID(str(alert["alert_id"]))  # raises if not a uuid-string
    assert alert["type"] in VALID_TYPES, f"bad type: {alert['type']}"
    assert isinstance(alert["source_ip"], str) and alert["source_ip"], "bad source_ip"
    assert alert["severity"] in VALID_SEVERITIES, f"bad severity: {alert['severity']}"
    assert alert["action_taken"] in VALID_ACTIONS, f"bad action: {alert['action_taken']}"
    # Must be parseable ISO-8601.
    detected = str(alert["detected_at"]).replace("Z", "+00:00")
    datetime.fromisoformat(detected)  # raises if malformed


def main() -> int:
    engine.reset()
    # Canonical shared-mock signature (owned by Testing module).
    traffic = generate_synthetic_traffic(n_normal=200, n_attack_bursts=2)
    print(f"[test] Ingesting {len(traffic)} synthetic log entries ...")
    for entry in traffic:
        engine.ingest_log_entry(entry)

    alerts = engine.get_alerts()
    print(f"[test] Detector raised {len(alerts)} alert(s):")
    for a in alerts:
        print(f"       {a}")

    # 1. Shape check (§7.4 exact).
    assert isinstance(alerts, list), "get_alerts() must return a list"
    for a in alerts:
        validate_alert_shape(a)
    print("[test] OK - all alerts match section 7.4 shape exactly.")

    by_type: dict[str, list[dict]] = {}
    for a in alerts:
        by_type.setdefault(a["type"], []).append(a)

    # 2. Port-scan burst must be flagged.
    scan_alerts = [a for a in by_type.get("port_scan", []) if a["source_ip"] == PORT_SCAN_IP]
    assert scan_alerts, (
        f"FAIL: expected a port_scan alert for {PORT_SCAN_IP}, got: {alerts}"
    )
    print(f"[test] OK - port-scan correctly flagged for {PORT_SCAN_IP}.")

    # 3. Brute-force burst must be flagged.
    brute_alerts = [
        a for a in by_type.get("brute_force", []) if a["source_ip"] == BRUTE_FORCE_IP
    ]
    assert brute_alerts, (
        f"FAIL: expected a brute_force alert for {BRUTE_FORCE_IP}, got: {alerts}"
    )
    print(f"[test] OK - brute-force correctly flagged for {BRUTE_FORCE_IP}.")

    # 4. No false positives on benign IPs.
    benign_alerts = [a for a in alerts if a["source_ip"] in BENIGN_IPS]
    assert not benign_alerts, (
        f"FAIL: false positive(s) on normal traffic: {benign_alerts}"
    )
    print(f"[test] OK - no false positives on benign IPs {BENIGN_IPS}.")

    # 5. Blocklist stub: brute-force attacker blocked, benign IP not.
    assert engine.is_blocked(BRUTE_FORCE_IP), (
        f"FAIL: is_blocked({BRUTE_FORCE_IP}) should be True after brute-force alert"
    )
    assert not engine.is_blocked(BENIGN_IPS[0]), (
        f"FAIL: is_blocked({BENIGN_IPS[0]}) should be False (benign)"
    )
    print("[test] OK - is_blocked() behaves as expected "
          f"(blocked={BRUTE_FORCE_IP}, not-blocked={BENIGN_IPS[0]}).")

    # 6. Canonical sample_alert() matches section 7.4 shape (dashboard contract).
    validate_alert_shape(sample_alert())
    print("[test] OK - sample_alert() matches section 7.4 shape exactly.")

    print("\nALL PHASE-1 IDS CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
