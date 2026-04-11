# 2026-04-12 Summary Safety Large-Output Comparison Report

- Date: 2026-04-12
- Scope: `prompt-language-0ovo.4.3`
- Status: comparison artifact created, execution evidence still blocked
- Closure judgment: **not closure-ready**

## Purpose

This page is the self-contained benchmark-comparison artifact for the
large-output slice of summary-safety validation.

It does three things in one place:

1. names the exact large-output scenarios that matter for this bead
2. records the comparison frame between full-detail and summary-oriented modes
3. writes down explicit regression notes and current evidence gaps instead of
   leaving them implied across multiple planning notes

This report does **not** invent runtime results that the repo has not yet
produced. It is the checked-in comparison record that later executed evidence
must populate or replace.

## Comparison frame

Compared modes:

- `full_baseline`: best available full-detail path
- `summary_candidate`: summary-oriented path under the policy defined by
  `0ovo.4.1`
- `summary_resume_candidate`: same candidate through interruption or resume
  where a scenario genuinely needs it

Current repo position on 2026-04-12:

- the summary policy is now documented
- the safety-validation contract for large-output behavior is documented
- this repo page now records the comparison artifact shape
- executed compact-versus-full evidence for the large-output scenarios below is
  **not yet checked in**

## Large-output scenario set

These are the three required large-output scenarios from the validation
contract, restated here so this report can stand on its own.

| Scenario ID | Goal                                             | Required pressure pattern                                                     | Why it matters to summary safety                                                         |
| ----------- | ------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `loq-01`    | recover the right fix from late stderr           | decisive error near tail of command stderr                                    | summary can hide the real clue if truncation or abstraction is too aggressive            |
| `loq-02`    | recover the right fix from noisy test output     | long test output with irrelevant failures before the actionable assertion     | summary can over-focus on an early wrong clue and push a broad or incorrect fix          |
| `loq-03`    | navigate from summary to artifact-backed raw log | main render shows summary plus raw-output handle, clue exists only in raw log | summary is only safe if the operator or agent can actually recover the raw evidence path |

## Comparison matrix

The rows below are the concrete comparison record for this bead's large-output
slice.

Legend:

- `not run`: no locked execution evidence exists yet
- `blocked`: a required prerequisite for honest execution is still missing
- `n/a`: the run family is not required for that scenario

| Scenario ID | Run family                 | Execution status | Candidate judgment | Material regression | Notes                                                                           |
| ----------- | -------------------------- | ---------------- | ------------------ | ------------------- | ------------------------------------------------------------------------------- |
| `loq-01`    | `full_baseline`            | not run          | unknown            | unknown             | baseline evidence bundle not yet checked in                                     |
| `loq-01`    | `summary_candidate`        | blocked          | unknown            | unknown             | no locked candidate run or raw-output reference evidence checked in             |
| `loq-01`    | `summary_resume_candidate` | n/a              | n/a                | n/a                 | not a required resume scenario                                                  |
| `loq-02`    | `full_baseline`            | not run          | unknown            | unknown             | baseline evidence bundle not yet checked in                                     |
| `loq-02`    | `summary_candidate`        | blocked          | unknown            | unknown             | no locked candidate run or raw-output reference evidence checked in             |
| `loq-02`    | `summary_resume_candidate` | n/a              | n/a                | n/a                 | not a required resume scenario                                                  |
| `loq-03`    | `full_baseline`            | not run          | unknown            | unknown             | baseline evidence bundle not yet checked in                                     |
| `loq-03`    | `summary_candidate`        | blocked          | unknown            | unknown             | artifact-backed raw-evidence navigation path is not yet evidenced for this bead |
| `loq-03`    | `summary_resume_candidate` | n/a              | n/a                | n/a                 | not a required resume scenario                                                  |

## What this report can say today

The current repo evidence is strong enough to say:

- large-output safety is a real evaluation problem, not a hypothetical one
- the three large-output scenarios above are the right minimum comparison slice
- no candidate summary mode should be promoted without per-scenario evidence for
  `loq-01` through `loq-03`

The current repo evidence is **not** strong enough to say:

- the summary candidate ties or beats the full baseline on any large-output case
- artifact-backed recovery from summary output is already safe in practice
- no material regression exists

## Explicit regression notes

This section is intentionally explicit. The absence of executed evidence is not
the same thing as the absence of regressions.

### Regression note 1: no candidate evidence means regression status is unknown

For all three large-output scenarios, `summary_candidate` regression status is
currently unknown because the repo does not yet contain:

- a locked baseline bundle
- a locked candidate bundle
- an evaluator verdict showing whether the decisive late clue was recovered

Implication:

- any claim that the candidate is "safe enough" for large-output handling would
  itself be an evidence regression against the documented standard

### Regression note 2: artifact-backed navigation remains unproven

`loq-03` is the scenario most likely to hide a summary-safety regression. The
whole point of that scenario is to test whether the summary can point to raw
evidence without losing the decisive clue.

Current gap:

- there is no checked-in run proving that a summary plus raw-evidence handle is
  sufficient to recover the correct fix path

Current judgment:

- treat this as an open regression risk, not as a neutral or passing tie

### Regression note 3: "not run" on baseline is also a real blocker

This page does not assume the full-detail path passes by default.

If `full_baseline` is not executed and locked first:

- the comparison has no ground truth
- candidate failures cannot be classified honestly
- suspicious candidate wins cannot be trusted

Current judgment:

- missing baseline execution remains a closure blocker, not a paperwork issue

## Required evidence before promotion

This bead is only closure-ready when this report can be updated with executed
results for all three large-output scenarios and every row above is replaced
with locked evidence.

Minimum required per-scenario evidence:

- `manifest.json`
- `rendered-context.md`
- `validation.json`
- `evaluator-verdict.json`
- `raw-evidence-paths.json`

Minimum required report updates:

- baseline outcome
- candidate outcome
- root-cause delta
- safety delta
- explicit material-regression decision
- notes naming the decisive clue and whether the raw path was consulted

## Current decision

Decision for `prompt-language-0ovo.4.3` large-output comparison on 2026-04-12:

- keep open
- do not promote any summary-safety claim from design intent alone
- do not collapse the missing comparison evidence into a generic "no regressions observed" statement

## Related

- [Context-Adaptive Summary Safety Validation](context-adaptive-summary-safety-validation.md)
- [Context-Adaptive Benchmark Pack](context-adaptive-benchmark-pack.md)
- [Context-Adaptive Results Template](context-adaptive-rendering-results-template.md)
- [Output Summarization Policy](../design/output-summarization-policy.md)
- [Summary and Rendering Policy](../reference/summary-and-rendering-policy.md)
