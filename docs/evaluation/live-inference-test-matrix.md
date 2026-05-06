# Live Inference Test Matrix

This page defines the live-inference evidence required before claiming that
prompt-language works on top of a cloud or local model harness. It complements
the deterministic [Harness Conformance Matrix](harness-conformance-matrix.md).

## Evidence Levels

| Level                   | Meaning                                                                                     | Required before claiming success                                 |
| ----------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Static conformance      | Adapter, package script, smoke catalog, and docs wiring are present and CI-checked.         | `npm run harness:conformance`                                    |
| Bounded live smoke      | One or more selected smoke ids run against a real model with a pinned harness and timeout.  | smoke JSON with harness, model, timeout, wall time, and result   |
| Suite live smoke        | A named quick subset or full suite runs through the real harness.                           | smoke JSON plus stderr/stdout retained where the harness allows  |
| Claim-eligible live run | Full evidence bundle with trace/provenance, oracle isolation, and no blocked prerequisites. | branch, OS, model, auth state, token/cost/GPU telemetry captured |

## Harness Matrix

| Harness  | Inference class | Minimal command                                                                                                     | Primary telemetry                                              | Blocked vs failed rule                                                                 |
| -------- | --------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Codex    | cloud/frontier  | `npm run eval:smoke:codex:quick -- --only E` or `node scripts/eval/smoke-test.mjs --harness codex --quick --only E` | JSONL `turn.completed` token usage, wall time, model, timeout  | Auth/quota/model access is `blocked`; PL runtime or oracle failure is `failed`.        |
| Claude   | cloud/frontier  | `npm run eval:smoke:quick` or `node scripts/eval/smoke-test.mjs --quick --only E`                                   | Claude JSON usage/cost when available, wall time, auth state   | `Not logged in` or org access is `blocked`, not a PL failure.                          |
| Ollama   | local           | `EVAL_MODEL=ollama/qwen3:8b node scripts/eval/smoke-test.mjs --harness ollama --quick --only E`                     | wall time, model, `ollama ps`, GPU residency, timeout          | Missing model/server is `blocked`; malformed output/no progress is model-run failure.  |
| Aider    | local wrapper   | `EVAL_MODEL=ollama/qwen3:8b node scripts/eval/smoke-test.mjs --harness aider --quick --only E`                      | wall time, model, timeout, stderr retry/network classification | Missing Python/aider/Ollama is `blocked`; wrong cwd/no progress is runner failure.     |
| OpenCode | local/cloud CLI | `node scripts/eval/smoke-test.mjs --harness opencode --quick --only E`                                              | wall time, model, timeout, stdout/stderr                       | Missing CLI/auth/provider config is `blocked`; PL progress/oracle failure is `failed`. |
| Gemini   | prompt template | `node scripts/eval/smoke-test.mjs --harness gemini --quick --only E`                                                | wall time, model, timeout, stdout/stderr                       | Comparison-only until a native `prompt-language ci --runner gemini` path exists.       |
| `AI_CMD` | custom          | `AI_CMD="<command with {prompt}>" node scripts/eval/smoke-test.mjs --quick --only E`                                | command label, wall time, timeout, stdout/stderr               | Only the command template is covered unless it invokes PL itself.                      |

## Required Telemetry

Every live inference artifact should record:

- `harness`
- `harnessLabel`
- `flowCommandLabel`
- `model`
- `timeoutMs`
- `traceEnabled`
- selected smoke ids, when filtered
- pass/fail/blocked classification
- wall time
- token usage where exposed by the provider
- estimated cost for cloud/frontier calls where pricing is known
- local GPU state for Ollama-backed runs
- retry count or retry evidence where the runner exposes it
- stdout/stderr paths or retained snippets sufficient to explain failures

The smoke runner currently records `timestamp`, `os`, `nodeVersion`, `status`,
`harness`, `runnerHarness`, `harnessLabel`, `flowCommandLabel`, `model`,
`timeoutMs`, `traceEnabled`, `only`, `quickMode`, `duration_ms`, `passed`,
`failed`, and per-test `{name,label,passed,duration_ms,error}`. Blocked reports
also record `blockedReason` and `blockedDetail`, and may contain zero tests.

Still missing from the smoke report itself: commit/branch/operator, exact
invoked npm command, stdout/stderr artifact paths, token usage and estimated
cost for cloud runs, `ollama ps` / GPU residency for local runs, retry counts,
raw provider transcript paths, and trace artifact paths when tracing is enabled.

## Minimal Matrix Before Full Claims

Use this small matrix before spending time on the full suite:

| Step | Command family                      | Why                                                                  |
| ---- | ----------------------------------- | -------------------------------------------------------------------- |
| 1    | `npm run harness:conformance`       | Proves static coverage has not drifted.                              |
| 2    | Ollama `--only E` with `qwen3:8b`   | Proves local PL flow execution can create observable workspace diff. |
| 3    | Codex `--only E` with a cheap model | Proves cloud PL flow execution and token telemetry path.             |
| 4    | Claude `--only E` if logged in      | Separates auth blocker from PL runtime behavior.                     |
| 5    | One capture scenario such as `G`    | Tests model-output protocol, the weakest local-model path.           |
| 6    | One spawn scenario such as `AM`     | Tests child process state persistence and timeout handling.          |

Only after these pass should the full quick or full smoke suite be used as a
claim-level run.

## Stop Conditions

Stop the live batch and classify the result when:

- auth, quota, CLI install, or model download is missing
- any run exceeds its timeout budget
- local GPU is not engaged for an Ollama run that is expected to use GPU
- the model returns text but PL reports no observable workspace progress
- a smoke scenario passes while stderr reports a PL runtime failure
- token/cost telemetry is missing for a cloud run that is being used for cost claims
- hidden-oracle or verifier details leak into model-visible prompts
