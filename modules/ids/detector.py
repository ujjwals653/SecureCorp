"""SecureCorp IDS — Phase 1 core detection engine (rule-based).

Public API (module-level, matches Phase 1 spec):
    ingest_log_entry(entry: dict) -> None
    get_alerts() -> list[dict]   # §7.4 alert shape
    is_blocked(ip: str) -> bool

Detection rules (no ML, demo-reliable):
  - port_scan: many distinct endpoints and/or many 404s from one
    source_ip inside a short sliding window.
  - brute_force: many failed (401) POST /api/auth/login from one
    source_ip inside a short sliding window.

Self-contained: only stdlib, no dependency on any other module.
"""

from __future__ import annotations

import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

LOGIN_ENDPOINT = "/api/auth/login"

# ---- Tunable rule thresholds -------------------------------------------
PORT_SCAN_WINDOW_SECONDS = 60.0
PORT_SCAN_DISTINCT_THRESHOLD = 10   # distinct endpoints in window
PORT_SCAN_404_THRESHOLD = 8         # 404 responses in window (alt trigger)

BRUTE_FORCE_WINDOW_SECONDS = 60.0
BRUTE_FORCE_THRESHOLD = 5           # failed POST logins in window

ALERT_COOLDOWN_SECONDS = 300.0      # suppress repeat alerts per (ip, type)

_VALID_TYPES = {"port_scan", "brute_force", "other"}
_VALID_SEVERITIES = {"low", "medium", "high"}
_VALID_ACTIONS = {"blocked", "flagged", "none"}


def _parse_ts(value) -> float:
    """Parse supported timestamp formats to epoch seconds (UTC)."""
    if value is None:
        return datetime.now(timezone.utc).timestamp()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).timestamp()
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return datetime.now(timezone.utc).timestamp()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).timestamp()
    return datetime.now(timezone.utc).timestamp()


