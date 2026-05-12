# GSLR-6 Deterministic Fake-Live Result: 2026-05-13

Status: harness-plumbing proof, not model evidence  
Tracking bead: `prompt-language-gslr20`  
Run id: `gslr6-scaffolded-sanitizer-fake-live-2026-05-13`  
Run root:
`/tmp/prompt-language-gslr6-fake-live/gslr6-scaffolded-sanitizer-fake-live-2026-05-13`

## Command

```sh
REPO_ROOT="$(pwd)"

node experiments/harness-arena/runner.mjs \
  --fake-live \
  --arms hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr6-scaffolded-sanitizer \
  --fake-step-command "node ${REPO_ROOT}/experiments/harness-arena/live/gslr6-deterministic-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --oracle-command "node ${REPO_ROOT}/experiments/harness-arena/oracles/gslr6-scaffolded-sanitizer-oracle.mjs --workspace <workspace>" \
  --output-root /tmp/prompt-language-gslr6-fake-live \
  --run-id gslr6-scaffolded-sanitizer-fake-live-2026-05-13 \
  --started-at 2026-05-13T00:20:00.000Z
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

| Step                | Exit | Token telemetry | Cached tokens | Wall time |
| ------------------- | ---- | --------------- | ------------- | --------- |
| `frontier-classify` | 0    | 1000 total      | 180           | 0.024s    |
| `local-bulk`        | 0    | none            | none          | 0.051s    |
| `frontier-review`   | 0    | 1700 total      | 340           | 0.025s    |

## Interpretation

This proves fixture and harness plumbing only:

- the model-visible fixture exposes fixed sanitizer helper boundaries;
- the public gate checks helper behavior and sanitizer composition;
- the private oracle checks the helper boundary plus adversarial sanitizer
  behavior;
- runner final verdict, private-oracle artifacts, token parsing, and review
  defects are wired correctly.

It does not prove local-model capability or route promotion.

## Next Step

Run GSLR-6 local live repeats only after deciding which local model/lane prompt
owns the scaffolded helper contract. Promotion still requires three clean local
repeats with zero frontier tokens, public gate pass, private oracle pass, and
`finalVerdict.status == "pass"`.
