# AGENT.md — Testing / Benchmarking / Documentation

Read `/PROJECT_CONTEXT.md` at the repo root first. This file only covers what's specific to this module.

## Scope

You have two jobs that happen at different times. **Early** (before other modules are done): build the mocks and stubs everyone else builds against, so nobody is blocked. **Later** (as modules complete): integration testing, benchmarking, and the GitHub deliverable itself (README, repo hygiene, demo script).

This module's early work is a dependency for almost everyone else — treat the mock-building as urgent, not as cleanup work done at the end.

## What you own

### Early phase
- Building/reviewing the mock stubs referenced in each module's `AGENT.md` (`validate_cert`, `validate_ticket`, mocked Portal API responses, synthetic traffic generator) — make sure they actually match PROJECT_CONTEXT.md's data formats exactly, since a wrong mock is worse than no mock
- Setting up the initial docker-compose skeleton (even before every service is ready, stub services help others test containerization early)

### Later phase
- Integration tests across module boundaries at each Integration Checkpoint (PROJECT_CONTEXT.md §10)
- Benchmarks: RSA vs ECC keygen time, AES throughput, IDS detection latency and false-positive rate — these are the closing numbers for the demo
- `README.md` at repo root: overview, architecture diagram, setup/run instructions, demo instructions
- Repo hygiene: `.gitignore`, branch protection, checking commit distribution across teammates
- Owning (or assigning) the end-to-end demo script — someone must be responsible for the full 6-act flow working live, independent of any single module owner

## What you do NOT own

- Do not write module implementation code (crypto, backend routes, etc.) — your mocks are stand-ins for testing, not production implementations. If a mock starts growing into real functionality, that's a sign it should move to the owning module.

## Dependencies

None blocking your early-phase work — mocks are built from the contracts in PROJECT_CONTEXT.md, not from other modules' code. Later-phase work (integration testing, benchmarking) naturally depends on other modules being far enough along, which is expected and why it's sequenced later.

## Deliverables checklist

- [ ] `shared/mocks/` populated with stubs matching every mock referenced across the 7 `AGENT.md` files
- [ ] `docker-compose.yml` skeleton exists early, even with placeholder services
- [ ] Integration test suite runs at each of the 4 checkpoints in PROJECT_CONTEXT.md §10
- [ ] Benchmark numbers collected and documented (keygen time, AES throughput, IDS latency/false-positive rate)
- [ ] `README.md` complete: overview, architecture diagram, `docker-compose up` setup instructions, demo walkthrough
- [ ] `.gitignore`, branch protection on `main`, and commit distribution verified before submission
- [ ] Named owner assigned for the full end-to-end demo script, confirmed with the team
