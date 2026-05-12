# GSLR-5 Deterministic Fake-Live Result: 2026-05-12

Status: harness-plumbing proof, not model evidence  
Tracking bead: `prompt-language-gslr16`
Run id: `gslr5-raw-payload-adversarial-fake-live-2026-05-12`  
Run root:
`/tmp/prompt-language-gslr5-fake-live/gslr5-raw-payload-adversarial-fake-live-2026-05-12`

## Command

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr5-raw-payload-adversarial \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr5-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr5-raw-payload-adversarial-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr5-fake-live \
  --run-id gslr5-raw-payload-adversarial-fake-live-2026-05-12 \
  --started-at 2026-05-12T09:20:00.000Z
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
| `frontier-classify` | 0    | 1100 total      | 160           |
| `local-bulk`        | 0    | none            | none          |
| `frontier-review`   | 0    | 1900 total      | 360           |

## Interpretation

The deterministic run proves harness plumbing only: fixture copy, public gate,
private oracle, token parsing, review-defect parsing, and final verdict. It is
not model-quality evidence.

The next evidence-producing step is a live `frontier-only` baseline, because the
fixture is privacy-sensitive and intentionally adversarial. `local-only` should
remain a diagnostic lane unless the frontier baseline passes and the route
policy is reopened for local evidence.
