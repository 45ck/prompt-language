# GSLR-8 Deterministic Fake-Live Result: 2026-05-13

Status: deterministic scaffold proof, not model evidence  
Run id: `gslr8-route-record-compiler-fake-live-2026-05-13`  
Run root:
`/tmp/prompt-language-gslr8-fake-live/gslr8-route-record-compiler-fake-live-2026-05-13`

## Command

```sh
REPO_ROOT=$(pwd)
node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr8-route-record-compiler \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr8-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr8-route-record-compiler-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr8-fake-live \
  --run-id gslr8-route-record-compiler-fake-live-2026-05-13 \
  --started-at 2026-05-13T09:10:00.000Z
```

## Result

| Field                           | Value                                        |
| ------------------------------- | -------------------------------------------- |
| `claimStatus`                   | `fake-live-deterministic-not-model-evidence` |
| `finalVerdict.status`           | `pass`                                       |
| `oracle.passed`                 | `true`                                       |
| `oracle.exitCode`               | `0`                                          |
| `frontier-review.reviewDefects` | `[]`                                         |

## Meaning

The deterministic lane proves the GSLR-8 fixture wiring is valid:

- the scaffold can own normalized policy constants;
- the scaffold can own the `selectedRoute` envelope;
- the hook file can remain a tiny generic predicate module;
- the private oracle can distinguish scaffold-owned invariants from model-owned
  hooks.

This is not live model evidence. The live repeat evidence is recorded in:

```text
experiments/harness-arena/results/gslr8-local-repeat-2026-05-13/report.md
```
