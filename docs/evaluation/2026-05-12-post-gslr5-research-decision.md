# Post-GSLR-5 Research Decision: 2026-05-12

Status: current GSLR route decision after raw-payload adversarial live evidence  
Primary bead: `prompt-language-gslr16`  
Companion Portarium bead: `bead-1241`

## What We Learned

GSLR-5 made the next Portarium-facing boundary concrete: a static evidence-card
sanitizer must preserve safe aggregate evidence while rejecting raw payload
keys, secret fields, school/person-data strings, and unsafe artifact refs.

The deterministic scaffold passed, so the fixture, public gate, private oracle,
runner final verdict, and token telemetry wiring are sound.

The live model result is sharper:

- `frontier-only` passed public gate, private oracle, and final verdict with
  53,668 frontier tokens;
- `local-only` failed before the adversarial traps by rejecting valid relative
  artifact refs on the safe card;
- a follow-up repaired local prompt passed public gate, private oracle, and
  final verdict with zero frontier tokens after artifact-ref and
  `blockingReviewDefects` semantics were made explicit;
- the selected route remains `frontier-baseline`.

## Why It Matters

This does not prove the broad thesis that PL plus local models can reduce costs
on privacy-sensitive engineering work. It proves the opposite boundary for this
task shape: when the input may contain raw school/person payloads or disguised
secret material, local-only cannot be trusted without stronger lane design and
hidden-oracle evidence.

The exciting part is that the harness now exposes the failure at the right
level. We are no longer debating whether local models are generally good or
bad. We can say which shape failed, where it failed, which prompt contract
repaired it, and what repeat evidence is still missing.

## Decision

Keep these routes:

- `gslr2-policy-schema`: `local-screen`;
- `gslr3-policy-manifest-transform`: `frontier-baseline`;
- `gslr4-two-file-validator`: `frontier-baseline`;
- `gslr5-raw-payload-adversarial`: `frontier-baseline`, with a repaired
  local-lane candidate that needs repeat evidence.

Do not build Portarium runtime ingestion or live Cockpit evidence cards yet.

Do not move MacquarieCollege raw school data or connector payloads through this
pipeline.

## Next Move

The next useful R&D task is repeat evidence for the repaired local lane, not
product integration. Specifically, rerun the repaired lane to prove it can
consistently:

- preserve valid relative artifact refs;
- reject separator-insensitive raw/secret keys;
- reject raw payload text;
- recompute action boundaries instead of trusting stale caller fields.

Only after repeated hidden-oracle passes should we revisit an advisor-only or
local-screen route for this task shape.
