<!-- cspell:ignore FSCRUD fscrud precheck -->

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

### `pl-local-crud-micro-contract`

The model runs
[flows/pl-fullstack-crud-micro-contract-v1.flow](../flows/pl-fullstack-crud-micro-contract-v1.flow).
This is the next diagnostic treatment after the scaffold-contract plateau. It keeps
the deterministic senior scaffold, but decomposes the hard domain layer into
customer, asset, work order create/read/detail, and work order edit/delete micro
contracts. Each micro contract has a narrow allowed file set and an executable probe
before the next slice starts.

### `pl-local-crud-micro-contract-v2`

The model runs
[flows/pl-fullstack-crud-micro-contract-v2.flow](../flows/pl-fullstack-crud-micro-contract-v2.flow).
This diagnostic follows R28. It keeps the deterministic scaffold and micro-contract
shape, but adds public domain API artifacts and checkpoint scripts inside the
workspace: `DOMAIN_API.md`, `contracts/domain-exports.json`, and
`scripts/check-domain-*.cjs`. A deterministic export-surface normalizer runs between
micro steps so missing exports become placeholder functions instead of ending the
run before behavior can be tested. The hidden FSCRUD verifier is not used in
model-facing repair loops; the experiment runner still executes it after the flow.

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

Observed R24 positive-export follow-up on `2026-05-04`: the native-Ollama run
`live-fscrud-r24-ollama-positive-export-contract-v1-20260504-0843` remained
diagnostic. The solo arm reached `61/100` and still failed browser UI, seed integrity,
and domain behavior. The scaffold arm again reached `80/100` with only
`domain_behavior_failed`. R24 did change the failure: the model no longer collapsed
to alternate `update*` exports, but it substituted `getCustomer`, `getAsset`, and
`getWorkOrder` for required `read*` and `detail*` exports. A repair turn also created
`src/domain.js` at the arm root because the compacted prompt carried only
`_review_critique`, while the repair instruction used unanchored `src/domain.js`.
Treat this as evidence for two next controls: exact export-surface checks must remain
generic, and every repair card must restate `workspace/fscrud-01` as the app root and
fail fast on run-root source leaks.

Post-R26 pre-live review on `2026-05-04`: before launching the next smoke, six
subagents reviewed the flow, verifier, runner, and evidence. The review found that
the scaffold placeholder contradicted the exact export-surface probe by exporting
`STATUS_VALUES` and `PRIORITY_VALUES` in addition to the canonical functions. It also
found that first-turn implementation cards still used runner-rooted `src/...` paths
while repair cards used explicit `workspace/fscrud-01/...` paths. The follow-up
control removes scaffold-only extra exports, anchors all initial cards to
`workspace/fscrud-01`, constrains final verifier repair to a named allowlist, and
adds a verifier-level `pathRootIsolation` hard failure for app files written at the
attempt root. The next run should be recorded as a current-commit R27 diagnostic, not
as completed R26 evidence.

Observed R27 current-contract diagnostic on `2026-05-04`: the native-Ollama run
`live-fscrud-r27-ollama-current-contract-v1-20260504-0932` used
`qwen3-opencode-big:30b` and the same paired arms as R24. The solo arm completed the
flow and again scored `61/100`, failing browser UI, seed integrity, and domain
behavior. The scaffold-contract arm failed at the first domain foundation review
after `2/2` repair rounds and scored `80/100` with only `domain_behavior_failed`.
The previous blockers stayed fixed: no scaffold export-surface precheck mismatch and
no run-root app-file leak. The new failure was a different local-model collapse: the
model replaced `src/domain.js` with `module.exports = { Customer, Asset }`, which is
invalid executable CommonJS because `Customer` and `Asset` are undefined and the
required CRUD functions are absent. Treat this as evidence that the local model is
still drifting to entity/schema-shaped output under broad domain cards.

Next micro-contract diagnostic: if R27 still fails at `domain_behavior_failed`, run a
new `pl-local-crud-micro-contract` arm before scaling to `k=3`. The falsifiable
hypothesis is that the same local model can preserve exact CommonJS exports and
complete the domain rules when the senior instruction is split into executable
micro contracts instead of two larger domain cards. A pass or a non-domain verifier
failure supports the micro-contract control theory. Repeated export drift or rule
failure after these probes is evidence that natural-language PL decomposition alone
is still insufficient for this local model on FSCRUD.

