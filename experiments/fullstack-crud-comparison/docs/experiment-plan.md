# Experiment Plan

## Research Question

Does prompt-language control improve local-model full-stack CRUD delivery compared to
a direct local-model prompt on the same task?

## Fixture

Task: `FSCRUD-01`, field-service work order tracker.

Required product surface:

- Three entities: customers, assets, and work orders.
- CRUD operations for all three entities.
- Work orders must reference customer and asset records.
- Status transition rules for work orders.
- Server-side validation for required fields and invalid references.
- A browser-facing UI for list, create, edit, detail, and delete flows.
- Seed data and a documented local start command.
- Automated tests and a deterministic verification script.

## Paired Arms

### `solo-local-crud`

The model receives [prompts/solo-local.md](../prompts/solo-local.md) and the task
brief. It may plan internally, but no prompt-language phase, retry, or review control
is applied.

### `pl-local-crud-factory`

The model runs [flows/pl-fullstack-crud-v1.flow](../flows/pl-fullstack-crud-v1.flow).
The flow enforces phase order, senior framing, architecture contract, implementation
slices, review loops, and deterministic verification.

### `pl-local-crud-tight`

The model runs
[flows/pl-fullstack-crud-tight-v2.flow](../flows/pl-fullstack-crud-tight-v2.flow).
This is a follow-up treatment for local models that can produce structured planning
JSON but stall on broad edit prompts. It decomposes the build into file-sized
instructions, each framed as senior-to-junior direction with a narrow repair gate.

### `pl-local-crud-tight-v3`

The model runs
[flows/pl-fullstack-crud-tight-v3.flow](../flows/pl-fullstack-crud-tight-v3.flow).
This supersedes `pl-local-crud-tight` for follow-up runs. It keeps the file-sized
senior-to-junior direction, switches tests to Node's built-in `node:test` runner to
avoid dependency installation ambiguity, adds an explicit browser UI slice, and
requires a final completion marker so early artifact creation cannot short-circuit
the remaining flow steps.

## Runner Policy

Use the same local model for both arms. Preferred order:

1. `qwen3-opencode:30b` if it is available and stable.
2. The strongest locally installed Ollama coding model if Qwen is unavailable.
3. A smaller local model only after one 30B smoke pair establishes the harness.

Use aider as the local edit runner unless opencode is demonstrably stable on this
host. Record the chosen runner in every run manifest.

## Timeout Policy

Local inference is slow. Timeout should prevent runaway sessions, not optimize speed.

Recommended limits:

- Solo arm wall-clock timeout: `90` minutes.
- PL arm wall-clock timeout: `150` minutes.
- Per-command timeout: `300` seconds for tests and verification.
- Per-model-turn timeout: `600` seconds.
- Retry loops: max `3` unless a gate is explicitly marked non-recoverable.

If a run times out, preserve all artifacts and classify the timeout as a run outcome,
not as missing data.

Observed follow-up on `2026-04-30`: opencode with
`ollama/qwen3-opencode-big:30b` captured `senior_frame` and
`implementation_plan` after the direct-capture runtime bridge was rebuilt, but timed
out on the broad scaffold edit prompt at both `600` and `1800` seconds without
creating files. That result motivates `pl-local-crud-tight`; increasing timeout alone
did not resolve the edit stall.

Observed tight-arm follow-up on `2026-04-30`: opencode with
`ollama/qwen3-opencode-big:30b` failed after roughly `762` seconds with no files in
`workspace/fscrud-01`. The final assistant output was a JSON-shaped `write` request
instead of an executed workspace edit. Treat `pl-local-crud-tight` as a diagnostic
probe for local runner/tool-call failure modes, not as claim-grade full-stack
evidence, until the arm enforces the full UI scope and the verifier is strengthened.

Observed native-Ollama tight follow-up on `2026-04-30`: the `ollama` runner with
`qwen3-opencode-big:30b` completed the flow and created all required v2 files, but
the verifier scored `62/100` because `npm test` failed (`jest` was not installed)
and rule coverage was incomplete. This supports using an action-executing local
runner, but also shows that v2 completion gates were too weak. Use
`pl-local-crud-tight-v3` for the next local run.

## GPU Telemetry Policy

GPU utilization is supporting telemetry. It should be captured when possible because
the user wants to verify local inference is active, but GPU percentage is not a
quality metric.

Capture at least:

- model name
- Ollama model digest if available
- runner name and version
- wall-clock duration
- sampled GPU utilization if the host exposes it
- local GPU active minutes
- timeout status

## Primary Metrics

Primary endpoint: verified product completeness.

Score the final workspace with [rubrics/fullstack-crud-rubric.md](../rubrics/fullstack-crud-rubric.md).

Gate requirements:

- install succeeds
- build or typecheck succeeds when declared
- tests pass
- verifier passes
- no fixture oracle file is read or modified
- run manifest exists

## Secondary Metrics

Secondary metrics explain why one arm won:

- CRUD coverage by entity
- route/API/UI consistency
- validation quality
- relationship integrity
- test quality
- architecture simplicity
- audit trail completeness
- intervention count
- retry count
- wall-clock time
- GPU active minutes

## Execution Phases

### Phase A: Harness Smoke

Run one paired smoke pair, `r01`.

Success means both arms finish with complete manifests, even if the product fails the
verifier.

### Phase B: Claim Batch

Run `k=3` paired repeats with counterbalanced order:

- pair 1: solo first, PL second
- pair 2: PL first, solo second
- pair 3: solo first, PL second

Do not change task, verifier, scoring rubric, model, runner, or commit during the
batch.

### Phase C: Hybrid Extension

Only after local-only results are understood, add a hybrid arm where PL routes bulk
implementation to local inference and escalates only high-risk reviews to a stronger
external model.

## Decision Rules

Claim `pl-local-crud-factory` better only if:

- PL has higher verified product completeness in at least two of three paired runs.
- PL does not have a systematic verifier bypass or artifact integrity issue.
- The win is explained by concrete gate, retry, decomposition, or traceability
  evidence.

Claim parity if:

- both arms pass verifier and differ by less than five rubric points.

Claim solo better if:

- solo passes more gates, has equal or better verified completeness, and PL overhead
  does not produce better artifacts.
