# Context-Adaptive Rendering Results

- **Status:** draft template for later comparison beads
- **Compared modes:** full vs compact
- **Repo version / commit:** `<fill me in>`
- **Date:** `<fill me in>`

Use the seeded baseline pack in
[`experiments/eval/context-adaptive-benchmark-pack/`](../../experiments/eval/context-adaptive-benchmark-pack/README.md)
as the starting point for future reports. The current-renderer seed artifact is
[`baseline-renderer-report.json`](../../experiments/eval/context-adaptive-benchmark-pack/baseline-renderer-report.json).
This template is for the later stage where candidate compact-mode reruns and
comparisons actually exist.

## Summary

Briefly state whether compact mode is:

- rejected
- kept experimental
- promoted toward broader use

## Benchmark setup

### Fixtures

- gate-heavy fix loops
- long sequential flows
- large-output scenarios
- resume/compaction scenarios

The current seed pack stops at those four fixture families. Prompt-capture,
spawn/await, and broader flow families can be added later if the comparison
program expands beyond the minimal `0ovo.1.4` slice.

### Metrics

- prompt bytes / turn
- changing bytes / turn
- wall-clock time
- hook startup / I/O / gate timing
- turn count
- fallback count
- correctness / recovery outcomes

## Results table

| Fixture category  | Full bytes/turn | Compact bytes/turn | Full wall-clock | Compact wall-clock | Correctness delta | Recovery delta | Notes |
| ----------------- | --------------: | -----------------: | --------------: | -----------------: | ----------------: | -------------: | ----- |
| gate-heavy        |                 |                    |                 |                    |                   |                |       |
| long sequential   |                 |                    |                 |                    |                   |                |       |
| prompt capture    |                 |                    |                 |                    |                   |                |       |
| spawn/await       |                 |                    |                 |                    |                   |                |       |
| large-output      |                 |                    |                 |                    |                   |                |       |
| resume/compaction |                 |                    |                 |                    |                   |                |       |

## Regressions

Document every meaningful regression explicitly.

## Recommendation

State one:

- keep full as default and stop here
- keep compact experimental only
- prepare compact for broader rollout

When filling this template for real comparison runs, keep the seeded baseline
report immutable and publish the candidate report as a sibling artifact rather
than rewriting the seed.
