# E4 Research Method

This directory uses a lightweight comparative rubric so each E4 attempt ends with a result that is
clear enough to compare and modest enough to defend.

The scorecards are not a claim of statistical significance. They are a structured summary of
observed evidence from the run artifacts.

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
- `artifactCompleteness`: whether the required docs/code artifacts were present

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
- one lane is repeated after fixes while the other lane is not rerun under the same conditions
- the sample size is too small to claim stable superiority

## Required Artifacts

Every repeatable E4 run should now end with:

- `outcome.md`
- `postmortem.md`
- `interventions.md`
- `scorecard.json`

The canonical longitudinal summaries are:

- [comparison.md](./comparison.md)
- [analysis-2026-04-12.md](./analysis-2026-04-12.md)
