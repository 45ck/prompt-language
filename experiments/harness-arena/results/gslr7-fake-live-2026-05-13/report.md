# GSLR-7 Deterministic Fake-Live Result: 2026-05-13

Status: harness-plumbing proof, not model evidence  
Tracking bead: `prompt-language-gslr22`  
Run id: `gslr7-scaffolded-route-record-fake-live-2026-05-13`  
Run root:
`/tmp/prompt-language-gslr7-fake-live/gslr7-scaffolded-route-record-fake-live-2026-05-13`

## Command

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr7-scaffolded-route-record \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr7-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr7-scaffolded-route-record-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr7-fake-live \
  --run-id gslr7-scaffolded-route-record-fake-live-2026-05-13 \
  --started-at 2026-05-13T02:30:00.000Z
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

| Step                | Exit | Token telemetry | Wall time |
| ------------------- | ---- | --------------- | --------- |
| `frontier-classify` | 0    | none            | 0.043s    |
| `local-bulk`        | 0    | none            | 0.041s    |
| `frontier-review`   | 0    | none            | 0.041s    |

## Interpretation

This proves fixture and harness plumbing only:

- the model-visible fixture exposes fixed route-record helper boundaries;
- the public gate checks route selection, escalation reason derivation, unsafe
  evidence key/text rejection, safe artifact refs, and output field limits;
- the private oracle checks helper exports, self-import rejection, malformed
  input behavior, and stronger adversarial cases;
- runner final verdict and private-oracle artifacts are wired correctly.

It does not prove local-model capability or route promotion.
