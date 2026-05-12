# GSLR-4 Deterministic Fake-Live Result: 2026-05-12

Status: harness-plumbing proof, not model evidence  
Tracking bead: `prompt-language-gslr14`  
Run id: `gslr4-two-file-validator-fake-live-2026-05-12`  
Run root:
`/tmp/prompt-language-gslr4-fake-live/gslr4-two-file-validator-fake-live-2026-05-12`

## Command

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr4-two-file-validator \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr4-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr4-two-file-validator-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr4-fake-live \
  --run-id gslr4-two-file-validator-fake-live-2026-05-12 \
  --started-at 2026-05-12T08:10:00.000Z
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
| `frontier-classify` | 0    | 950 total       | 128           |
| `local-bulk`        | 0    | none            | none          |
| `frontier-review`   | 0    | 1600 total      | 320           |

## Interpretation

This result proves that the GSLR-4 fixture, two implementation files, public
gate, deterministic lane, private oracle, token parser, cached-token parser,
review-defect parser, and manifest final verdict work together.

It does not prove local-model quality. The next evidence-producing step is a
live `advisor-only` run, with a `frontier-only` baseline if advisor passes.
