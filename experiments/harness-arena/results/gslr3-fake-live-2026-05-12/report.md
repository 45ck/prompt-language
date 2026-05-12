# GSLR-3 Deterministic Fake-Live Result: 2026-05-12

Status: harness-plumbing proof, not model evidence  
Tracking bead: `prompt-language-gslr10`  
Run id: `gslr3-policy-manifest-transform-fake-live-2026-05-12`  
Run root:
`/tmp/prompt-language-gslr3-fake-live/gslr3-policy-manifest-transform-fake-live-2026-05-12`

## Command

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr3-policy-manifest-transform \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr3-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr3-policy-manifest-transform-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr3-fake-live \
  --run-id gslr3-policy-manifest-transform-fake-live-2026-05-12 \
  --started-at 2026-05-12T07:05:00.000Z
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

| Step                | Exit | Token telemetry | Cached tokens |
| ------------------- | ---- | --------------- | ------------- |
| `frontier-classify` | 0    | 850 total       | 128           |
| `local-bulk`        | 0    | none            | none          |
| `frontier-review`   | 0    | 1400 total      | 320           |

## Interpretation

This result proves that the GSLR-3 fixture, deterministic lane, private oracle,
token parser, cached-token parser, review-defect parser, and manifest final
verdict work together.

It does not prove local-model quality. The next evidence-producing step is a
live run, starting with the `local-only` arm under the `local-screen` hypothesis.
