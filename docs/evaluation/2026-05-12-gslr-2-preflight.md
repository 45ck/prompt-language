# GSLR-2 Preflight Decision: 2026-05-12

Status: implementation preflight complete  
Tracking bead: `prompt-language-gslr4`  
Companion Portarium bead: `bead-1229`

## Why This Exists

GSLR-1 produced the right negative result: the live harness worked, local-only
passed the bounded docs projection, and the hybrid arm failed as claim evidence
because it used more frontier work than the frontier-only control and carried an
unresolved blocking review defect.

Before GSLR-2, the harness needed two changes so the next run can be judged from
the manifest rather than from prose inspection:

1. a top-level final verdict that fails unresolved blocking review defects;
2. provider token telemetry promoted into manifest cost fields.

## What Changed

Generated harness manifests now include `finalVerdict`:

- `status`: `pass`, `fail`, or `not-run`;
- `oraclePassed`;
- `blockingReviewDefectCount`;
- `failedStepCount`;
- `timedOutStepCount`;
- a concise machine-readable reason.

The runner also extracts provider telemetry from step stdout/stderr. The first
supported pattern is Codex-style:

```text
tokens used
15,776
```

That value is recorded as `steps[].cost.totalTokens` with
`pricingVersion: provider-telemetry-v1`. If future providers report explicit
input, output, cached, or USD values, the same cost object has fields ready for
them.

Review steps now inspect `projection/frontier-review.md` and step output for
blocking findings. A private oracle pass plus blocking review finding is a
manifest-level fail.

## What This Proves

This does not prove hybrid routing. It proves the next hybrid-routing experiment
can no longer hide the exact GSLR-1 failure mode inside a narrative report.

For GSLR-2, a positive run must now satisfy:

- public gate pass;
- private oracle pass;
- `finalVerdict.status == "pass"`;
- no unresolved blocking review defects;
- token/cost telemetry present for frontier steps;
- lower verified frontier cost/tokens than the frontier-only control, unless
  the success metric is explicitly changed before the run.

## Next Experiment Shape

GSLR-2 should be a tiny schema/code task with tests, not another docs-only
projection. The task needs to be hard enough that local-only is not already the
best route, but small enough that public gates and a private oracle stay clear.

Recommended shape:

- one small schema or validation-rule change;
- one implementation file;
- one public test file;
- one private oracle that catches shallow or too-broad fixes;
- four arms: `local-only`, `frontier-only`, `advisor-only`, `hybrid-router`.

## Execution Record

2026-05-12:

- Added manifest-level `finalVerdict` generation.
- Added provider token telemetry extraction for Codex-style token summaries.
- Added blocking review defect extraction from frontier-review artifacts.
- Added runner/schema tests for both new verdict and telemetry behavior.
