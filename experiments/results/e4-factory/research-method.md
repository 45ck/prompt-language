# E4 Research Method

This directory uses a lightweight comparative rubric so each E4 attempt ends with a result that is
clear enough to compare and modest enough to defend.

The scorecards are not a claim of statistical significance. They are a structured summary of
observed evidence from the run artifacts.

The framework distinguishes:

- a run that is **closed**
- a run that is **useful context**
- a run that is **admissible for throughput claims**

## Research Questions

For each bounded software-factory run, answer three questions:

1. Did the candidate complete the fixed product slice?
2. How credible is the evidence behind that claim?
3. Relative to the baseline, where is the advantage or disadvantage?

## Rubric

Each lane is scored on eight dimensions using a `0..2` ordinal scale:

- `0`: poor / failed / missing
- `1`: partial / mixed / usable with caveats
- `2`: strong / complete / low-friction

### Product Outcome

- `scopeCompletion`: whether the intended bounded slice was actually built
- `verification`: whether `lint`, `typecheck`, and `test` passed
- `artifactCompleteness`: whether the required docs/code artifacts were present against the lane's
  declared artifact contract

### Operational Quality

- `setupSimplicity`: how much launcher/path/runtime friction occurred
- `auditability`: how strong and inspectable the evidence trail is

### Research Strength

- `experimentalControl`: how clean and interpretable the comparison is
- `automationIntegrity`: how little human rescue or rerunning was required
- `repeatabilityEvidence`: whether the result has been reproduced or independently corroborated

## Totals

Each scorecard records three subtotal bands:

- `productOutcome`: max `6`
- `operationalQuality`: max `4`
- `researchStrength`: max `6`

The `overall` total is the sum of those bands, max `16`.

Interpret totals carefully:

- totals are useful for trend tracking across runs
- totals are not a substitute for reading the run narrative
- comparative verdicts should always be justified in prose, not by numbers alone

## Admissibility

Every run must declare one admissibility class:

- `primary-comparison`: paired A/B evidence on the same scope and runtime
- `supporting-context`: useful evidence, but not admissible for raw throughput claims
- `historical-failure`: legacy setup/runtime evidence kept for diagnosis

Only `primary-comparison` runs may support raw throughput claims, and only when:

- both lanes ran under the same patched runtime conditions
- both lanes completed the same common product contract
- throughput metrics are present for both lanes
- the run has complete raw traces for both lanes
- the timed work envelope is comparable between lanes
- order effects have been addressed through a predeclared counterbalanced batch

If any of those are missing, the run may still be closed, but it is not admissible for throughput
superiority claims.

## Required Metrics

For future runs, each lane should record these first-class metrics:

- `timeToGreenSec`
- `timeToFirstRelevantWriteSec`
- `interventionCount`
- `restartCount`
- `runtimeFailureCount`
- `failureClass`
- `traceCompleteness`

Historical runs may backfill these as `null` when the evidence was not instrumented at the time.

## Comparative Verdicts

Use one of:

- `prompt-language-better`
- `codex-alone-better`
- `parity`
- `mixed`
- `inconclusive`

`mixed` is preferred whenever one candidate is better on one dimension and worse on another.

## Threats To Validity

Treat a run as weakened when any of these apply:

- runtime bugs distort the result
- workspace state diverges from persisted state
- top-level evidence files are missing and secondary artifacts must be trusted instead
- one lane is penalized for missing control artifacts that only apply to the other lane
- one lane is timed across extra validation or gate steps that are outside the other lane's envelope
- a single fixed-order pair is used to make a throughput-superiority claim
- one lane is repeated after fixes while the other lane is not rerun under the same conditions
- the sample size is too small to claim stable superiority

## Required Artifacts

Every repeatable E4 run should now end with:

- `run.json`
- `outcome.md`
- `postmortem.md`
- `interventions.md`
- `scorecard.json`
- `trace-summary.md`

## Score Evidence

Each scorecard lane must cite at least one concrete evidence reference for every scored dimension.
Those references should point to raw traces, outcome docs, postmortems, or other authoritative run
artifacts.

## Artifact Contracts

Each lane must declare its own required artifact contract.

- the paired comparison should still use the same common product contract for both lanes
- lane-specific control artifacts may be added on top of that shared contract
- prompt-language-only control files must not be used to downgrade a direct Codex baseline on
  product completion

The canonical longitudinal summaries are:

- [comparison.md](./comparison.md)
- [analysis-2026-04-12.md](./analysis-2026-04-12.md)

## Trace Requirement

Claims about why one lane is better, worse, or inconclusive must be backed by raw trace artifacts
from the actual sessions.

At minimum:

- direct Codex lanes should retain their raw event stream plus verification logs
- prompt-language lanes should retain persisted state, audit logs, and lane-level verification logs
- every run should include `trace-summary.md` that explains which files are authoritative and what
  they imply

## Batch-Level Claims

Throughput superiority belongs to the batch, not to a single pair.

- per-run scorecards may remain `primary-comparison` and still have `throughputClaimEligible: false`
- a batch becomes throughput-claim eligible only after the batch summary confirms:
  - at least four completed clean pairs
  - at least two pairs in each order
  - no harness-fatal exclusions
  - a fixed predeclared schedule on one frozen commit/model/control surface

Until then, per-run timing reads are useful context only.
