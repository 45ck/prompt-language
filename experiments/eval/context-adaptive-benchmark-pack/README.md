# Context-Adaptive Benchmark Pack

Seeded benchmark-pack assets for bead `prompt-language-0ovo.1.4`.

This directory is the checked-in baseline slice for the context-adaptive
rendering program. It does three things:

- locks a minimal representative fixture inventory
- records the current renderer as the reference baseline family
- gives later comparison beads a stable pack to rerun without reopening the
  fixture-definition question

It does not claim that compact-mode execution, telemetry-backed measurements, or
promotion evidence already exist. Those remain later beads.

## Files

| File                            | Purpose                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `fixtures.json`                 | Minimal benchmark inventory covering gate-heavy, long-flow, large-output, and recovery |
| `baseline-renderer-report.json` | Current-renderer reference artifact for the seeded pack                                |

## Seeded fixtures

| Fixture id                | Category     | What it stresses                                                           |
| ------------------------- | ------------ | -------------------------------------------------------------------------- |
| `ca-pack.gate-heavy.v1`   | gate-heavy   | Repeated validate/gate loops and prompt churn from enforcement output      |
| `ca-pack.long-flow.v1`    | long-flow    | Multi-step diagnosis, edit, rerun, and follow-up correction continuity     |
| `ca-pack.large-output.v1` | large-output | Diagnosis quality when decisive clues are buried late in verbose output    |
| `ca-pack.recovery.v1`     | recovery     | Resume safety after interruption, checkpoint handoff, and compressed state |

## How later beads should use this pack

1. Reuse the fixture ids in `fixtures.json` rather than inventing new labels.
2. Treat `baseline-renderer-report.json` as the locked current-renderer
   reference point.
3. Publish candidate reruns and comparison summaries as separate artifacts
   rather than mutating the seed report in place.

## Deliberate limits

This pack is intentionally small. It is enough to make the baseline categories
concrete and to support later reruns, but it is not the final benchmark bank
for the full context-adaptive program.