Observed R28 micro-contract diagnostic on `2026-05-04`: the native-Ollama run
`live-fscrud-r28-ollama-micro-contract-v1-20260504-1015` remained diagnostic. Solo
completed and again scored `61/100`, failing browser UI, UI surface, seed integrity,
and domain behavior. The micro-contract arm scored `80/100` with scaffold artifacts,
UI surface, seed integrity, and path-root isolation intact, but the runner failed
before completion. The first customer micro-contract failed after `2/2` strict
review rounds with `module_exports_surface_mismatch`; final `src/domain.js` had only
six empty customer exports and was missing `deleteCustomer` plus all asset and work
order exports. This supports the idea that PL structure improves artifact coverage
over solo, but falsifies the v1 micro-contract sub-hypothesis that natural-language
micro cards alone preserve the canonical CommonJS export surface.

Observed R29 micro-v2 diagnostic on `2026-05-04`: solo scored `61/100` and ended
`verifier_failed`. The micro-v2 arm scored `80/100` but ended `flow_failed` at the
first customer review after `3/3` rounds. The public API artifacts, checkpoint
scripts, and deterministic export normalization stabilized the export surface, but
customer behavior/domain implementation still failed. The hidden verifier hard
failure remained `domain_behavior_failed`.

R29 supports the export-control sub-hypothesis but not the full local-only delivery
hypothesis. The next experiment should route domain implementation to a stronger
external model or use a deterministic domain kernel while measuring local model
performance on server/UI/docs.

## R30 Domain-Control Experiment

R30 is predeclared in
[r30-domain-control-experiment.md](r30-domain-control-experiment.md). It is not a
new broad PL-vs-solo claim batch. It is a narrow control for the R29 question:
did the run fail because static artifact/export control was still insufficient, or
because the remaining blocker was executable domain behavior?

R30 arms:

- `r30-solo-local`:
  [flows/solo-local-crud-r30-domain-control.flow](../flows/solo-local-crud-r30-domain-control.flow).
- `r29-static-export-control`:
  [flows/pl-fullstack-crud-micro-contract-v2.flow](../flows/pl-fullstack-crud-micro-contract-v2.flow).
- `r30-pl-domain-control`:
  [flows/pl-fullstack-crud-domain-control-r30.flow](../flows/pl-fullstack-crud-domain-control-r30.flow).
- `r30-pl-senior-domain`:
  [flows/pl-fullstack-crud-senior-domain-r30.flow](../flows/pl-fullstack-crud-senior-domain-r30.flow).
- `r30-hybrid-frontier-domain`:
  [flows/hybrid-frontier-domain-r30.flow](../flows/hybrid-frontier-domain-r30.flow).

Run the local-only arms first. Add the senior-pairing and hybrid/frontier-domain
lanes only if the baseline and R29 replay are clean enough to compare. If the
harness cannot route only `src/domain.js` to a frontier runner, mark the hybrid
arm as `hybrid-routing-infeasible` rather than silently treating it as local-only
or frontier-only evidence.

Runner support is intentionally narrower than the full design matrix. Use
`--arms r30-domain-control` for the three-arm local bottleneck test and
`--arms r30-local` when adding the senior-pairing local lane. The hybrid flow is
predeclared for review but should not be run as a normal FSCRUD arm until the
harness supports per-step provider routing.

The expected R30 decision pivot is the first lane that reaches a green public
domain gate. If a domain-green lane still fails on UI/server/static artifacts, R29
was not isolated to domain behavior. If a domain-green lane reaches verifier pass
or moves hard failures away from `domain_behavior_failed`, R29 was primarily a
domain behavior bottleneck.

Observed R30 local-only diagnostic on `2026-05-04`: the run
`live-fscrud-r30-domain-control-20260504-1208` used native Ollama with
`qwen3-opencode-big:30b`. `r30-solo-local` failed early at `8/100` after creating
only `TASK.md`. The R29 replay scored `80/100` and failed
`domain_behavior_failed`. The stronger `r30-pl-domain-control` lane also scored
`80/100` and failed `domain_behavior_failed`; the final domain module preserved the
canonical CommonJS exports but every function still threw `not implemented`, with
the verifier failing at `reset not implemented`.

R30 therefore falsifies the next natural-language-only domain-control hypothesis for
this local model. It supports the narrower diagnosis that the remaining blocker is
executable domain behavior, not static artifact coverage or export surface. Do not
run another wording-only domain prompt as the next evidence step.

## R31 Deterministic Domain-Kernel Control

