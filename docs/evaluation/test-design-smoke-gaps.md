# Smoke Coverage Status

This note records the current smoke-test status after the evaluation-stack, Codex headless, late AA-AO smoke slices, and AX-BA state/agent slices landed.

It replaces the older pre-implementation gap analysis that assumed `approve`, `review`, and several Codex-backed cases were still missing.

## Current state

- The smoke suite now spans `A` through `BA`, with quick and full subsets called out in the smoke runner.
- Historical evidence records an older quick Codex slice at `27/27` through `npm run eval:smoke:codex:quick`.
- That quick-smoke result should be treated as non-current unless it is rerun on this branch.
- Current post-`7ae85ec` bounded smoke evidence exists for `--only E`: Ollama
  `qwen3:8b`, Codex `gpt-5.2`, and Claude CLI all passed `1/1` on win32. See
  [Live Smoke Evidence: 2026-05-06](2026-05-06-live-smoke-evidence.md).
- These are bounded live-smoke passes, not quick-suite or claim-grade full-suite evidence.

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
| snapshot / rollback    | Covered        | `AX`, `BA`, snapshot store tests                            |
| agent metadata         | Covered        | `AY`, `AZ`, headless spawner tests                          |
| eval / dataset tooling | Covered        | `prompt-language eval`, dataset-runner tests, saved reports |

## Residual gaps

These are the remaining real gaps, not stale parser assumptions:

- supported-host live smoke evidence must be regenerated on the current branch before making a live claim
- native Windows can inspect smoke history and run repo-local commands, but historical Windows notes do not prove current live parity
- slow full-suite smoke cases remain intentionally outside the quick Codex subset
- parity on Linux/macOS/WSL with live smoke and comparative runs is still open

## Quick subset vs full suite

`npm run eval:smoke:codex:quick` is a strong fast regression signal when rerun on the current branch, but it deliberately skips the slow or higher-coordination cases:

- `D`, `J`, `L`, `M`, `O`, `P`, `R`, `S`, `T`, `X`, `Y`, `AD`, `AE`, `AF`, `Z5`, `Z6`, `Z7`, `AR`, `AY`, `AZ`

Those still belong to the full smoke or supported-host parity path.

## Implementation note

The `AK` grounded-by case now uses tiny helper scripts created inside the temp workspace rather than a complex inline shell predicate. That keeps the test deterministic on Windows shells and avoids confusing command-parser edge cases in the smoke harness itself.
