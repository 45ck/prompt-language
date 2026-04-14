# E4 Claim Families (ksih.1)

Authoritative definition of the three E4 claim families. Every run must declare one primary family.
The family determines which primary endpoint is preregistered, which metrics must be present for
admissibility, and how the verdict is computed.

---

## Overview

The three families address orthogonal research questions:

| Family | Question | Primary endpoint |
| --- | --- | --- |
| **Throughput** | Which lane completes the fixed slice faster? | `timeToGreenSec` |
| **Factory-quality** | Which lane produces a more governed, inspectable factory result? | `factoryQualityOverall` |
| **Recovery** | Which lane resumes more successfully after interruption? | `resumeToGreenSec` + `recoveredAfterInterruption` |

A run that attempts to answer more than one question simultaneously is **not admissible** for any of
them unless the protocol for each family is independently satisfied.

---

## Family 1: Throughput (archived S0)

### Research question

Which lane, starting from the same clean workspace, reaches a verified green state on the shared
bounded product contract in less wall-clock time?

### Status

This family is **archived** for the bounded CRM `S0` slice. `B02` is the definitive batch-level
answer: `codex-alone-better` (median 719.79 s vs 1514.34 s, both order strata). Further throughput
runs on the same scope and runtime are supporting context only unless the prompt-language control
surface changes materially.

### Primary metric

`timeToGreenSec` — wall-clock seconds from harness start signal to the moment the shared
verification contract passes for the first time (lint + typecheck + test all green in the same
run).

### Secondary metrics (exploratory, cannot overturn primary verdict)

- `timeToFirstRelevantWriteSec` — time to first relevant file write in the target workspace
- `interventionCount` — number of human interventions during the timed envelope
- `restartCount` — number of full harness restarts
- `runtimeFailureCount` — failures attributable to runtime/toolchain, not product code

### Admissibility rules

A run is admissible for a throughput claim only when **all** of the following hold:

1. Both lanes ran under the same harness version on the same frozen commit and model version.
2. Both lanes completed the same common product contract (same verification suite).
3. The timed work envelope is identical for both lanes (start signal and stop signal are defined
   identically in the run spec).
4. The run includes raw timing evidence (harness timestamps, not self-reported).
5. Lane timing was not contaminated by steps outside the bounded envelope (e.g. extra validation
   gates that only one lane runs).
6. Order effects were addressed: the batch must have at least two pairs in each run order
   (codex-first, pl-first) before a batch-level throughput superiority claim is made.

### Verdict rules

- `prompt-language-better`: PL median `timeToGreenSec` < codex median in both order strata.
- `codex-alone-better`: codex median < PL median in both order strata.
- `mixed`: one stratum favors PL, the other favors codex.
- `parity`: medians within 10% and no stratum shows consistent direction.
- `inconclusive`: fewer than four clean pairs, or order counterbalance not satisfied.

Batch-level throughput claim requires at least four completed clean pairs (two per order) with no
harness-fatal exclusions on a fixed predeclared schedule.

### Failure classification

When a lane does not reach green, classify the failure before comparing timing:

- `product`: the agent produced code that does not pass the verification contract.
- `runtime`: the harness, toolchain, or process spawner failed independent of product code.
- `config`: workspace setup, path, or permission failure before any product work began.
- `evidence`: the run completed but timing or verification evidence is missing or unreliable.

Only `product` failures are comparable across lanes. `runtime`, `config`, and `evidence` failures
invalidate the pair for throughput admissibility.

---

## Family 2: Factory-quality

### Research question

Which lane produces a more governed, inspectable, reusable factory result — independently of how
fast it got there?

### Current status

**Active.** `B04` (pilot) and `B05` (primary) both returned `prompt-language-better` with
`factoryQualityOverall` of 10 vs 8 across four counterbalanced pairs. This is the strongest current
E4 claim.

### Primary metric

`factoryQualityOverall` — sum of the five factory-quality scorecard dimensions, each scored 0–2:

| Dimension | What it measures | Score 0 | Score 1 | Score 2 |
| --- | --- | --- | --- | --- |
| `closureQuality` | How completely the run reached a closed, inspectable end state | No closure artifacts | Partial closure | Full closure: all required artifacts present and internally consistent |
| `processConformance` | How clearly the lane followed an explicit factory process rather than ad hoc improvisation | No visible process | Process partially followed; gaps or improvisation | Strong conformance: every phase has evidence, no improvisation |
| `traceAuthority` | How strong and inspectable the evidence trail is | No raw traces | Traces present but incomplete or unverifiable | Full raw traces with verification evidence |
| `reuseReadiness` | Whether the factory artifacts are reusable for a future run or by a second team | One-off, not reusable | Partially reusable with manual effort | Fully reusable: docs, templates, and gates are self-contained |
| `claimStrength` | Whether the scorecard can be grounded in concrete evidence citations | No evidence citations | Some dimensions cited | All dimensions have concrete evidence references |

### Secondary metrics

- `artifactContractPass` — boolean: all required SDLC artifacts present
- `interventionBurden` — interventions per productive hour (lower is better for PL)
- `verificationPassRate` — fraction of required verification steps (lint, typecheck, test, build)
  that passed