R31 tests the next bottleneck question: if executable domain behavior is supplied by
a deterministic kernel and protected from local edits, can local PL complete the
remaining server, UI, docs, manifest, and verification-report surface?

R31 arms:

- `r30-solo-local`: same direct local baseline flow as R30.
- `r31-static-domain-kernel-control`:
  [flows/static-domain-kernel-r31.flow](../flows/static-domain-kernel-r31.flow).
- `r31-pl-domain-kernel-bulk`:
  [flows/pl-fullstack-crud-domain-kernel-r31.flow](../flows/pl-fullstack-crud-domain-kernel-r31.flow).

Use `--arms r31-domain-kernel` for the first diagnostic. The static arm is not a
model-capability claim; it proves the deterministic kernel plus scaffold can satisfy
the public and hidden verifier. The PL bulk arm is the meaningful local-model
measurement: it removes domain reasoning from scope and tests whether the local
model can produce the surrounding product surface without corrupting protected
domain files.

R31 decision rules:

- If the static kernel control fails, fix the kernel or verifier before running
  local model arms.
- If the static kernel passes and the PL bulk arm fails non-domain hard failures,
  the next PL work should target server/UI/docs control.
- If the static kernel passes and the PL bulk arm passes, R29/R30 were domain-layer
  failures and hybrid/frontier routing should be tested only for `src/domain.js`.
- If the PL bulk arm edits protected domain, test, seed, contract, or package files,
  classify the run as policy failure rather than product failure.

Observed R31 diagnostic on `2026-05-04`: the run
`live-fscrud-r31-domain-kernel-20260504-1247` used native Ollama with
`qwen3-opencode-big:30b`.

- `r30-solo-local` scored `35/100` and failed
  `ui_surface_incomplete`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control` scored `100/100` and reached
  `verified_pass`.
- `r31-pl-domain-kernel-bulk` scored `93/100`, passed domain behavior, and failed
  only `ui_surface_incomplete`.

R31 validates the deterministic domain kernel control and partially validates the
local PL bulk hypothesis: once executable domain behavior is supplied and protected,
the local model can complete most surrounding artifacts without falling back into
the R30 domain-stub failure. The run still is not a full local FSCRUD success,
because the UI/product surface remained incomplete under the hidden verifier.

Next local-only diagnostic: R32 `--arms r32-ui-surface`. It keeps the protected
domain kernel and tightens server/UI surface gates around nearby list, create, edit,
detail, delete terms for each entity plus relationship fields and visible
work-order status/priority/completion terms. Do not spend another run on domain
wording until the surface-control lane has been tested.

R32 planned arm:

- `r32-pl-ui-surface-control`:
  [flows/pl-fullstack-crud-ui-surface-r32.flow](../flows/pl-fullstack-crud-ui-surface-r32.flow).

Observed R32 diagnostic on `2026-05-04`: the run
`live-fscrud-r32-ui-surface-20260504-1448` used native Ollama with
`qwen3-opencode-big:30b`.

- `r30-solo-local` scored `40/100` and failed
  `ui_surface_incomplete`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control` scored `100/100` and reached
  `verified_pass`.
- `r32-pl-ui-surface-control` scored `80/100`, passed domain behavior, and failed
  `ui_surface_incomplete`.

R32 refutes the narrower assumption that one stronger nearby-coverage UI prompt is
enough. The local model produced partial customer/asset UI, omitted work_orders and
status/priority/completedAt UI concepts, and exhausted the strict review before
creating README, run manifest, or verification report. The next control should be
structural rather than lexical: deterministic UI skeleton, per-entity UI cards, or
separate post-UI artifact cards.

### R33 Deterministic UI Skeleton Control

Next local-only diagnostic: R33 `--arms r33-ui-skeleton`. It keeps the protected
R31 domain kernel and adds a protected deterministic `public/index.html` skeleton
that satisfies the static UI-surface categories: customers, assets, work_orders,
list/create/edit/detail/delete, relationship fields, status values, priority values,
and completedAt.

R33 planned arm:

- `r33-pl-ui-skeleton-integration`:
  [flows/pl-fullstack-crud-ui-skeleton-r33.flow](../flows/pl-fullstack-crud-ui-skeleton-r33.flow).

Hypothesis: with domain behavior and UI surface coverage supplied deterministically
and protected, local PL can complete only the remaining integration work:
`src/server.js`, README, run manifest, verification report, and final wiring.

