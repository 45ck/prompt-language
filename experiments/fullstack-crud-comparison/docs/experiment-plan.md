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

Use the same local model for both arms. Preferred order after the `2026-04-30`
local-runner probes:

1. Native `ollama` runner with `qwen3-opencode-big:30b` or the strongest stable
   locally installed coding model.
2. `opencode` only after a separate runner-contract smoke proves that local model
   responses execute real workspace edits instead of emitting inert tool-call text.
3. A smaller local model only after one 30B smoke pair establishes the harness.

Record the chosen runner in every run manifest. Do not mix runners inside a
claim batch.

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

Observed v3 follow-up on `2026-04-30`: native `ollama` failed during the first
capture step with `PLR-007` / `fetch failed`, while the Ollama service was healthy
afterward. Treat this as transient runner/transport instability, not evidence
against the v3 flow. The harness should retry transient Ollama fetch failures and
must not run post-failure `npm install` / `npm test` steps that mutate partial
workspaces.

Observed retry follow-up on `2026-04-30`: after adding transient fetch retry,
native `ollama` failed in under one second with `model runner has unexpectedly
stopped`; the model then appeared in `ollama ps` at `21%/79% CPU/GPU` and a direct
chat succeeded. Treat cold-start model-runner stops as retryable for this host.

Observed capture-leak follow-up on `2026-04-30`: after retrying cold starts, native
`ollama` spent roughly `18` minutes in the first `senior_frame` capture turn,
created several future implementation files, and then failed with the action round
limit. Treat this as a capture-envelope isolation bug: local action runners must
see only the active capture task and must be blocked from writing workspace files
while a `.prompt-language/vars/...` capture is pending.

Observed capture-isolation follow-up on `2026-04-30`: after adding hard capture
isolation, native `ollama` no longer leaked future implementation files during the
first `senior_frame` turn. The run failed cleanly with an empty workspace because the
runner did not recognize the JSON-capture wording `Save your JSON answer to ...` as
a capture path. Treat this as a parser coverage bug in the local runner, not a
product-quality outcome.

Observed JSON-capture follow-up on `2026-04-30`: after fixing JSON-capture path
detection, native `ollama` successfully captured `senior_frame` and advanced to the
second planning capture, but the `implementation_plan` turn spent roughly `26`
minutes and ended with `fetch failed`. Treat broad planning captures as unstable on
this host. For the next tight local run, keep the senior frame capture but bake the
file-by-file implementation plan directly into the slice prompts so the model spends
GPU time on artifact creation instead of another planning capture.

Observed tight-plan follow-up on `2026-04-30`: after baking the file-by-file plan
into the slice prompts, native `ollama` successfully captured `senior_frame` and
created `workspace/fscrud-01/package.json`. The next package repair/review turn then
failed with `ENOENT` after the model tried to read `package.json` relative to the
run root instead of `workspace/fscrud-01/package.json`. The verifier scored the
partial workspace `23/100` with only `package.json` present. Treat this as another
runtime/runner diagnostic, not a product-quality or hypothesis outcome. The runner
must feed file-action failures back to the model instead of aborting the turn, and
long local runs should use explicit action-round and timeout settings.

Observed path-rooting follow-up on `2026-04-30`: after file-action failures were fed
back to the model, the tight flow advanced past package repair but the model wrote
`src/domain.js` at the run root instead of under `workspace/fscrud-01`. After adding
workspace-rooting for relative file actions, the next run created
`workspace/fscrud-01/src/domain.js` and reached a verifier score of `38/100`, but
the generated domain layer was still shallow and failed the strict domain review
after `2/2` repair rounds. Treat this as evidence that the senior/junior PL flow
needs stronger behavioral scaffolding for domain implementation, not as a completed
PL-vs-solo comparison.

Next domain-slice change: strict review feedback must carry grounded evidence back
to the local model. The domain gate now prints missing terms, the repair critique
includes stdout/stderr evidence, and the domain prompt explicitly requires CommonJS
exports plus exact operation/status terms. This tests whether tighter senior-style
feedback can move the same local model past the domain bottleneck without switching
to an external model.

Observed senior-feedback follow-up on `2026-04-30`: the more detailed domain prompt
made the local model stall. It spent roughly `70` minutes in the domain turn, reached
round `13`, produced no workspace action, and ended with `fetch failed`; the partial
workspace fell back to only `package.json` and verifier `23/100`. Treat this as
evidence against large dense domain prompts for this local model. The next variant
uses a shorter imperative senior instruction: one `write_file` action for
`src/domain.js`, no reads, explicit required terms, and then `done`.

Observed imperative-domain follow-up on `2026-04-30`: the shorter domain instruction
avoided the long stall and produced `workspace/fscrud-01/src/domain.js`, but the
model still failed strict review after `3/3` rounds. The improved critique correctly
included exact missing terms from stderr, yet the model overwrote the file with a
tiny partial module instead of applying the missing terms. Verifier stayed at
`23/100`. Treat this as evidence that this local model needs stronger structure than
natural-language repair prompts for the domain layer. The next hypothesis should test
PL-provided scaffolds or executable contract tests before free-form implementation.

Next scaffold-contract hypothesis: a deterministic senior scaffold plus executable
contract tests should move the same local model further than prompt-only domain
repair. The treatment flow is `pl-fullstack-crud-scaffold-contract-v1.flow`. It
pre-creates canonical CommonJS exports and `__tests__/domain.contract.test.js`, then
asks the model to fill `src/domain.js` under a compact Senior Card protocol:
`GOAL`, `FILE`, `MUST`, `KEEP`, `CHECK`, and `REPAIR`. This isolates the value of
prompt-language structure and contract feedback; the scaffold provides shape and
tests, not completed business logic.

