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
