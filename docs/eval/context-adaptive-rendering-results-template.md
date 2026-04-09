# Context-Adaptive Rendering Results

- **Status:** draft template
- **Compared modes:** full vs compact
- **Repo version / commit:** `<fill me in>`
- **Date:** `<fill me in>`

## Summary

Briefly state whether compact mode is:

- rejected
- kept experimental
- promoted toward broader use

## Benchmark setup

### Fixtures

- gate-heavy fix loops
- long sequential flows
- prompt-capture / ask-like flows
- spawn/await flows
- large-output scenarios
- resume/compaction scenarios

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
