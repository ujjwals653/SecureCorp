"""
MOCK — synthetic traffic generator.

Real dependency: live traffic from modules/backend (see modules/backend/AGENT.md)
Used by: modules/ids, to build and test the classifier before the real
server is up, until Integration Checkpoint 4.

Swap instructions:
  Replace calls to generate_synthetic_traffic() with real log ingestion
  wired into modules/backend's request handling. The shape of each log
  entry below is a reasonable guess at what Backend will emit — confirm
  the real field names with the Backend owner before Checkpoint 4 and
  update this file's shape to match if it drifts.

IMPORTANT: results from this synthetic generator are for classifier
development only. Do not report detection latency or false-positive
rate numbers from synthetic data as if they were the real benchmark —
PROJECT_CONTEXT.md §10 requires real traffic validation at Checkpoint 4.
"""

import random
import time
import uuid


def _normal_entry():
    return {
        "source_ip": f"10.0.0.{random.randint(2, 50)}",
        "endpoint": random.choice(["/api/files/inbox", "/api/keys/bob", "/api/files/upload"]),
        "method": random.choice(["GET", "POST"]),
        "status_code": 200,
        "timestamp": time.time(),
    }


def _port_scan_entry(source_ip):
    return {
        "source_ip": source_ip,
        "endpoint": f"/probe-{random.randint(1, 9999)}",
        "method": "GET",
        "status_code": 404,
        "timestamp": time.time(),
    }


def _brute_force_entry(source_ip):
    return {
        "source_ip": source_ip,
        "endpoint": "/api/auth/login",
        "method": "POST",
        "status_code": 401,
        "timestamp": time.time(),
    }


def generate_synthetic_traffic(n_normal=200, n_attack_bursts=2):
    """
    MOCK. Returns a list of log entries: mostly normal traffic, with a
    couple of injected attack bursts (port scan + brute force) so the
    classifier has something to actually detect during development.

    Real implementation should ingest actual request logs from
    modules/backend via ingest_log_entry(), per modules/ids/AGENT.md.
    """
    entries = [_normal_entry() for _ in range(n_normal)]

    for _ in range(n_attack_bursts):
        attacker_ip = f"192.168.1.{random.randint(100, 200)}"
        entries += [_port_scan_entry(attacker_ip) for _ in range(30)]
        entries += [_brute_force_entry(attacker_ip) for _ in range(20)]

    random.shuffle(entries)
    return entries


def sample_alert():
    """
    MOCK. Returns one example alert matching PROJECT_CONTEXT.md §7.4
    exactly, for testing the dashboard without a live classifier run.
    """
    return {
        "alert_id": str(uuid.uuid4()),
        "type": "port_scan",
        "source_ip": "192.168.1.150",
        "severity": "medium",
        "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "action_taken": "flagged",
    }