def _iso_from_epoch(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()


class IDSDetector:
    """Stateful rule-based detector. One instance = one engine."""

    def __init__(self) -> None:
        self._alerts: list[dict] = []
        self._blocklist: set[str] = set()
        # Per-IP sliding-window event buffers: ip -> deque[(epoch, ...)]
        self._endpoint_hits: dict[str, deque] = defaultdict(deque)
        self._not_found_hits: dict[str, deque] = defaultdict(deque)
        self._failed_logins: dict[str, deque] = defaultdict(deque)
        # Dedup: (ip, alert_type) -> epoch of last alert
        self._last_alert_at: dict[tuple[str, str], float] = {}
        self._traffic_log: deque[dict] = deque(maxlen=200)

    # -- lifecycle ------------------------------------------------------
    def reset(self) -> None:
        """Clear all state (alerts, blocklist, windows, traffic). Useful for tests."""
        self._alerts.clear()
        self._blocklist.clear()
        self._endpoint_hits.clear()
        self._not_found_hits.clear()
        self._failed_logins.clear()
        self._last_alert_at.clear()
        self._traffic_log.clear()

    # -- public API ------------------------------------------------------
    def ingest_log_entry(self, entry: dict) -> None:
        """Accept one log entry and run both rules.

        Expected fields: source_ip, endpoint, method, status_code, timestamp.
        Malformed entries are ignored (never raise — demo must not crash).
        """
        if not isinstance(entry, dict):
            return
        ip = entry.get("source_ip")
        endpoint = entry.get("endpoint")
        if not ip or not endpoint:
            return
        ip = str(ip)
        endpoint = str(endpoint)
        method = str(entry.get("method", "GET")).upper()
        try:
            status = int(entry.get("status_code", 0))
        except (TypeError, ValueError):
            status = 0
        now_epoch = _parse_ts(entry.get("timestamp"))

        self._prune(ip, now_epoch)

        self._endpoint_hits[ip].append((now_epoch, endpoint))
        if status == 404:
            self._not_found_hits[ip].append(now_epoch)
        if endpoint == LOGIN_ENDPOINT and method == "POST" and status == 401:
            self._failed_logins[ip].append(now_epoch)

        self._check_port_scan(ip, now_epoch)
        self._check_brute_force(ip, now_epoch)

        was_blocked = (status == 403) or (self.is_blocked(ip) and status != 200)

        self._traffic_log.append({
            "timestamp": str(entry.get("timestamp") or datetime.now(timezone.utc).isoformat()),
            "source_ip": ip,
            "method": method,
            "endpoint": endpoint,
            "status_code": status,
            "blocked": was_blocked,
        })

    def get_alerts(self) -> list[dict]:
        """Return a copy of all alerts in §7.4 shape."""
        return [dict(a) for a in self._alerts]

    def is_blocked(self, ip: str) -> bool:
        """Stub Phase-1 logic: membership in the in-memory blocklist."""
        return str(ip) in self._blocklist

    def get_traffic(self) -> list[dict]:
        """Return rolling list of recent traffic entries."""
        return [dict(item) for item in self._traffic_log]

    # -- internals --------------------------------------------------------
    def _prune(self, ip: str, now: float) -> None:
        max_window = max(PORT_SCAN_WINDOW_SECONDS, BRUTE_FORCE_WINDOW_SECONDS)
        for buf in (self._endpoint_hits[ip], self._not_found_hits[ip],
                    self._failed_logins[ip]):
            while buf and (now - buf[0][0] if isinstance(buf[0], tuple) else now - buf[0]) > max_window:
                buf.popleft()

    def _window_events(self, buf: deque, now: float, window: float) -> list:
        return [t for t in buf if now - (t[0] if isinstance(t, tuple) else t) <= window]

    def _cooldown_ok(self, ip: str, alert_type: str, now: float) -> bool:
        last = self._last_alert_at.get((ip, alert_type))
        return last is None or (now - last) >= ALERT_COOLDOWN_SECONDS

    def _emit(self, alert_type: str, ip: str, severity: str,
              action: str, now: float) -> None:
        assert alert_type in _VALID_TYPES
        assert severity in _VALID_SEVERITIES
        assert action in _VALID_ACTIONS
        if action == "blocked":
            self._blocklist.add(ip)
        self._last_alert_at[(ip, alert_type)] = now
        self._alerts.append(
            {
                "alert_id": str(uuid.uuid4()),
                "type": alert_type,
                "source_ip": ip,
                "severity": severity,
                "detected_at": _iso_from_epoch(now),
                "action_taken": action,
            }
        )

    def _check_port_scan(self, ip: str, now: float) -> None:
        recent = self._window_events(self._endpoint_hits[ip], now, PORT_SCAN_WINDOW_SECONDS)
        distinct = {ep for _, ep in recent}
        recent_404 = self._window_events(self._not_found_hits[ip], now, PORT_SCAN_WINDOW_SECONDS)
        triggered = (
            len(distinct) >= PORT_SCAN_DISTINCT_THRESHOLD
            or len(recent_404) >= PORT_SCAN_404_THRESHOLD
        )
        if triggered and self._cooldown_ok(ip, "port_scan", now):
            self._emit("port_scan", ip, "medium", "flagged", now)

    def _check_brute_force(self, ip: str, now: float) -> None:
        recent = self._window_events(self._failed_logins[ip], now, BRUTE_FORCE_WINDOW_SECONDS)
        if len(recent) >= BRUTE_FORCE_THRESHOLD and self._cooldown_ok(ip, "brute_force", now):
            self._emit("brute_force", ip, "high", "blocked", now)


# ---- Module-level singleton (matches the Phase-1 functional spec) --------
_default_engine = IDSDetector()


def ingest_log_entry(entry: dict) -> None:
    """Accept one log entry (delegates to the default engine)."""
    _default_engine.ingest_log_entry(entry)


def get_alerts() -> list[dict]:
    """Return alerts matching the §7.4 shape exactly."""
    return _default_engine.get_alerts()


def is_blocked(ip: str) -> bool:
    """Check the in-memory blocklist (stub until Phase 2 wiring)."""
    return _default_engine.is_blocked(ip)


def get_traffic() -> list[dict]:
    """Return recent traffic log entries."""
    return _default_engine.get_traffic()


def reset() -> None:  # helper for tests / demos; not part of the spec
    _default_engine.reset()