Claim boundary: a pass would not prove the local model can generate the UI surface.
It would support only the narrower claim that local inference can perform bounded
connective assembly around deterministic behavioral and presentation contracts. A
failure would shift attention away from domain/UI coverage and toward server route
discipline, documentation completion, or local-runner reliability.

Observed R33 diagnostic on `2026-05-04`: the fixed review-gate run
`live-fscrud-r33-ui-skeleton-reviewgate-20260504-1624` used native Ollama with
`qwen3-opencode-big:30b`.

- `r30-solo-local` scored `8/100` and failed package, browser UI, UI surface,
  test-script, tests-present, seed, and domain behavior gates.
- `r31-static-domain-kernel-control` scored `100/100` and reached
  `verified_pass`.
- `r33-pl-ui-skeleton-integration` scored `87/100`; the verifier passed with no
  hard failures, `hiddenOraclePassed=true`, `domainBehaviorPassed=true`, and
  `uiSurface=true`, but the PL runner returned `flow_failed`.

Interpretation: R33 confirms the deterministic UI skeleton removes the R31/R32 UI
surface blocker and that local inference can assemble the remaining product
artifacts around deterministic domain/UI contracts. After fixing invalid review
syntax, the failed flow outcome is no longer a runner-observability issue. It is a
substantive strict-review failure: across four repair rounds the local model
created `src/server.js` and `README.md` but did not create `run-manifest.json` or
`verification-report.md`, even though the grounded critique named the missing
manifest path.

R34 diagnostic result: `live-fscrud-r34-server-only-rerun-20260504-1710` ran on
`2026-05-04` with native Ollama and `qwen3-opencode-big:30b` after adding an
R34-specific public review gate. Solo scored `40/100` with UI, seed, and domain
hard failures. The static deterministic control scored `100/100`. The
`r34-pl-server-only-integration` treatment scored `100/100`, completed the PL
flow, passed public review, passed the hidden verifier, and passed executable
domain behavior.

Interpretation: R34 supports the narrow server-only hypothesis. The R33 failure
was caused by mixed server-plus-handoff artifact responsibility, not an inability
to integrate a server around protected deterministic contracts. The pass does
not prove local generation of UI, docs, manifest, or verification-report
artifacts because those were supplied deterministically. Residual caveat: the
model also created an extra nested `fscrud-01/src/server.js`. A nested app-root
duplication guard was added after this run, so the next evidence step is a strict
R34 rerun under the stronger verifier before claim-grade batching.

Strict-root R34 result:
`live-fscrud-r34-server-only-strict-root-20260504-1727` ran on `2026-05-04` with
the nested app-root duplication guard active. Solo scored `18/100` with package,
UI, test-script, seed, and domain hard failures. The static deterministic control
again scored `100/100` and verified. The `r34-pl-server-only-integration`
treatment scored `100/100` on content, passed public review, and passed executable
domain behavior, but the hidden verifier failed with `path_root_isolation_failed`
because the local model created a nested `fscrud-01/src/server.js`.

Updated interpretation: the constrained server-only hypothesis holds only before
strict path isolation. The remaining blocker is path discipline in local model file
actions. The next useful R34-family change should constrain or repair nested-root
writes before final verification; a claim-grade batch before that would overstate
the evidence.

Path-guard R34 result:
`live-fscrud-r34-server-only-path-guard-20260504-1801` ran on `2026-05-04` after
the Ollama action runner began rejecting duplicated app-root paths and the R34 public
gate began failing nested roots. Solo scored `8/100` with broad product failure. The
static deterministic control scored `100/100`. The `r34-pl-server-only-integration`
treatment scored `100/100`, completed the PL flow, passed public review, passed the
hidden verifier, passed executable domain behavior, and passed `pathRootIsolation`
with no leaks and no nested roots.

Updated interpretation after path guarding: R34 now supports the narrow server-only
local integration hypothesis under strict path isolation. It remains a diagnostic
control, not a full local-generation claim, because domain, UI, README, manifest,
and verification-report artifacts are deterministic protected inputs. The next
claim-grade step is a repeated R34 path-guard batch at the same commit, runner,
model, verifier, and timeout policy.

Repeated path-guard R34 result:
`live-fscrud-r34-server-only-path-guard-k3-20260504-1820` ran three repeats on
`2026-05-04` with native Ollama, `qwen3-opencode-big:30b`, and the same timeout and
retry policy. Solo failed every repeat at `48/100`, `33/100`, and `48/100`. The
static deterministic control passed every repeat at `100/100`. The
`r34-pl-server-only-integration` treatment passed every repeat at `100/100`; each
R34 verifier showed executable domain behavior passing, npm tests exiting `0`,
`pathRootIsolation=true`, no leaks, and no nested roots.