- `reuseReadiness` (also primary dimension)

### Admissibility rules

A run is admissible for a factory-quality claim only when **all** of the following hold:

1. Both lanes ran on the same common product contract (same artifact requirements, same verification
   suite).
2. Both lanes have complete `lane-summary.json`, `artifact-inventory.json`, `scorecard.json`, and
   `postmortem.json`.
3. Every scored dimension in the scorecard cites at least one concrete evidence reference.
4. Prompt-language-only control artifacts (e.g. `session-state.json`, `.prompt-language/audit.jsonl`)
   are not used to downgrade the codex baseline on product completion dimensions.
5. The timing envelope used is `paired-factory-quality` (not `paired-throughput`): the envelope
   covers the full factory run from first process start to closure artifact write, not just
   time-to-first-green.

### Verdict rules

- `prompt-language-better`: PL `factoryQualityOverall` > codex in both pairs of a counterbalanced
  batch, and the difference is driven by at least two distinct scorecard dimensions.
- `codex-alone-better`: codex `factoryQualityOverall` > PL in both pairs.
- `mixed`: one pair favors PL, the other favors codex; or the overall scores are equal but driven
  by different dimensions.
- `parity`: scores equal across both pairs.
- `inconclusive`: evidence is missing for one or more scored dimensions, or fewer than two
  counterbalanced pairs are complete.

Batch-level factory-quality claim requires at least four counterbalanced pairs with consistent
direction before the verdict is promoted from pilot to primary.

### Failure classification

Same taxonomy as throughput: `product`, `runtime`, `config`, `evidence`. A lane with a `product`
failure may still yield useful factory-quality evidence if the closure artifacts explain the failure
clearly. A lane with an `evidence` failure (missing artifacts) cannot be scored on
`closureQuality`, `traceAuthority`, or `claimStrength` and must be excluded from comparison.

---

## Family 3: Recovery

### Research question

After a simulated mid-run interruption, which lane resumes more successfully — and how much
additional time does recovery require?

### Current status

**Pilot.** `B06` returned `codex-alone-better` at pilot strength (supporting context only). Direct
Codex recovered in 145–190 s; PL had one partial failure and one 1011 s recovery. Not yet
claim-eligible because the S2 protocol has not been repeated in a predeclared batch.

### Primary metrics

- `resumeToGreenSec` — wall-clock seconds from resume signal to next verified green state
- `recoveredAfterInterruption` — boolean: the lane reached green after resume (with or without
  human intervention)

### Secondary metrics

- `resumeInterventionCount` — human interventions after the resume signal
- `statePreservationQuality` — was the pre-interruption work preserved usable by the resumed lane
  (0 = none, 1 = partial, 2 = complete)
- `recoveryQuality` — 0–2 ordinal: how cleanly the lane found its position and resumed without
  re-doing completed work

### Admissibility rules

A run is admissible for a recovery claim only when **all** of the following hold:

1. The interruption point is predeclared and identical for both lanes in the pair (e.g., both
   interrupted after phase 2 of 3 completes, or after a fixed elapsed time).
2. The resume signal is delivered identically (same harness command for both lanes).
3. Both lanes had reached the same approximate product state at the interruption point (verified by
   inspecting workspace snapshots taken at interruption time).
4. The run spec was declared before either lane started (no post-hoc protocol adjustment).
5. Raw traces are retained for both the pre-interruption and post-interruption segments.

### Verdict rules

- `prompt-language-better`: PL `resumeToGreenSec` < codex AND `recoveredAfterInterruption` is true
  for PL in both counterbalanced pairs.
- `codex-alone-better`: codex `resumeToGreenSec` < PL, or PL partial failure while codex reaches
  green.
- `mixed`: one metric favors each lane.
- `inconclusive`: fewer than two counterbalanced recovery pairs, or interruption point diverged
  between lanes.

---

## Cross-family rules

### Claiming across families

A single run may produce evidence relevant to multiple families, but **only the declared primary
family is preregistered**. Secondary family evidence from the same run is labeled `supporting-context`
and cannot be used as a basis for superiority claims in the secondary family.

### Downgrade path

If a run declares `factory-quality` as primary but the closure artifacts are missing or unreliable,
the run must be reclassified to `supporting-context` before the scorecard is finalized. It cannot
be retroactively reclassified to `throughput` to rescue a comparison.

### Pilot vs primary

Pilot batches exist for instrumentation and directional evidence only. A pilot batch must not be
retroactively expanded into the primary claim batch. If a pilot changes the harness, scoring
dimensions, or admissibility rules, a fresh predeclared batch must begin.

### Required metrics for every run

Every closed run must record the following, regardless of primary family. Fields that were not
instrumented must be recorded as `null` with a note explaining why:

```
timeToGreenSec
timeToFirstRelevantWriteSec
interventionCount
restartCount
runtimeFailureCount
failureClass
traceCompleteness
closureCompleteness
traceAuthority
artifactContractPass
processConformance
recoveryQuality
reuseReadiness
```
