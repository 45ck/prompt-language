# GSLR-3 Live Policy-Manifest Transform Result: 2026-05-12

Status: live model evidence, negative local-screen result, positive frontier baseline
Tracking bead: `prompt-language-gslr12`
Companion Portarium bead: `bead-1237`

## Runs

Durable run roots:

- Local-only explicit model rerun:
  `/tmp/prompt-language-gslr3-live/gslr3-policy-manifest-transform-live-2026-05-12-04-local-only-explicit-model`
- Advisor-only escalation:
  `/tmp/prompt-language-gslr3-live/gslr3-policy-manifest-transform-live-2026-05-12-02-advisor-only`
- Frontier-only baseline:
  `/tmp/prompt-language-gslr3-live/gslr3-policy-manifest-transform-live-2026-05-12-03-frontier-only`

An earlier local-only exploratory run exists at
`gslr3-policy-manifest-transform-live-2026-05-12-01-local-only`, but the runner
metadata omitted `--local-model qwen3-coder:30b`. Treat the explicit-model rerun
as the clean local-only record.

## Commands

Local-only clean metadata rerun:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 \
node experiments/harness-arena/runner.mjs \
  --live \
  --arms local-only \
  --fixture experiments/harness-arena/fixtures/gslr3-policy-manifest-transform \
  --oracle-command "node <repoRoot>/experiments/harness-arena/oracles/gslr3-policy-manifest-transform-oracle.mjs --workspace <workspace>" \
  --live-local-command "node <repoRoot>/experiments/harness-arena/live/gslr3-local-lane.mjs --workspace <workspace> --arm <arm> --step <stepId> --model qwen3-coder:30b" \
  --local-model qwen3-coder:30b \
  --local-resource-snapshot-command "node <repoRoot>/experiments/harness-arena/live/gslr3-resource-snapshot.mjs" \
  --local-resource-snapshot-interval-ms 30000 \
  --task-id gslr3-policy-manifest-transform \
  --task-brief "GSLR-3 policy manifest to static evidence-card input live local-only rerun with explicit local model metadata" \
  --policy-version gslr-v0.3-policy-manifest-transform-local-first-explicit-model \
  --frontier-call-limit 0 \
  --usd-limit 1 \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 60000 \
  --command-output-limit-bytes 4194304 \
  --output-root /tmp/prompt-language-gslr3-live \
  --run-id gslr3-policy-manifest-transform-live-2026-05-12-04-local-only-explicit-model \
  --started-at 2026-05-12T07:33:00.000Z
```

Advisor-only escalation:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS=900000 \
node experiments/harness-arena/runner.mjs \
  --live \
  --arms advisor-only \
  --fixture experiments/harness-arena/fixtures/gslr3-policy-manifest-transform \
  --oracle-command "node <repoRoot>/experiments/harness-arena/oracles/gslr3-policy-manifest-transform-oracle.mjs --workspace <workspace>" \
  --live-local-command "node <repoRoot>/experiments/harness-arena/live/gslr3-local-lane.mjs --workspace <workspace> --arm <arm> --step <stepId> --model qwen3-coder:30b" \
  --live-frontier-command "node <repoRoot>/experiments/harness-arena/live/gslr3-frontier-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --local-model qwen3-coder:30b \
  --local-resource-snapshot-command "node <repoRoot>/experiments/harness-arena/live/gslr3-resource-snapshot.mjs" \
  --local-resource-snapshot-interval-ms 30000 \
  --task-id gslr3-policy-manifest-transform \
  --task-brief "GSLR-3 policy manifest to static evidence-card input live advisor-only run after local malformed-array failure" \
  --policy-version gslr-v0.3-policy-manifest-transform-advisor-after-local-fail \
  --frontier-call-limit 1 \
  --usd-limit 2 \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 60000 \
  --command-output-limit-bytes 4194304 \
  --output-root /tmp/prompt-language-gslr3-live \
  --run-id gslr3-policy-manifest-transform-live-2026-05-12-02-advisor-only \
  --started-at 2026-05-12T07:23:00.000Z
```

Frontier-only baseline:

```sh
node experiments/harness-arena/runner.mjs \
  --live \
  --arms frontier-only \
  --fixture experiments/harness-arena/fixtures/gslr3-policy-manifest-transform \
  --oracle-command "node <repoRoot>/experiments/harness-arena/oracles/gslr3-policy-manifest-transform-oracle.mjs --workspace <workspace>" \
  --live-frontier-command "node <repoRoot>/experiments/harness-arena/live/gslr3-frontier-lane.mjs --workspace <workspace> --arm <arm> --step <stepId>" \
  --task-id gslr3-policy-manifest-transform \
  --task-brief "GSLR-3 policy manifest to static evidence-card input live frontier-only baseline after local and advisor failures" \
  --policy-version gslr-v0.3-policy-manifest-transform-frontier-baseline \
  --frontier-call-limit 1 \
  --usd-limit 3 \
  --step-timeout-ms 900000 \
  --oracle-timeout-ms 60000 \
  --command-output-limit-bytes 4194304 \
  --output-root /tmp/prompt-language-gslr3-live \
  --run-id gslr3-policy-manifest-transform-live-2026-05-12-03-frontier-only \
  --started-at 2026-05-12T07:27:00.000Z
```

## Result

| Arm             | Final verdict | Private oracle | Public gate / failure boundary                                                      | Frontier tokens | Provider USD | Step wall time |
| --------------- | ------------- | -------------- | ----------------------------------------------------------------------------------- | --------------- | ------------ | -------------- |
| `local-only`    | fail          | fail           | Failed malformed input: array manifest returned `ok: true`                          | 0               | 0            | 60.550s        |
| `advisor-only`  | fail          | fail           | Frontier advice succeeded; local apply summed frontier wall time as local wall time | 3               | 3            | 107.927s       |
| `frontier-only` | pass          | pass           | Public gate and private oracle passed                                               | 33,913          | 3            | 194.822s       |

Local-only and advisor-only both recorded local resource snapshots and two
resource samples for their local steps.

## Interpretation

GSLR-3 is negative evidence for the GSLR-2 local-screen generalization.

GSLR-2 showed local-only can handle a tiny one-file validator. GSLR-3 changed
the task from validation to schema-to-schema transformation. That exposed two
semantic failures:

- local-only treated arrays as manifest objects;
- advisor-only still miscounted local wall time by including a frontier step.

The frontier-only run passed the same public gate and private oracle. The
current route for `gslr3-policy-manifest-transform` should therefore be:

```text
frontier-baseline
```

This is still a useful result. It marks the boundary between tiny schema
validation and evidence-card transformation. It also confirms that blocked
evidence-card behavior is important enough to keep in the fixture family.

## Decision

Do not promote GSLR-3 to local-screen.

Do not run hybrid-router for GSLR-3 by default. Local and advisor already failed,
and frontier-only passed. Hybrid review would be a governance requirement, not a
cost-saving route.

Update the checked-in GSLR route policy:

- keep `gslr2-policy-schema` as `local-screen`;
- set `gslr3-policy-manifest-transform` to `frontier-baseline`;
- keep GSLR-4 as a harder follow-on, but do not assume local-screen will recover
  without a new local-lane micro-repair design.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

A docs/test-only static evidence-card schema is now more justified than before,
but it should treat the current model route as frontier-baseline for this
transform shape.
