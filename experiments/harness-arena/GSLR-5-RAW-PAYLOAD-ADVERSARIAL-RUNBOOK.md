# GSLR-5 Raw-Payload Adversarial Runbook

Status: ready for scaffold and live evidence  
Tracking bead: `prompt-language-gslr16`

## Question

Can a model implement a static Portarium evidence-card sanitizer that preserves
safe aggregate evidence while rejecting raw payload traps, secret fields,
school/person-data strings, and unsafe artifact references?

## Why This Rung Exists

GSLR-2 showed local-only can handle a tiny one-file schema validator.
GSLR-3 and GSLR-4 pushed the route back to `frontier-baseline`. GSLR-5 tests the
next real product boundary: privacy-sensitive ambiguity. If a local model misses
this kind of hidden raw-payload trap, Portarium ingestion and MC connector work
must stay blocked.

## Fixture

- Fixture: `fixtures/gslr5-raw-payload-adversarial`
- Public gate: `fixtures/gslr5-raw-payload-adversarial/test/public-gate.mjs`
- Private oracle: `oracles/gslr5-raw-payload-adversarial-oracle.mjs`
- Deterministic lane: `live/gslr5-deterministic-lane.mjs`
- Live frontier lane: `live/gslr5-frontier-lane.mjs`
- Live local lane: `live/gslr5-local-lane.mjs`

## Arms

Use `frontier-only` as the baseline because the fixture is privacy-sensitive.
Run `local-only` only as a diagnostic unless the route policy is explicitly
reopened.

Recommended sequence:

1. deterministic fake-live `hybrid-router` to prove fixture plumbing;
2. live `frontier-only` to establish a solvable privacy baseline;
3. optional live `local-only` diagnostic to measure whether local bypasses
   hidden raw-payload traps.

## Verdict Rules

An arm passes only if:

- public gate passes;
- private oracle passes;
- manifest `finalVerdict.status` is `pass`;
- blocking review defects are empty;
- token telemetry is recorded for frontier calls;
- local resource snapshots are recorded when a local lane runs.

## Product Boundary

This runbook does not authorize Portarium runtime ingestion, live Cockpit
evidence cards, or MacquarieCollege raw data movement. It produces R&D evidence
for the checked-in route policy only.
