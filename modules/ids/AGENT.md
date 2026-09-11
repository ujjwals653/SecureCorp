# AGENT.md — IDS / Attack Detection

Read `/PROJECT_CONTEXT.md` at the repo root first. This file only covers what's specific to this module.

## Scope

You are building two things: (1) an intrusion detection system that watches traffic to the server and flags/blocks port scans and brute-force attempts, with a live dashboard, and (2) Mallory's actual attack scripts used in Act 5 of the demo. Both live in this module since they're two sides of the same demo beat.

## What you own

- Traffic monitoring / log ingestion from the server
- Detection logic (ML classifier or rule-based — a simple classifier is fine for a course demo; don't over-engineer this at the expense of it working live)
- The live dashboard showing detected alerts (see PROJECT_CONTEXT.md §7.4 for alert shape)
- An auto-block mechanism (can be simulated — e.g. adding an IP to a blocklist the Portal API checks — doesn't need to be a real firewall rule for the demo, but should visibly work)
- Mallory's attack scripts: port scan script, brute-force login script, targeting the Portal API

## What you do NOT own

- Do not implement RBAC or the "Eve denial" logic — that's Backend's job, it's a separate mechanism from IDS detection (Act 6 vs Act 5).
- Do not modify Backend's core routes beyond what's needed to expose logs/traffic data to you — coordinate the log format with Backend rather than reaching into their code.

## Dependencies

**Live traffic from Portal API — needed only for final validation.** You do not need the real backend running to build the classifier or Mallory's scripts. Build and test against synthetic traffic or a recorded/simulated log file first:

```python
# Use this for development — a synthetic log generator standing in for real traffic
# Replace with real log ingestion from Backend at Integration Checkpoint 4
def generate_synthetic_traffic():
    ...
```

Full validation — does the classifier actually catch a real Mallory run against the real live server — only happens at Integration Checkpoint 4, right before the full dry run. Don't treat earlier synthetic-data results as sufficient by themselves.

## Interface you must expose

```python
ingest_log_entry(entry: dict) -> None       # called per request/connection observed
get_alerts() -> list[alert_json]            # matches §7.4 shape, consumed by dashboard and optionally /ids/alerts
is_blocked(ip: str) -> bool                 # Portal API can check this if you wire in live blocking
```

Mallory's scripts should be separate, clearly-labeled files (e.g. `mallory_portscan.py`, `mallory_bruteforce.py`) runnable standalone from a separate machine/terminal, not folded into the detection code.

## Definition of done

- [ ] Classifier/rule engine correctly flags a synthetic port-scan pattern and a synthetic brute-force pattern
- [ ] `get_alerts()` returns alerts matching the exact shape in PROJECT_CONTEXT.md §7.4
- [ ] Dashboard displays alerts as they're generated (can be tested against synthetic data feed)
- [ ] Mallory's scripts run standalone against a target host:port and are documented (README in this folder) with exact run instructions for the live demo
- [ ] At Integration Checkpoint 4: classifier correctly detects a real Mallory run against the real server within an acceptable latency for a live demo
