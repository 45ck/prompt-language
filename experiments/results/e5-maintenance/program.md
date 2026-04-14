# E5 Maintenance-Viability Program

## Why E5 exists

E4 proved that prompt-language lanes score higher on a governance rubric
(`factoryQuality 10 vs 8`). That verdict is circular: the rubric rewards the
same phase structure, trace discipline, and artifact requirements that the
prompt-language flow pack supplies by construction. The codex-alone lane was
measured on whether it imitated the PL process, not on whether it produced
software a second team could run, extend, or maintain.

E5 replaces process fidelity with **product viability under a second party**.
The thesis either proves itself here or dies here.

## Thesis under test

> PL-first lanes produce software that a separate, uninvolved lane can run,
> extend, and maintain with less rework than codex-first output.

Corollary: if both outputs are equally maintainable, the prompt-language
investment is unjustified for this scope, and the thesis must retreat to a
narrower claim (e.g. auditability only).

## What stops counting

The following E4 signals are demoted to supporting context. They cannot, on
their own, support a thesis claim in E5:

- `processConformance`, `traceAuthority`, `reuseReadiness` (all judge rubrics)
- `closureQuality` (inspectable end state)
- `timeToGreenSec`, `resumeToGreenSec` (answered in E4-B02, B06)

They remain recorded for confound analysis, not verdicts.

## Throughput is not a penalty here

PL-first is **expected to take longer** than codex-first on the initial
build. The flow pack deliberately adds discovery, phase gating, verification
checkpoints, artifact requirements, and structured recovery. More checks =
more wall clock. That is the point, not a regression.

E5 therefore does not treat `timeToGreenSec` as a loss signal. It is
recorded in `supportingContext` only. A pair in which PL-first took 2–3x
longer than codex-first on the factory run, but wins family 4, is the
**expected** thesis-win shape. A pair in which PL-first is merely slower
without any family-4 advantage is the thesis-loss shape.

The only throughput-adjacent metric that counts against PL-first in E5 is
`timeToFirstInteractionSec` in family 3 — because a second engineer should
not pay PL's extra cost again at clone time. The time PL spent during
factory must be amortized into the artifact, not re-paid per-reader.

## What starts counting

Four metric families. All four must be measured on every pair. Primary
endpoint is `maintenanceViabilityIndex` (family 4). Families 1-3 are gating
preconditions: if a lane does not clear them, family 4 is recorded but the
pair is classified `build-failed` rather than compared.

### Family 1: Feature completion

Did the lane build what its own requirements doc promised?

- `featuresSpecified` — count of capabilities listed in the lane's own
  requirements/spec artifacts
- `featuresShipped` — count verified present by automated journey runs
- `featureCompletionRatio` = shipped / specified
- `deadCodeRatio` — lines of production code not reached by any passing
  journey run (coverage-tool measured)

### Family 2: Behavioral correctness

Does the built software actually behave?

- `journeyPassRate` — % of predeclared E2E journeys (see
  `harness/crm-journeys.md`) that complete against the lane's artifact
- `persistenceIntegrity` — pass/fail on restart-survives-state,
  transaction-rollback, and concurrent-write probes run by an external harness
- `contractViolations` — count of API contract mismatches against a fixed
  contract suite the lane did not author

### Family 3: Deliverability

Is it real software, or a local-only artifact?

- `runsFromCleanCheckout` — boolean: fresh clone + published setup steps
  produces a running app with zero human fixups within a 15-minute budget
- `buildArtifactValid` — boolean: declared build command produces a bundle /
  container that starts and passes a liveness probe
- `timeToFirstInteractionSec` — wall clock from `git clone` through to a
  human completing one real task against the running app

### Family 4: Maintenance viability (the thesis test)

Can a second, uninvolved lane apply new work to this output?

The mechanism: both PL-first and codex-first outputs are handed to an
independent maintenance lane (fresh session, no prior context) along with the
change-request suite in `harness/change-requests.md`. The maintenance lane
does not know which output came from which factory lane.

- `changeRequestPassRate` — % of change requests that land green (journeys
  still pass, new behavior verified) within a fixed budget
- `reworkCost` — LOC touched + files regenerated + artifacts rewritten to
  land each change, summed
- `driftResistance` — after N change requests applied sequentially, does the
  codebase still match its own docs? Measured by re-running family 1
  (featureCompletionRatio) after the suite.
- `maintenanceViabilityIndex` — weighted composite of the three above, 0-100

## Blinding

The maintenance lane must not see:

- which lane produced which output
- the flow pack, phase scripts, or prompt-language artifacts themselves
- any factory-run trace

It sees only the workspace as a second engineer would: source tree, README,
docs/, tests/. The harness operator enforces blinding by stripping any
prompt-language-specific top-level directories before handoff and logging
the diff for audit.

## Admissibility rules

A pair is `claim-eligible` for the maintenance-viability claim when:

1. Both lanes clear family 1-3 gates (otherwise classify `build-failed`)
2. The maintenance lane is blinded per the rules above
3. Change requests were declared before the factory lanes ran
4. Both outputs are handed to the same maintenance model/version/seed

A batch becomes primary-comparison eligible at N=4 counterbalanced pairs
clearing the above.

## What a thesis win looks like

- PL-first `maintenanceViabilityIndex` exceeds codex-first by a margin
  larger than the pair-level variance across at least 4 pairs
- The advantage persists when the maintenance lane is a different model
  family than the factory lane (transfer check)
- The advantage does not reduce to "PL output has more docs" alone — if
  stripping docs from both outputs collapses the gap, the real win is docs
  discipline, not flow structure

## What a thesis loss looks like

- `maintenanceViabilityIndex` within pair-variance across 4+ pairs
- Or: PL-first wins family 4 only because it wins family 1 (it shipped more
  features to begin with, not because its output is more maintainable)
- Or: codex-first wins family 4, which would indicate the PL flow produces
  harder-to-maintain output despite better governance

## Next steps

1. Finalize scorecard template at `templates/scorecard.template.json`
2. Define 5-7 CRM journeys at `harness/crm-journeys.md`
3. Define 3-5 blind change requests at `harness/change-requests.md`
4. Pilot batch E5-B01 with 2 counterbalanced pairs on the frozen CRM scope
5. Promote to primary batch E5-B02 (N=4) if pilot clears protocol
