# Implementation Phases

## Phase 1 — foundation

Deliver:

- `Report`, `Diagnostic`, `Outcome` types
- code ranges
- exit-code derivation helper
- JSON output support for `validate` and `run`

Success criteria:

- core types compile
- exit codes are deterministic
- a simple run can produce an empty `diagnostics[]` and a success outcome

## Phase 2 — reclassification

Reclassify current behavior into:

- diagnostics
- outcomes

Priority cases:

- gate false vs gate evaluation crash
- approval denied vs approval unsupported
- retry/loop/review budget exhaustion
- capture retry exhausted with empty-value fallback
- resume-state corruption

Success criteria:

- existing failures stop collapsing into generic runtime errors
- normal flow outcomes are visible but not misclassified

## Phase 3 — profile checks in `validate`

Add:

- `--runner`
- `--mode`
- profile-specific compatibility checks
- blocking behavior for semantic changes
- warnings for UX-only gaps

Success criteria:

- incompatible profiles are blocked before execution
- UX-only gaps remain warnings

## Phase 4 — test and docs hardening

Add:

- unit tests for classification and exit codes
- regression tests for diagnostics JSON
- smoke coverage for preflight blockers and outcome classification
- docs updates across CLI and reference pages

Success criteria:

- stable machine-readable output
- no silent semantic fallback
- clear docs for users and CI callers
