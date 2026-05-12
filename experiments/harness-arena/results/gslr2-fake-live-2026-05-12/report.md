# GSLR-2 Deterministic Fake-Live Result: 2026-05-12

Status: harness-plumbing proof, not model evidence  
Tracking bead: `prompt-language-gslr6`  
Run id: `gslr2-policy-schema-fake-live-2026-05-12`  
Run root: `/tmp/prompt-language-gslr2-fake-live/gslr2-policy-schema-fake-live-2026-05-12`

## Command

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr2-policy-schema \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr2-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr2-policy-schema-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr2-fake-live \
  --run-id gslr2-policy-schema-fake-live-2026-05-12 \
  --started-at 2026-05-12T05:40:08.000Z
```

## Result

The deterministic `hybrid-router` proof passed:

- `claimStatus`: `fake-live-deterministic-not-model-evidence`
- private oracle: pass
- `finalVerdict.status`: `pass`
- blocking review defects: `0`
- failed steps: `0`
- timed-out steps: `0`

Step telemetry:

| Step                | Exit | Token telemetry |
| ------------------- | ---- | --------------- |
| `frontier-classify` | 0    | 768 total       |
| `local-bulk`        | 0    | none            |
| `frontier-review`   | 0    | 1536 total      |

## Interpretation

This result proves that the GSLR-2 fixture, deterministic lane, private oracle,
token-telemetry parser, review-defect parser, and manifest final verdict work
together. It does not prove local-model or hybrid-routing quality.

The next evidence-producing step is a live four-arm run across `local-only`,
`frontier-only`, `advisor-only`, and `hybrid-router` with matched cost controls.
