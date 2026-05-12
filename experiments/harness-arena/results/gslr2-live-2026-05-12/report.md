# GSLR-2 Live Policy-Schema Result: 2026-05-12

Status: live model evidence, positive local-only result, negative hybrid-cost result  
Tracking bead: `prompt-language-gslr7`  
Companion Portarium bead: `bead-1232`

## Runs

Primary hardened run:

- Run id: `gslr2-policy-schema-live-2026-05-12-02-hardened`
- Run root:
  `/tmp/prompt-language-gslr2-live/gslr2-policy-schema-live-2026-05-12-02-hardened`
- Policy version: `gslr-v0.2-policy-schema-hardened`
- Local model: `qwen3-coder:30b` through the PowerShell Ollama bridge
- Frontier runner: `codex exec`

Earlier exploratory run:

- Run id: `gslr2-policy-schema-live-2026-05-12-01`
- Result: all public/private gates passed, but the hybrid manifest was falsely
  failed because the runner parsed the Codex review prompt transcript instead of
  the task-specific `policy/frontier-review.md` artifact.
- Fix: `runner.mjs` now prefers workspace review artifacts
  (`projection/frontier-review.md` or `policy/frontier-review.md`) over command
  stdout/stderr when extracting blocking review defects.

The hardened run added malformed-input checks for `null` and array envelopes
after inspection showed the first local implementation could throw on `null`.
The final result below is therefore the hardened result, not the weaker first
run.

## Command

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 \
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only,frontier-only,advisor-only,hybrid-router \
  --fixture experiments/harness-arena/fixtures/gslr2-policy-schema \
  --oracle-command "node <repoRoot>/experiments/harness-arena/oracles/gslr2-policy-schema-oracle.mjs --workspace <workspace>" \
  --live-local-command "node <repoRoot>/experiments/harness-arena/live/gslr2-local-lane.mjs --workspace <workspace> --arm <arm> --step <stepId> --model qwen3-coder:30b" \
  --live-frontier-command "node <repoRoot>/experiments/harness-arena/live/gslr2-frontier-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --live-frontier-repair-command "node <repoRoot>/experiments/harness-arena/live/gslr2-frontier-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --local-resource-snapshot-command "node <repoRoot>/experiments/harness-arena/live/gslr2-resource-snapshot.mjs" \
  --local-resource-snapshot-interval-ms 30000 \
  --task-id gslr2-policy-schema \
  --task-brief "GSLR-2 policy schema validator live local/frontier routing run with hardened malformed-input gate" \
  --policy-version gslr-v0.2-policy-schema-hardened \
  --frontier-call-limit 6 \
  --usd-limit 5 \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 60000 \
  --command-output-limit-bytes 4194304 \
  --output-root /tmp/prompt-language-gslr2-live \
  --run-id gslr2-policy-schema-live-2026-05-12-02-hardened \
  --started-at 2026-05-12T06:20:00.000Z
```

## Hardened Result

| Arm             | Final verdict | Private oracle | Blocking review defects | Frontier tokens | Provider USD | Step wall time |
| --------------- | ------------- | -------------- | ----------------------- | --------------- | ------------ | -------------- |
| `local-only`    | pass          | pass           | 0                       | 0               | 0            | 60.548s        |
| `frontier-only` | pass          | pass           | 0                       | 45,713          | 1            | 102.126s       |
| `advisor-only`  | pass          | pass           | 0                       | 15,301          | 1            | 99.901s        |
| `hybrid-router` | pass          | pass           | 0                       | 91,279          | 3            | 201.209s       |

Local resource sampling ran for local steps. Each local step recorded two live
resource samples plus before/after snapshots.

## Interpretation

GSLR-2 is a positive result for bounded local implementation, not for the
specific hybrid route.

What it proves:

- `qwen3-coder:30b` can solve this tiny policy-schema validator task under a
  hardened public gate and private oracle.
- Prompt Language can package the work as a model-visible fixture with hidden
  policy checks, resource observations, frontier token telemetry, and a manifest
  final verdict.
- A frontier-advice plus local-apply route also passed while using fewer frontier
  tokens than frontier-only on this task.

What it does not prove:

- The `hybrid-router` policy is cost-effective for this task. It passed, but it
  used more than twice the frontier tokens of `frontier-only`.
- Frontier review should be mandatory for all tiny schema tasks. On this task,
  mandatory classify plus review dominated cost.
- Portarium should ingest live runner events or ship a product evidence card
  yet.

## Decision

Do not build Portarium product ingestion yet.

Update the route policy:

- Promote this exact task shape to `local-only` screening when the fixture has a
  strong public gate and private oracle.
- Keep `advisor-only` as a useful fallback when the local lane repeatedly fails
  or when the task has policy-sensitive edge cases but still fits in one local
  implementation file.
- Do not use `hybrid-router` for tiny schema tasks unless the classifier can skip
  final review or the review is required by a separate governance policy.

The next experiment should test whether this local-only result survives a small
family of policy/schema fixtures, not just this one validator.
