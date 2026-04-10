# Smoke Coverage Status

This note records the current smoke-test status after the evaluation-stack, Codex headless, and late AA-AO smoke slices landed.

It replaces the older pre-implementation gap analysis that assumed `approve`, `review`, and several Codex-backed cases were still missing.

## Current state

- The smoke suite now spans `A` through `AO`.
- The quick Codex slice currently passes `27/27` through `npm run eval:smoke:codex:quick`.
- `npm run eval:smoke` is still required for supported-host live validation, but it is blocked on this workstation by missing Claude auth/login.

## Coverage snapshot

| Area                   | Current status | Evidence surface                                            |
| ---------------------- | -------------- | ----------------------------------------------------------- |
| `approve`              | Covered        | `AA` quick smoke plus runtime/parser tests                  |
| `review`               | Covered        | `AB` quick smoke plus judge/review runtime tests            |
| `remember` + `memory:` | Covered        | `AC`, `AJ`, memory-store tests, and prefetch behavior       |
| `spawn` / `await`      | Covered        | `AM`, `AN`, headless spawner tests, Codex quick smoke       |
| `foreach-spawn`        | Covered        | `AE` in the full suite, runtime tests                       |
| `send` / `receive`     | Covered        | `AF` in the full suite, message-store tests                 |
| `race`                 | Covered        | `AD` in the full suite, runtime tests                       |
| `grounded-by` branches | Covered        | `AK` quick smoke and grounded-by unit/runtime coverage      |
| `continue` in loops    | Covered        | `AI`, `AL`, parser/runtime tests                            |
| `import`               | Covered        | `AG`, `AH`, `AO`, import parsing/rendering coverage         |
| eval / dataset tooling | Covered        | `prompt-language eval`, dataset-runner tests, saved reports |

## Residual gaps

These are the remaining real gaps, not stale parser assumptions:

- supported-host live smoke with Claude access is still blocked in this environment
- slow full-suite smoke cases remain intentionally outside the quick Codex subset
- parity on Linux/macOS/WSL with live smoke and comparative runs is still open

## Quick subset vs full suite

`npm run eval:smoke:codex:quick` is now a strong fast regression signal, but it deliberately skips the slow or higher-coordination cases:

- `D`, `J`, `L`, `M`, `O`, `P`, `R`, `S`, `T`, `X`, `Y`, `AD`, `AE`, `AF`

Those still belong to the full smoke or supported-host parity path.

## Implementation note

The `AK` grounded-by case now uses tiny helper scripts created inside the temp workspace rather than a complex inline shell predicate. That keeps the test deterministic on Windows shells and avoids confusing command-parser edge cases in the smoke harness itself.