Updated interpretation after the repeated batch: R34 is now stable evidence for the
narrow server-only integration claim under local Ollama and strict path isolation.
It is not evidence that the local model can generate the protected domain, UI,
README, manifest, or verification-report artifacts. The next experiment should
broaden responsibility deliberately, one artifact class at a time, rather than
rerunning the same server-only control.

### R35 Handoff-Artifacts Control

Next local-only diagnostic: R35 `--arms r35-handoff-artifacts`. It keeps the
protected deterministic domain kernel, protected deterministic UI skeleton, and a
protected deterministic `src/server.js`. The local model owns only README, run
manifest, and verification report.

R35 planned arm:

- `r35-pl-handoff-artifacts`:
  [flows/pl-fullstack-crud-handoff-artifacts-r35.flow](../flows/pl-fullstack-crud-handoff-artifacts-r35.flow).

Hypothesis: with product behavior supplied deterministically and path-guarded, local
PL can make the same local model create compliant handoff artifacts that satisfy
strict public review and hidden verification.

Claim boundary: a pass would not prove the local model can generate domain, UI, or
server code. It would only support the narrower claim that local inference can
generate traceable handoff artifacts around deterministic product behavior. A failure
would explain the R33 mixed-responsibility failure as artifact-following debt rather
than server integration or hidden verifier behavior.

Observed first R35 smoke on `2026-05-04`:
`live-fscrud-r35-handoff-artifacts-20260504-1925` used native Ollama with
`qwen3-opencode-big:30b`.

- `r30-solo-local` scored `35/100` and failed UI, seed, and domain behavior gates.
- `r31-static-domain-kernel-control` scored `100/100` and verified.
- `r35-pl-handoff-artifacts` scored `91/100`; hidden verifier passed, domain behavior
  passed, and path isolation passed, but the public PL flow failed because
  `verification-report.md` was missing and the repair turn made no observable
  workspace progress.

Updated R35 interpretation: deterministic product behavior is not the blocker. The
first R35 flow was still too broad for local handoff artifact following. The
follow-up R35 flow splits README, manifest, and verification report into separate
file-specific cards before the final public gate.

Observed R35 follow-ups on `2026-05-04`:

- `live-fscrud-r35-handoff-artifacts-split-20260504-1945`: `r35-pl-handoff-artifacts`
  scored `87/100`; hidden oracle, executable domain behavior, UI surface, and path
  isolation all passed, but the PL flow failed after the model created only
  `README.md`.
- `live-fscrud-r35-handoff-artifacts-template-20260504-1955`: `r35-pl-handoff-artifacts`
  again scored `87/100`; protected product checks stayed green, but the model wrote
  a generic README and ignored the grounded `readme_missing:npm test` repair
  critique before reaching manifest or report generation.

Updated R35 interpretation after split-card and exact-template runs: the narrow
handoff-artifact hypothesis is not supported for this local model. Prompt-language
gates correctly expose the failure and preserve deterministic product behavior, but
more explicit natural-language artifact cards did not produce compliant README,
manifest, and verification-report files. The next diagnostic should test structured
artifact emission or a separately labeled hybrid reviewer/advisor path rather than
another wording-only handoff prompt.

### R36 Structured Handoff-Source Control

R36 tests whether the local model can comply with one structured source artifact
when deterministic tooling owns the final README, manifest, and verification report
projection.

R36 planned arm:

- `r36-pl-structured-handoff-source`:
  [flows/pl-fullstack-crud-structured-handoff-r36.flow](../flows/pl-fullstack-crud-structured-handoff-r36.flow).

Hypothesis: if freeform handoff-file generation is the R35 bottleneck, a single
model-owned `handoff-source.json` plus deterministic rendering should pass public
and hidden verification while preserving the local-only claim boundary.

Observed R36 results on `2026-05-04`:

- `live-fscrud-r36-structured-handoff-20260504-2008`: treatment scored `82/100`;
  hidden oracle, domain behavior, UI surface, seed integrity, and path isolation
  passed, but the model wrote `{}` to `handoff-source.json` and failed the
  structured-source public review before rendering.
