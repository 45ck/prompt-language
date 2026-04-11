# Spec 003 — Run State and Recovery

## Goal

Evolve `.prompt-language/session-state.json` into a richer, inspectable run-state layout without breaking current tooling.

## Proposed layout

.prompt-language/
session-state.json
runs/
<run-id>/
manifest.json
plan/approved-plan.md
gates/latest.json
logs/runtime.log
approvals/history.jsonl
children/index.json
artifacts/index.json
recovery/checkpoints.jsonl
rendered/workflow.flow
diagnostics/doctor.json
cache/
hooks/
guidance/

## Migration

### v1 compatibility

- keep `session-state.json` as the canonical compatibility surface
- derive its content from the active run manifest when richer state exists

### v2 addition

- add `runs/<run-id>/...`
- emit a migration marker
- teach `doctor` to detect partial migrations

## Recovery surfaces

- recover latest active run
- reopen last child topology
- render last pending gate
- show last failing command
- point to exact recovery files

## Why this matters

A single flat state file is enough for execution, but not enough for operator-grade debugging, history, and supervised recovery.

## Acceptance criteria

- old flows still run
- recovery commands can locate the last failing gate and command
- child-flow relationships are inspectable after interruption
- cleanup and retention policies exist
- state layout is documented as additive, not disruptive
