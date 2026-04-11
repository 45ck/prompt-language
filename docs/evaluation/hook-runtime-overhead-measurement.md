# Hook Runtime Overhead Measurement

## Status

Reproducible overhead-capture path for bead `prompt-language-0ovo.1.3`.

This note does not claim that production hooks now emit overhead telemetry.
It provides a stable benchmark path and reporting format so startup, state I/O,
render work, and gate work can be measured independently on the current codebase.

## Canonical Command

Run the benchmark from the repo root:

```sh
node scripts/eval/hook-runtime-overhead.mjs --iterations 15 --warmup 3
```

Optional JSON artifact:

```sh
node scripts/eval/hook-runtime-overhead.mjs --iterations 15 --warmup 3 --json-out experiments/results/hook-runtime-overhead.json
```

Contract check for the benchmark itself:

```sh
node scripts/eval/hook-runtime-overhead.mjs --iterations 3 --warmup 1 --self-check
```

## Measurement Buckets

| Bucket          | Measurement path                                                                                | Why it exists                                                              |
| --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `startup`       | repeated `tsx` probe launches, recorded at the first executable line after module import        | captures hook/runtime bootstrap cost separately from steady-state work     |
| `stateLoad`     | `FileStateStore.loadCurrent()` against a temp `.prompt-language` workspace                      | isolates session-state read overhead                                       |
| `stateSave`     | `FileStateStore.save()` against the same temp workspace                                         | isolates session-state write overhead                                      |
| `renderFull`    | `renderFlow()` on a representative active state                                                 | captures current full-render cost                                          |
| `renderCompact` | `renderFlowCompact()` on the same state                                                         | gives the compact-render comparison point without mixing in startup or I/O |
| `gateEval`      | `evaluateCompletion()` over structured artifact/approval gates using in-memory state and runner | captures gate-engine work without external command noise                   |

## Reporting Format

Record:

- date
- git ref or branch label
- OS and shell
- Node version
- `tsx` version
- exact command used
- iteration and warmup counts

Then paste one timing table:

| Bucket        | median ms | p95 ms | mean ms | min ms | max ms |
| ------------- | --------: | -----: | ------: | -----: | -----: |
| startup       |     0.000 |  0.000 |   0.000 |  0.000 |  0.000 |
| stateLoad     |     0.000 |  0.000 |   0.000 |  0.000 |  0.000 |
| stateSave     |     0.000 |  0.000 |   0.000 |  0.000 |  0.000 |
| renderFull    |     0.000 |  0.000 |   0.000 |  0.000 |  0.000 |
| renderCompact |     0.000 |  0.000 |   0.000 |  0.000 |  0.000 |
| gateEval      |     0.000 |  0.000 |   0.000 |  0.000 |  0.000 |

And one attribution line:

- `render median = <renderFull.medianMs>`
- `non-render median = <startup + stateLoad + stateSave + gateEval medians>`

Keep this note with the result:

> Non-render median is an attribution aid, not a literal end-to-end hook total.

## Closure Fit

This slice is enough for `0ovo.1.3` when:

- the benchmark command runs reproducibly on a workstation
- startup, state read, state write, render, and gate buckets are all present
- render and non-render overhead can be reported separately
- the benchmark validates its own output shape via `--self-check`

## Related Docs

- [Render Telemetry Model](../design/render-telemetry-model.md)
- [Context-Adaptive Benchmark Pack](context-adaptive-benchmark-pack.md)
- [Context-Adaptive Results Template](context-adaptive-rendering-results-template.md)