- `live-fscrud-r36-structured-handoff-template-20260504-2025`: treatment again
  scored `82/100` with protected product checks green, but the model wrote an
  invented short object rather than the supplied exact JSON source template.

Updated R36 interpretation: the structured-source hypothesis is not supported under
the current local natural-language runner. The model is failing the source contract
itself, not only the downstream rendered handoff files. The next local-only
experiment should require runtime-level schema/constrained output support, or the
claim must be weakened to deterministic artifact rendering from non-model inputs.

### R37 Schema-Repaired Handoff-Source Diagnostic

R37 tests whether the R36 failure is strict JSON/schema fidelity rather than handoff
intent. The local model owns only `handoff-source.raw.json`. Deterministic tooling
then checks that the raw file contains the minimum local-only handoff intent terms
and normalizes canonical `handoff-source.json` before rendering README, manifest,
and verification-report artifacts.

R37 planned arm:

- `r37-pl-schema-repaired-handoff-source`:
  [flows/pl-fullstack-crud-schema-repaired-handoff-r37.flow](../flows/pl-fullstack-crud-schema-repaired-handoff-r37.flow).

Hypothesis: if R36 failed because exact JSON syntax was too brittle, the local model
can still emit enough raw handoff intent for deterministic schema repair while the
product path remains protected and verifier-green.

Claim boundary: a pass would support only schema-repairable handoff intent, not
strict model-authored schema compliance and not model-authored final README,
manifest, or verification-report artifacts.

Observed R37 results on `2026-05-04`:

- `live-fscrud-r37-schema-repaired-handoff-20260504-2055`: treatment scored
  `82/100`; hidden oracle, domain behavior, UI surface, seed integrity, and path
  isolation passed. The model wrote a repairable raw handoff intent object, and
  deterministic normalization produced canonical `handoff-source.json`, but an
  unnecessary post-normalization model review stopped progress before deterministic
  rendering.
- `live-fscrud-r37-schema-repaired-handoff-fixed-20260504-2110`: after removing that
  post-normalization model step, treatment scored `100/100` and completed as
  `verified_pass` with public gate, hidden oracle, executable domain behavior, and
  path isolation all green.

Updated R37 interpretation: the R36 failure was partly strict schema fidelity. The
local model can emit enough raw handoff intent for deterministic schema repair, but
it still should not be credited with strict JSON-schema compliance or with generating
the final handoff artifacts.

Current operating interpretation:

- R28/R29 support a narrow process claim only: prompt-language scaffolding and
  export controls improved artifact/export coverage over solo on the same local
  Ollama setup.
- R28 falsifies the v1 micro-contract assumption that natural-language decomposition
  alone is enough to preserve the canonical CommonJS export surface.
- R29 shows export-surface control can stabilize the visible CommonJS contract, but
  behavior implementation still failed before the hidden verifier hard-failed
  `domain_behavior_failed`.
- R31 shows deterministic domain implementation removes that blocker and shifts the
  remaining local-only failure to UI/product surface completeness.
- R32 shows stronger UI wording and nearby public gates still do not make the local
  model reliably fill the full surface in one bulk turn.
- R33 shows deterministic UI/domain artifacts are enough for hidden verifier
  product success, but local repair still missed non-code handoff artifacts under
  strict review.
- R34 shows deterministic UI/domain/handoff artifacts are enough for the same
  local model to complete server-only behavior under strict PL review when path
  isolation is enforced by the runner and public gate.
- The repeated path-guard R34 batch removes the nested app-root blocker across three
  same-commit repeats; the next local-only evidence step is broader artifact
  responsibility, not another R34 repetition.
- R35 is the next controlled broadening step: handoff artifacts return to local-model
  responsibility while domain, UI, and server behavior stay deterministic.
- The R35 follow-ups show that handoff artifact-following remains brittle even after
  each artifact is split into its own checked card and the README prompt is made
  exact-template style.
- R36 shows that the same brittleness remains when the handoff task is reduced to
  one structured source file, including an exact JSON template.
- R37 separates schema syntax fidelity from raw handoff intent emission and supports
  the narrow schema-repair path: local emits minimal intent; deterministic tooling
  owns schema normalization and rendered handoff artifacts.
- A local-only claim batch must not include frontier advice, frontier-authored
  patches, or per-run changes to model, runner, task, verifier, timeout, or commit.
- A frontier model is justified only for a separately labeled hybrid arm, read-only
  review, high-ambiguity diagnosis, security/data-loss review, or repeated local
  failure after classification.

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
