# Comparative Eval Pattern Expansion

Date: `2026-04-12`

## Summary

This note records the additive comparative-eval coverage expansion for pattern regressions and long or nested flows in `scripts/eval/comparative-eval.mjs`.

The added range is `H101-H108`. It stays inside the existing comparative harness and does not change parser, runtime, or hook behavior.

## Added scenarios

| ID     | Pattern                                  | Main oracle                                                       |
| ------ | ---------------------------------------- | ----------------------------------------------------------------- |
| `H101` | approval checkpoint with timeout resume  | exact `checkpoint.txt` and `final.txt` contents                   |
| `H102` | retry with deterministic backoff         | exact attempt history `[1,2,4]` and `result.json`                 |
| `H103` | explicit reflection before repair        | `reflection.txt` has exactly three bullets and tests pass         |
| `H104` | parallel fan-out plus join               | `summary.txt` matches all awaited worker outputs                  |
| `H105` | variable pipeline handoff                | exact merged value plus checksum report                           |
| `H106` | memory overwrite and recall              | exact latest token and status after `remember` overwrite          |
| `H107` | long-flow stress (`12` sequential nodes) | all stage files exist and final chain is exact                    |
| `H108` | nested control stress                    | exact final status after foreach + try/catch + retry + if + break |

## Determinism notes

- The new cases use temp-dir-local scripts and file artifacts.
- No new case depends on network access, random delays, or wall-clock performance thresholds.
- The approval case uses `approve ... timeout 1` so it remains headless.
- The backoff case validates the schedule from artifacts, not from elapsed time.
- The long-flow and nested-flow cases use exact file-content oracles rather than subjective output review.

## Coverage intent

- Fill the comparative gap around approval checkpoints, backoff, reflection, parallel orchestration, variable pipelines, and memory patterns.
- Add explicit regression/stress coverage for `10+` node flows and deeply nested control structures.
- Keep the new slice runnable through the existing `--range` filter so it can be validated independently.

## Suggested commands

```bash
node scripts/eval/comparative-eval.mjs --range 101-108 --harness codex
npm run test
npm run ci
```

## Residual gaps

- The approval case only covers timeout-based continuation, not human rejection handling.
- The parallel case proves orchestration and join correctness, not wall-clock speedup.
- The memory case proves overwrite-and-recall semantics through artifacts, not every `memory.json` edge.
