"""SecureCorp IDS module (Phase 1). Re-exports the detection engine API."""

from .detector import get_alerts, ingest_log_entry, is_blocked, reset, IDSDetector

__all__ = ["ingest_log_entry", "get_alerts", "is_blocked", "reset", "IDSDetector"]
