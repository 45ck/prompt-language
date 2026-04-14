# E5 Maintenance-Viability Index — Formula Spec

## Purpose

E5 compares prompt-language-first (PL-first) and codex-first factory outputs on
whether a blind second lane can extend them. This document fixes the
aggregator formula used to turn a filled-in scorecard into a single composite
score per lane plus a pair-level verdict. It is the precedent-setting math:
once a pair is scored under these weights, later pairs must be re-scored
consistently if the weights change.

All thresholds and weights in this doc are **initial values for batch
E5-B01**. They are explicitly marked as tunable after the first 4 pairs
(batch E5-B02) once we can see the empirical distribution of each family.

## Family-level scores (each in [0, 1])

### Family 1 — Feature completion

`F1 = clamp(featuresShipped / featuresSpecified, 0, 1)`

Direct ratio of what was asked for vs. what the lane actually built. Clamped
because future iterations may oversupply features and a ratio > 1 should not
inflate the composite. `featuresSpecified = 0` yields `F1 = 1` (nothing to
miss) but also trips the F1 gate as degenerate — see gating.

### Family 2 — Behavioral correctness

`F2 = journeyPassRate * 0.9^persistenceProbeFailures`

Journey pass rate is the base. Each failed persistence probe (restart
survival, transaction rollback, concurrent write) multiplies by `0.9`.
Three probes failing drops a lane from `1.0` to `0.729`, which is enough to
cross the F2 gate downward while not erasing an otherwise-working build.

**Tunable**: `0.9` per-probe penalty. If persistence failures turn out to be
all-or-nothing in practice, replace with a gate rather than a soft multiplier.

### Family 3 — Deliverability

```
F3 = runsFromCleanCheckout
   * buildArtifactValid
   * 1 / (1 + timeToFirstInteractionSec / 300)
```

Both booleans must be true or `F3 = 0`. Given they pass, the time-to-first-
interaction factor decays from `1.0` at 0s toward `0` as time grows. At the
target `300s` (5 min) it yields `0.5`; at 15 min it yields `0.25`.

**Tunable**: target of `300s`. Picked as "a second engineer can have a hot
loop in 5 minutes". Will be re-evaluated after observing actual clone-to-
interaction times in B01.

### Family 4 — Maintenance composite (the thesis test)

```
F4 = clamp(
  changeRequestPassRate
  * (1 - reworkCostNormalized)
  * (1 + driftDelta),
  0, 1
)
```

Where:

- `reworkCostNormalized = min(totalReworkUnits / 500, 1)`. 500 units is the
  "a reasonable CR touched about half a thousand lines/files" ceiling. A lane
  that needed 500+ units to land one CR is treated as fully penalized on
  rework for that CR.
- `driftDelta = featureCompletionRatioPostSuite - featureCompletionRatioPreSuite`.
  Positive values mean applying the CR suite actually improved coverage of
  the original spec (rare but possible); negative values mean the code drifted
  away from its docs. Clamp to `[0, 1]` at the end because negative drift
  combined with perfect CR pass rate should not make F4 negative.

**Tunable**: the `500` rework denominator. It encodes an opinion about what
"expensive" means; it will shift once we see real CR diffs.

## Composite score

```
maintenanceViabilityIndex = 100 * (0.15*F1 + 0.20*F2 + 0.15*F3 + 0.50*F4)
```

**Weights** (`0.15, 0.20, 0.15, 0.50`):

- F4 at `0.50` — F4 is the thesis test and must dominate, otherwise a lane
  that ships features but is unmaintainable wins, inverting the claim.
- F2 at `0.20` — behavioral correctness is a prerequisite for maintainability
  to mean anything, but it is also gated, so its composite weight is modest.
- F1 at `0.15` — completeness matters but is already constrained by the F1
  gate; weighting it higher would double-count the spec-completion signal.
- F3 at `0.15` — deliverability is binary-ish in practice; the weight
  captures the soft time-to-interaction term.

Weights sum to `1.00` so the index is naturally bounded in `[0, 100]`.

**Tunable**: weights. The `0.50` on F4 is the one that must not drop below
`0.40` without a thesis rewrite. Others can shift after B01.

## Gating rules (cause `build-failed`)

A lane that fails any gate is classified `build-failed-<laneName>` and its
`maintenanceViabilityIndex` is recorded as `null`. `F4` is still computed
and stored so we can inspect maintenance behavior of failed builds, but it
does not enter a comparative verdict.

- **F1 gate**: `featureCompletionRatio >= 0.80` — picked because below 80%
  the lane did not build enough of its own spec to ask maintenance questions
  about. Also rejects the degenerate `featuresSpecified = 0` case.
- **F2 gate**: `journeyPassRate >= 0.85` AND all three persistence probes
  pass — if journeys don't pass at baseline, CR results are meaningless.
  0.85 leaves room for one flaky journey in a 7-journey suite.
- **F3 gate**: `runsFromCleanCheckout === true` — a lane that doesn't
  install is a lane nobody can maintain, so F3 hard-gates.

**Tunable**: `0.80` and `0.85` thresholds. If B01 shows both lanes clearing
or both lanes missing them, these are too loose or too strict respectively.

## Pair verdict

Let `pl = maintenanceViabilityIndex(PL-first)` and
`co = maintenanceViabilityIndex(codex-first)`.

- If either is `null` (gate fail): `comparativeVerdict = inconclusive`,
  annotated `build-failed-<laneName>`.
- If `pl - co > 5`: `prompt-language-better`.
- If `co - pl > 5`: `codex-alone-better`.
- Otherwise: `inconclusive`.

**Tunable**: `5` point margin. Chosen to be larger than expected per-pair
noise on a 0–100 scale but small enough that a 5-point-plus gap in 4 pairs
would already be suggestive. Revisit after B01 variance is measured.

## Partial-data fallback (reworkCost null)

Git-derived rework numbers can be null when a workspace is not a git tree
(e.g. factory lane skipped init). In that case the aggregator drops the
rework term from F4:

```
F4_partial = clamp(changeRequestPassRate * (1 + driftDelta), 0, 1)
```

This is marked in the per-lane summary with a `warnings` entry so reviewers
know the number is optimistic — rework is almost never zero, so omitting it
biases F4 upward.

## Open calibration questions for B02

1. Does the `0.9^probeFailures` penalty actually separate builds, or is it
   too gentle?
2. Does the `500`-unit rework normalizer produce too-small `F4` terms on
   real CRs, or too large?
3. Is the 5-point pair margin within or outside pair-level variance once
   we have 4 pairs to measure?
4. Does `driftDelta` ever go positive, or is it effectively a one-sided
   penalty term that should be reframed?

Any change to the numbers above after B01 must be accompanied by a
re-scoring of B01 under the new constants and a diff of the comparative
verdicts so precedent drift is visible.