Observed scaffold-contract diagnostic on `2026-04-30`: the paired native-Ollama
run `live-fscrud-r20-ollama-scaffold-contract-v1-20260430-1902` used
`qwen3-opencode-big:30b`. The solo arm produced only `package.json` and scored
`22/100`. The scaffold arm created the deterministic scaffold and scored `76/100`,
with seed integrity passing but `domain_behavior_failed` because `src/domain.js`
still threw `reset not implemented`. Do not treat R20 as a claim-grade comparison:
the scaffold flow used an initial `review` block whose body prompt consumed the next
model turn with a no-op diagnostic response before the domain implementation prompt
ran. The follow-up fix replaces that check with a deterministic `run` gate and
adds explicit status vocabulary to the scaffold contract.

Observed scaffold-contract follow-up on `2026-04-30`: the native-Ollama R21 run
`live-fscrud-r21-ollama-scaffold-contract-v1-20260430-1920` advanced past the fixed
deterministic scaffold gate. The solo arm reached `38/100`, with missing UI, seed
integrity, and domain behavior. The scaffold arm created the full deterministic
scaffold, passed the precheck, scored `80/100`, and then failed with runner code `3`
because Ollama exhausted the 8 action-round limit at the first broad `src/domain.js`
implementation prompt without modifying the stub. Treat R21 as runtime/prompt-shape
evidence, not claim-grade product evidence. The next variant splits domain
implementation into a customers/assets foundation card followed by a work_order rules
card.

Observed split-domain scaffold follow-up on `2026-04-30`: the native-Ollama R22 run
`live-fscrud-r22-ollama-scaffold-split-domain-v1-20260430-2010` did not produce
claim-grade evidence. The solo arm failed with `PLR-007` / `fetch failed` and scored
`4/100`. The scaffold arm did improve on R21 by editing `src/domain.js`, but the edit
used the wrong export shape (`createCustomer`/`updateCustomer` style ESM stubs instead
of the required CommonJS `list/read/detail/edit` surface) and failed the first
customer/assets foundation review after `2/2` rounds. The verifier again scored the
scaffold arm `80/100`, with `domain_behavior_failed` and missing required exports.
Treat R22 as evidence that splitting the prompt can trigger action, but not enough
behavioral control. The next variant tightens exact export preservation, `write_file`
repair actions, work_order create/edit validation, safe delete rules, and concrete
server/UI contracts; consider raising the Ollama action-round budget for that run.

R23 export-shape hypothesis: the same scaffold-contract treatment should surface the
R22 failure earlier, before the final verifier, by rejecting ESM `export` syntax and
`update*` aliases inside the first domain review. The treatment remains intentionally
narrow: keep the deterministic scaffold and executable contract tests, but require a
CommonJS-only `src/domain.js` with `module.exports` assigning the exact
`list/read/detail/edit/delete` function names. Success for this smoke is not a
PL-vs-solo claim; it is evidence that export-shape control moves the scaffold arm past
the `domain_behavior_failed` bottleneck.

Observed R23 export-shape follow-up on `2026-05-04`: the native-Ollama R23 run
`live-fscrud-r23-ollama-scaffold-export-contract-v1-20260504-0813` was still
diagnostic, not claim-grade. The solo arm improved to `52/100` but lacked browser UI,
valid seed integrity, and executable domain behavior. The scaffold arm again reached
`80/100` with only `domain_behavior_failed`; the new review guard failed earlier, at
the first domain foundation card, but the model wrote only alternate update-style
exports inside `module.exports`. Treat this as evidence that negative-name wording can
prime the local model toward the wrong identifiers. The next variant keeps forbidden
identifier checks in deterministic code, but removes those wrong names from
model-facing prompts and emphasizes a positive exact `module.exports` contract plus
runtime export probing.

R24/R25 export-surface treatment: keep all model-facing instructions positive-only,
then remove the remaining wrong-name exposure from deterministic probe output as well.
The scaffold flow should validate the domain module by loading CommonJS
`module.exports`, comparing the exact sorted export key list, and emitting generic
diagnostics such as `module_exports_surface_mismatch`, `module_exports_non_function`,
and `domain_module_load_failed`. This tests whether local-model repair improves when
the flow stops repeating incorrect identifiers anywhere that can leak into critique.

Scoring rule for the next comparison: runner, transport, and timeout failures are
`runtime_failed` or `timeout_partial`, not product-quality failures and not evidence
for or against the PL-vs-solo hypothesis. A claim-grade comparison requires both arms
to run from the same commit, task, verifier, runner, model, and timeout policy. Failed
runner attempts may be preserved as diagnostics, but post-failure install/test steps
must not be interpreted as successful behavior evidence.

Verifier hardening note: a green `node --test` exit is insufficient by itself
because Node can exit successfully when no test files exist. The FSCRUD verifier
must require real test files and should score seed data from actual seed artifacts,
not only from keyword matches. The verifier is not yet claim-grade: before a
paired claim batch, add at least one adversarial token-stuffed fixture that must
fail, executable domain-rule checks, seed referential-integrity checks, and a
runtime-failure classification that excludes failed runner bundles from PL-vs-solo
comparison scores.

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
