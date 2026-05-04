<!-- cspell:ignore FSCRUD fscrud metacognition metacognitive precheck -->

# Full-Stack CRUD Comparison

Status: R37 schema-repaired handoff-source diagnostic passed with a narrow claim boundary

This experiment is the next best test of the local-model prompt-language thesis.
It asks a direct question:

Can the same local model build a more complete full-stack CRUD app when controlled by
a prompt-language factory flow than when given a direct solo prompt?

## Why This Exists

Existing evidence is useful but incomplete:

- E4 shows direct Codex is faster for a bounded CRM slice, while prompt-language is
  better for governed factory quality and auditability.
- E7-MK shows retry-with-validation removes low-salience requirement misses.
- Aider Phase 1 suggests prompt-language helps local models on gate-heavy tasks, but
  the older H1-H10 evidence is not claim-eligible.
- Senior Pairing Protocol tests metacognitive supervision on a small bug task, not a
  full-stack app.

This experiment closes that gap by testing the user's concrete hypothesis:
"build a full-stack CRUD app for a domain" with and without prompt-language control.

## Primary Hypothesis

Prompt-language will improve local-model full-stack CRUD delivery when the target has
multiple entities, deterministic gates, and explicit cross-layer contracts.

Expected advantage:

- more complete CRUD coverage
- fewer missing low-salience requirements
- better traceability from requirement to route, UI, test, and verification artifact
- stronger recovery from failing gates

Not expected:

- lower wall-clock time
- lower local GPU time
- better first-pass output on trivial slices

Runtime is telemetry only. Local inference is allowed to be slow.

## Arms

| Arm                                          | Runner                                                  | Model                                  | Purpose                                                                      |
| -------------------------------------------- | ------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `solo-local-crud`                            | aider or prompt-language `--runner aider` direct prompt | local Ollama model                     | Baseline: direct "build the app" prompt                                      |
| `pl-local-crud-factory`                      | prompt-language flow                                    | same local Ollama model                | Treatment: phase, gate, retry, review, and verification control              |
| `pl-local-crud-scaffold-contract`            | prompt-language flow                                    | same local Ollama model                | Treatment: deterministic senior scaffold plus executable contract feedback   |
| `pl-local-crud-micro-contract`               | prompt-language flow                                    | same local Ollama model                | Diagnostic: scaffold plus executable domain micro contracts                  |
| `pl-local-crud-micro-contract-v2`            | prompt-language flow                                    | same local Ollama model                | Diagnostic: public domain API contract, export normalizer, checkpoint tests  |
| `r31-static-domain-kernel-control`           | prompt-language flow                                    | deterministic only                     | Control: scaffold plus known-good domain kernel, no model-authored code      |
| `r31-pl-domain-kernel-bulk`                  | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected domain kernel, local model owns server/UI/docs         |
| `r32-pl-ui-surface-control`                  | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected domain kernel plus nearby server/UI surface gates      |
| `r33-pl-ui-skeleton-integration`             | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected domain kernel plus protected deterministic UI skeleton |
| `r34-pl-server-only-integration`             | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected domain/UI/docs/manifest/report; model owns server only |
| `r35-pl-handoff-artifacts`                   | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected domain/UI/server; model owns handoff artifacts only    |
| `r36-pl-structured-handoff-source`           | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected product; model owns structured handoff source only     |
| `r37-pl-schema-repaired-handoff-source`      | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected product; model owns raw handoff intent only            |
| `r38-pl-senior-plan-repaired-handoff-source` | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected product; model owns raw senior plan intent only        |
| `r39-pl-quality-scored-senior-plan-source`   | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected product; model owns quality-scored senior plan source  |
| `r40-pl-section-selected-senior-plan-source` | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected product; model owns bounded senior-plan section choice |
| `r41-pl-decision-matrix-senior-plan-source`  | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected product; model owns bounded senior-plan option choices |
| `pl-local-senior-crud`                       | prompt-language flow                                    | same local Ollama model                | Optional later arm: senior pairing metacognition plus factory gates          |
| `hybrid-router-crud`                         | prompt-language flow                                    | local default plus frontier escalation | Later arm: local bulk work, external model only for policy-triggered review  |

Run the first claim attempt with only `solo-local-crud` and
`pl-local-crud-factory`. Add the senior and hybrid arms only after the baseline
comparison is clean.

## Task

The seed task is `FSCRUD-01`: a field-service work order tracker.

It is intentionally not CRM, because CRM has already appeared in several factory
experiments. The app still requires the same engineering muscles: domain modeling,
CRUD, ownership, validation, UI flows, tests, and verification.

See [tasks/fscrud-01-field-service-work-orders.md](tasks/fscrud-01-field-service-work-orders.md).

## Current Decision

April 30 local probes found useful harness evidence, but not a defensible
PL-vs-solo claim yet:

- native Ollama can execute real workspace actions, unlike the current local
  `opencode` path;
- the tight v3 PL arm exposed a capture-isolation bug where the model wrote future
  implementation files while the flow was still waiting on `senior_frame`;
- the verifier has been hardened with real test-file checks, seed integrity checks,
  and executable domain behavior probes so token-stuffed placeholder workspaces fail.
- later R15-R19 tight-v3 runs remain harness/runtime diagnostics: capture isolation
  and workspace rooting improved, but all runs failed before producing a complete
  app. The best score was R17 at `38/100`; R15, R16, R18, and R19 stayed at
  `23/100`.
- dense senior prompts made the local model stall, while shorter imperative repair
  prompts produced tiny overwrites instead of adding missing behavior.

The current work item is making `pl-local-crud-scaffold-contract` complete one clean
local Ollama smoke pair. R20 proved the deterministic scaffold improves artifact
coverage, but exposed a flow-control bug. R21 proved the scaffold precheck now passes
and the old validation-prompt blocker is gone, but the first broad domain
implementation prompt exhausted the 8 action-round limit before editing
`src/domain.js`.

R22 narrowed that domain step into two Senior Cards: customers/assets foundation
first, then work_order rules. It moved past the exact R21 blocker by editing
`src/domain.js`, but the edit used the wrong export shape and still failed the first
strict foundation review; the scaffold arm stayed at `80/100` with
`domain_behavior_failed`.

R23 tightened the scaffold flow around exact CommonJS export names, explicit
`write_file` repair actions, export-shape guards, work_order create/edit rules, safe
delete semantics, and concrete server/UI behavior. The guard caught the failure at
the first domain review, but the model still wrote only alternate update-style exports
inside `module.exports`; the scaffold arm stayed at `80/100` with
`domain_behavior_failed`.

R24 removes those wrong names from model-facing prompts and emphasizes the positive
canonical `module.exports` contract with runtime export probing. The follow-up R25
hardening removes the remaining wrong-name exposure from deterministic probe text too:
the flow now compares the exact runtime `Object.keys(module.exports)` surface and
emits generic export-surface diagnostics. Only after a current-commit smoke pair
completes with a frozen task, verifier, runner, model, and commit should this scale
to `k=3` paired runs.

The R24 live smoke stayed diagnostic: solo reached `61/100`, while scaffold-contract
again reached `80/100` with only `domain_behavior_failed`. The failure changed from
the R23 `update*` collapse to `get*` substitutions for required `read/detail` exports,
plus one repair turn wrote `src/domain.js` at the run root after compaction dropped the
workspace variable. The next hardening anchors all repair prompts to
`workspace/fscrud-01` and adds a deterministic run-root leak guard.

A post-R26 multi-agent review found one pre-live blocker: the exact export-surface
probe conflicted with the scaffold placeholder because the placeholder also exported
`STATUS_VALUES` and `PRIORITY_VALUES`. The current follow-up removes those extra
placeholder exports, anchors initial implementation cards to `workspace/fscrud-01`
the same way repair cards are anchored, narrows the final repair allowlist, and adds a
verifier-level `pathRootIsolation` hard gate for run-root app-file leaks. The next
live Ollama run should test this current commit before any claim-grade `k=3` batch.

R27 tested that current-contract scaffold and stayed diagnostic. Solo completed but
still failed verifier at `61/100`. Scaffold-contract kept the R26 fixes intact but
failed the first domain foundation review after the model produced an invalid
entity/schema-shaped `module.exports = { Customer, Asset }` instead of executable
CRUD functions.

R28 tested
[flows/pl-fullstack-crud-micro-contract-v1.flow](flows/pl-fullstack-crud-micro-contract-v1.flow).
It did not break the `80/100` scaffold plateau. Solo again scored `61/100` with
browser UI, seed integrity, and domain behavior failures. The micro-contract arm
kept scaffold artifacts, UI surface, seed integrity, and path-root isolation intact,
but failed the first customer micro-contract after the model reduced `src/domain.js`
to six empty customer exports and dropped `deleteCustomer`, all asset exports, and
all work order exports. Treat R28 as evidence that micro-contract decomposition
improves artifact coverage over solo but still needs stronger export-surface control.

R29 tested
[flows/pl-fullstack-crud-micro-contract-v2.flow](flows/pl-fullstack-crud-micro-contract-v2.flow).
Solo again scored `61/100` and ended `verifier_failed`. The micro-v2 arm scored
`80/100` but ended `flow_failed` at the first customer review after `3/3` rounds.
The public API artifacts and export normalizer stabilized the export surface, but
customer behavior/domain implementation still failed; the hidden verifier hard
failure remained `domain_behavior_failed`.

## Current System Interpretation

R28/R29 are useful diagnostic evidence, not product-quality wins and not a
claim-grade PL-vs-solo batch. They show that the local Ollama lane can execute real
workspace actions and that prompt-language scaffolding can preserve broad artifact
coverage where solo repeatedly fails product gates.

R29 narrowed the bottleneck. Public, model-visible domain API artifacts plus
deterministic export normalization stabilized the CommonJS export surface long
enough for behavior checks to matter. The run still failed customer behavior/domain
implementation, so the next control should be a stronger domain implementation lane
or a deterministic domain kernel, not more export-surface prompting.

R30 was predeclared in
[docs/r30-domain-control-experiment.md](docs/r30-domain-control-experiment.md). It
compares the local-only baseline, the R29 static/export-control replay, a stronger
local PL domain-control lane, a local senior-pairing PL lane, and an explicitly
labeled hybrid/frontier-domain lane. Treat R30 as a bottleneck-isolation experiment,
not a broad product claim, until it produces a clean repeated batch.

The first local-only R30 run
`live-fscrud-r30-domain-control-20260504-1208` used
`qwen3-opencode-big:30b` through native Ollama. The direct baseline failed early at
`8/100`. The R29 replay and stronger R30 domain-control lane both scored `80/100`
and failed only `domain_behavior_failed`. The R30 domain-control lane preserved the
exact export surface but left `src/domain.js` as `not implemented` stubs, with the
hidden verifier failing at `reset not implemented`.

Current R30 interpretation: stronger local natural-language domain control did not
move the 30B local model past executable domain behavior. The next useful control is
R31, not another wording-only domain prompt. R31 removes the domain blocker with a
deterministic kernel, then measures whether local PL can complete server, UI, docs,
and manifest work around protected domain code.

R31 ran as `live-fscrud-r31-domain-kernel-20260504-1247` with
`qwen3-opencode-big:30b` through native Ollama. Results:

- `r30-solo-local`: `35/100`, `flow_failed`, hard failures
  `ui_surface_incomplete`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r31-pl-domain-kernel-bulk`: `93/100`, `flow_failed`, hard failure
  `ui_surface_incomplete`; domain behavior passed.

R31 confirms the deterministic domain kernel is valid and that the local PL lane can
complete executable domain behavior when the domain layer is supplied and protected.
It does not yet prove full local FSCRUD completion: the remaining blocker moved to
the browser/server product surface, especially complete visible UI coverage.

R32 ran as `live-fscrud-r32-ui-surface-20260504-1448` with the same model and
runner. Results:

- `r30-solo-local`: `40/100`, `flow_failed`, hard failures
  `ui_surface_incomplete`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r32-pl-ui-surface-control`: `80/100`, `flow_failed`, hard failure
  `ui_surface_incomplete`; domain behavior passed.

R32 did not improve on R31. The model wrote a small customer/asset UI, omitted
work_orders/status/priority/completedAt surface coverage, and exhausted the strict
review loop before creating README, run manifest, or verification report. The next
useful local-only diagnostic should use a deterministic UI skeleton or smaller
per-entity UI cards, not more wording in one bulk UI prompt. The hybrid
frontier-domain flow remains predeclared but not runner-enabled until per-step
provider routing exists.

### R33 Deterministic UI Skeleton Diagnostic

R33 is designed as `--arms r33-ui-skeleton`. It keeps the R31 deterministic domain
kernel, writes a deterministic `public/index.html` skeleton with all required
entity/action/status/priority/completion surface terms, protects both files, and
lets the local model own only `src/server.js`, `README.md`, `run-manifest.json`,
and `verification-report.md`.

This is intentionally narrower than R32. If R33 passes, it does not prove the local
model can generate the UI surface. It proves the local model can perform constrained
integration around deterministic behavior and deterministic UI-surface contracts. If
it fails, the remaining bottleneck is likely server/docs/report discipline, route
consistency, or local-runner reliability rather than domain or UI surface coverage.

Observed R33 on `2026-05-04` after the invalid review syntax was fixed:
`live-fscrud-r33-ui-skeleton-reviewgate-20260504-1624`.

- `r30-solo-local`: `8/100`, `flow_failed`, hard failures
  `package_json_missing_or_invalid`, `browser_ui_missing`,
  `ui_surface_incomplete`, `test_script_missing`, `tests_missing`,
  `seed_integrity_failed`, and `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r33-pl-ui-skeleton-integration`: `87/100`, `flow_failed`, no hard failures,
  `hiddenOraclePassed=true`, `domainBehaviorPassed=true`, and `uiSurface=true`.

R33 partially supports the structural hypothesis: deterministic UI skeleton plus
deterministic domain kernel removed the UI/domain blockers and produced verifier-
passing product artifacts. The fixed review-gate rerun also shows the remaining
blocker is not syntax or UI/domain capability: strict public review failed after
four repair rounds because the local model created `src/server.js` and `README.md`
but repeatedly did not create `run-manifest.json` or `verification-report.md`.

### R34 Server-Only Diagnostic

R34 is designed as `--arms r34-server-only`. It keeps the deterministic domain
kernel and deterministic UI skeleton from R33, adds deterministic README, run
manifest, and verification report artifacts, protects all of those files, and
lets the local model own only `src/server.js`.

This isolates the R33 failure. If R34 passes, the evidence supports "local model
can perform constrained server integration when handoff artifacts are supplied."
It would not prove the local model can generate UI, docs, or manifest artifacts.
If R34 fails, the remaining blocker is server integration or local repair-loop
reliability, not artifact-following overhead.

Observed R34 on `2026-05-04` after adding an R34-specific public review gate:
`live-fscrud-r34-server-only-rerun-20260504-1710`.

- `r30-solo-local`: `40/100`, `flow_failed`, hard failures
  `ui_surface_incomplete`, `seed_integrity_failed`, and `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r34-pl-server-only-integration`: `100/100`, `verified_pass`,
  `publicGatePassed=true`, `hiddenOraclePassed=true`, and
  `domainBehaviorPassed=true`.

R34 supports the narrow hypothesis: when domain behavior, UI surface, README,
manifest, and verification report are deterministic protected artifacts, the
local model can complete a constrained `src/server.js` integration task under PL
review gates. It does not prove local generation of UI/docs/manifest artifacts.

The strict-root rerun
`live-fscrud-r34-server-only-strict-root-20260504-1727` changed the classification:

- `r30-solo-local`: `18/100`, `flow_failed`, hard failures
  `package_json_missing_or_invalid`, `ui_surface_incomplete`,
  `test_script_missing`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r34-pl-server-only-integration`: `100/100` scored content, public gate passed,
  domain behavior passed, but hidden oracle failed with
  `path_root_isolation_failed`.

This means the local model can still satisfy the server-only behavioral task, but
R34 is not claim-grade under the hardened verifier because it creates a nested
`fscrud-01/src/server.js`. The next evidence step is not another product-surface
prompt. It is path-discipline hardening: make the R34 flow and local action policy
reject or repair nested app-root writes before any `k=3` batch.

The path-guard rerun
`live-fscrud-r34-server-only-path-guard-20260504-1801` tested that hardening on
the same local Ollama model:

- `r30-solo-local`: `8/100`, `flow_failed`, broad product failure.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r34-pl-server-only-integration`: `100/100`, `verified_pass`,
  `publicGatePassed=true`, `hiddenOraclePassed=true`,
  `domainBehaviorPassed=true`, and `pathRootIsolation=true`.

This restores the narrow R34 result under strict path isolation. The evidence still
does not prove local generation of domain, UI, README, manifest, or verification
report artifacts. It does support the narrower claim that, with those artifacts
supplied deterministically and path-guarded, the local model can complete server-only
integration under PL review gates. The next claim-grade step is a same-commit,
same-runner, same-model repeated R34 batch before moving to a broader R35/R36 arm
that gives the local model more artifact responsibility again.

The same-commit R34 path-guard batch
`live-fscrud-r34-server-only-path-guard-k3-20260504-1820` then ran three repeats on
`2026-05-04` with native Ollama and `qwen3-opencode-big:30b`. Across all three
repeats:

- `r30-solo-local`: failed every repeat with scores `48/100`, `33/100`, and
  `48/100`; failures stayed in UI, seed integrity, and domain behavior.
- `r31-static-domain-kernel-control`: passed every repeat at `100/100`.
- `r34-pl-server-only-integration`: passed every repeat at `100/100` with public
  review, hidden verification, executable domain behavior, npm tests, and
  `pathRootIsolation` all green.

That makes R34 stable for its narrow server-only claim boundary. It still does not
prove local generation of domain, UI, README, manifest, or verification-report
artifacts because those are deterministic protected inputs. The next useful
experiment is not more R34 repetition; it is a broader R35/R36 treatment that returns
one artifact class at a time to local-model responsibility while keeping the same
path guard and verifier discipline.

### R35 Handoff-Artifacts Diagnostic

R35 is designed as `--arms r35-handoff-artifacts`. It keeps the deterministic domain
kernel, deterministic UI skeleton, and deterministic server integration protected.
The local model owns only `README.md`, `run-manifest.json`, and
`verification-report.md`.

This directly retests the R33 failure mode without mixing in server generation. If
R35 passes, the evidence supports "local model can generate compliant handoff
artifacts when product behavior is deterministic and protected." It would not prove
server, UI, or domain generation. If R35 fails, the remaining local bottleneck is
artifact-following discipline under strict review, not product behavior.

Observed first R35 smoke on `2026-05-04`:
`live-fscrud-r35-handoff-artifacts-20260504-1925`.

- `r30-solo-local`: `35/100`, `flow_failed`, hard failures
  `ui_surface_incomplete`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r35-pl-handoff-artifacts`: `91/100`, hidden verifier passed, domain behavior
  passed, and path isolation passed, but the PL flow failed public review. The model
  created `README.md` and a generic `run-manifest.json`, missed
  `verification-report.md`, and then answered that no repair was needed.

Interpretation: the product behavior path is stable, but handoff artifact-following
still needs stronger PL structure. The follow-up R35 flow splits handoff generation
into file-specific README, manifest, and verification-report cards before the full
public gate.

Observed split-card and exact-template R35 follow-ups on `2026-05-04`:
`live-fscrud-r35-handoff-artifacts-split-20260504-1945` and
`live-fscrud-r35-handoff-artifacts-template-20260504-1955`.

- Both runs kept the deterministic product path stable: hidden verifier passed,
  executable domain behavior passed, UI surface passed, and path isolation passed.
- Both R35 treatments scored `87/100` and ended `flow_failed` before creating
  `run-manifest.json` or `verification-report.md`.
- The split-card run created only `README.md`; the exact-template follow-up still
  wrote a generic README and ignored a grounded `readme_missing:npm test` repair
  critique.

Updated interpretation: R35 now falsifies the narrow hypothesis that more explicit
handoff-card wording is enough for this local model. The remaining bottleneck is
local artifact-following and repair compliance for non-code handoff files, not
domain, UI, server, seed, or path-root behavior. The next useful experiment should
either test constrained/structured artifact emission for local models or move to a
separately labeled hybrid advisor/reviewer arm; do not count deterministic writes of
README/manifest/report as local-model handoff generation.

### R36 Structured Handoff-Source Diagnostic

R36 is designed as `--arms r36-structured-handoff`. It keeps the deterministic domain
kernel, UI skeleton, and server integration protected. The local model owns only
`handoff-source.json`; deterministic tooling renders `README.md`,
`run-manifest.json`, and `verification-report.md` from that source.

Observed R36 smoke and exact-template follow-up on `2026-05-04`:
`live-fscrud-r36-structured-handoff-20260504-2008` and
`live-fscrud-r36-structured-handoff-template-20260504-2025`.

- Both runs kept the deterministic product path stable: hidden verifier passed,
  executable domain behavior passed, UI surface passed, seed integrity passed, and
  path isolation passed.
- Both R36 treatments scored `82/100` and ended `flow_failed` at the structured
  source review before the deterministic renderer could create handoff artifacts.
- The first R36 run wrote `{}` to `handoff-source.json`; the exact-template follow-up
  wrote a short invented object instead of the supplied JSON template.

Updated interpretation: R36 falsifies the narrower hypothesis that a single
structured source file is enough for this local model. The next local-only path
should not be another natural-language artifact prompt. It should either add
runtime-level constrained decoding/schema enforcement or be explicitly classified as
a deterministic artifact renderer rather than model-generated handoff evidence.

### R37 Schema-Repaired Handoff-Source Diagnostic

R37 is designed as `--arms r37-schema-repaired-handoff`. It keeps the deterministic
domain kernel, UI skeleton, and server integration protected. The local model owns
only `handoff-source.raw.json`. A deterministic repair adapter validates that the raw
file contains the core handoff intent terms, then normalizes canonical
`handoff-source.json`; deterministic tooling renders `README.md`,
`run-manifest.json`, and `verification-report.md`.

This tests a narrower failure mode than R36. If R37 passes, the evidence would
support "the local model can express enough handoff intent for deterministic schema
repair" but not "the local model can generate strict JSON schema or final handoff
artifacts." If R37 fails, the local model is failing even minimal handoff intent
emission under the current natural-language runner, and the next local-only path
should require runtime-level constrained decoding or stop expanding this artifact
line.

Observed R37 on `2026-05-04`:
`live-fscrud-r37-schema-repaired-handoff-20260504-2055` and
`live-fscrud-r37-schema-repaired-handoff-fixed-20260504-2110`.

- The first run proved the raw handoff intent was repairable, but a post-
  normalization model review stopped progress before deterministic rendering. The
  treatment scored `82/100`; hidden verifier, domain behavior, UI surface, seed
  integrity, and path isolation passed.
- The fixed run removed that unnecessary post-normalization model step. R37 then
  scored `100/100`, completed the PL flow, and passed public gate, hidden verifier,
  executable domain behavior, and path isolation.
- The model-authored raw file was still minimal:
  `local`, `deterministic`, `domain`, `UI`, `server`, and `handoff` intent terms were
  present, but deterministic tooling supplied the canonical schema and final
  handoff artifacts.

Updated interpretation: R37 supports a narrow schema-repair claim, not strict
schema-following. The local model can emit enough handoff intent when the syntax
burden is reduced to a small raw source, but prompt-language/deterministic tooling
must own normalization and final artifact rendering for this task.

Repeated same-commit R37 batch:
`live-fscrud-r37-schema-repaired-handoff-k3-20260504-2130`.

- `r30-solo-local`: failed all three repeats with scores `35/100`, `26/100`, and
  `33/100`; hard failures remained broad product failures such as UI surface, seed
  integrity, package/test setup, and executable domain behavior.
- `r31-static-domain-kernel-control`: passed all three repeats at `100/100`.
- `r37-pl-schema-repaired-handoff-source`: passed all three repeats at `100/100`
  with public gate, hidden verifier, executable domain behavior, path isolation,
  README, run manifest, and verification report all green.
- The model-authored raw handoff source was identical across R37 repeats: a minimal
  JSON object carrying local/deterministic/domain/UI/server/handoff intent plus
  `handoff-source.raw.json` as the model-owned file.

Updated repeated-batch interpretation: R37 is stable for its narrow claim boundary.
It does not reopen the broader local-generation claim; it shows the practical system
pattern that works on this host is local intent emission plus deterministic schema
normalization and artifact rendering.

### R38 Senior-Plan Repaired Handoff Diagnostic

R38 is designed as `--arms r38-senior-plan-repaired-handoff`. It keeps the same
deterministic domain kernel, UI skeleton, and server integration as R37, but raises
the model-owned source from a keyword-level handoff payload to
`senior-plan.raw.json`. The raw source must include objective, constraints,
architecture, implementation, verification, risk, local, deterministic, domain, UI,
server, handoff, and `senior-plan.raw.json`. Deterministic tooling still normalizes
canonical `handoff-source.json` and renders final handoff artifacts.

Observed R38 on `2026-05-04`:
`live-fscrud-r38-senior-plan-repaired-handoff-20260504-2215` and
`live-fscrud-r38-senior-plan-repaired-handoff-fixed-20260504-2240`.

- The first R38 run showed the model could emit a richer senior-plan source, but
  the flow failed because a final post-render model review asked the model to wait
  after deterministic artifacts already existed. Hidden verifier, domain behavior,
  and path isolation passed; the treatment scored `95/100` but ended `flow_failed`.
- The fixed R38 run made final artifact verification deterministic and required the
  model-owned filename in the raw source. R38 then scored `100/100`, completed the
  PL flow, and passed public gate, hidden verifier, executable domain behavior, and
  path isolation.
- The model-authored source was still shallow, but it was plan-shaped rather than
  only keyword-shaped: it included objective, constraints, architecture,
  implementation, verification, risk, local/deterministic/product-boundary terms,
  handoff, deterministic rendered artifacts, and `senior-plan.raw.json`.
- In the same fixed run, `r30-solo-local` failed at `35/100` with UI surface, seed
  integrity, and domain behavior failures; `r31-static-domain-kernel-control` passed
  at `100/100`.

Updated R38 interpretation: the senior-engineer prompt-language hypothesis is
supported only at the constrained intent-source layer. Local inference can emit a
small senior-plan scaffold when deterministic gates define the required fields, but
the evidence still does not prove autonomous senior engineering or final artifact
generation. The useful pattern remains: local model supplies bounded intent or plan
signals; deterministic PL tooling performs schema repair, rendering, and verification.

### R39 Quality-Scored Senior-Plan Diagnostic

R39 is designed as `--arms r39-quality-scored-senior-plan`. It keeps the same
protected deterministic product setup as R38, but adds a deterministic quality score
over `senior-plan.raw.json`. The scorer requires at least `18/29` concrete terms
across objective, constraints, architecture, implementation, verification, and risk.
This directly tests whether the local model can move beyond shallow field presence.

Observed R39 on `2026-05-04`:
`live-fscrud-r39-quality-scored-senior-plan-20260504-2315`.

- `r39-pl-quality-scored-senior-plan-source`: failed the strict review after three
  repair rounds. The final raw source scored only `6/29`, so deterministic
  normalization and handoff rendering never ran.
- The hidden verifier still passed after the run because deterministic protected
  product files existed, but the public PL gate failed and the treatment score was
  `82/100` with `flow_failed`.
- The model-authored source remained shallow, for example "Domain-driven design",
  "FSCRUD-01 deterministic behavior", "Rubric terms validated", and a truncated
  `rubric_terms` value, rather than concrete ordered implementation, verification,
  and risk details.
- In the same run, `r30-solo-local` failed at `12/100`; `r31-static-domain-kernel-control`
  passed at `100/100`.

Updated R39 interpretation: the stronger senior-plan quality hypothesis is not
supported for this local model under the current natural-language runner. R38 proves
bounded field-shaped source emission; R39 shows that explicit rubric terms and
repair loops did not make the model produce meaningfully richer senior-engineering
content. The next useful direction is not more wording; it is either constrained
template filling with deterministic section scaffolds or a hybrid reviewer arm.

### R40 Section-Selected Senior-Plan Diagnostic

R40 is designed as `--arms r40-section-selected-senior-plan`. It keeps the same
protected deterministic product setup as R39, but changes the local-model role from
author to selector. The model owns only `senior-plan.selection.txt` and must select
the six section labels `objective constraints architecture implementation
verification risk`. Deterministic PL tooling then renders `senior-plan.raw.json`,
canonical `handoff-source.json`, and final handoff artifacts.

Observed R40 on `2026-05-04`:
`live-fscrud-r40-section-selected-senior-plan-20260505-0010`.

- `r40-pl-section-selected-senior-plan-source`: `100/100`, `verified_pass`, with
  public gate, hidden verifier, executable domain behavior, and path-root isolation
  passing.
- The model-authored source was exactly the bounded selector payload:
  `objective constraints architecture implementation verification risk`.
- In the same run, `r30-solo-local` failed at `43/100`; `r31-static-domain-kernel-control`
  passed at `100/100`.

Updated R40 interpretation: bounded section selection works where R39 free-form
quality authoring failed. The strongest supported local-model pattern is now:
local inference selects or classifies small symbolic options; deterministic
prompt-language tooling owns rich section prose, schema repair, rendering,
verification, and protected product behavior. This still does not prove autonomous
senior-engineering reasoning.

### R41 Decision-Matrix Senior-Plan Diagnostic

R41 is designed as `--arms r41-decision-matrix-senior-plan`. It keeps the R40
protected deterministic product setup, but asks the model to choose six
task-appropriate key/value options from a bounded decision matrix with decoys. The
model owns only `senior-plan.decisions.txt`; deterministic tooling validates all
six choices before rendering `senior-plan.raw.json`, canonical `handoff-source.json`,
and handoff artifacts.

Observed R41 on `2026-05-04`:
`live-fscrud-r41-decision-matrix-senior-plan-20260505-0025`.

- `r41-pl-decision-matrix-senior-plan-source`: `100/100`, `verified_pass`, with
  public gate, hidden verifier, executable domain behavior, and path-root isolation
  passing.
- The model-authored file selected the expected bounded options:
  `objective=field-service-work-orders`, `constraints=protected-local-only`,
  `architecture=domain-ui-server-seed`,
  `implementation=ordered-crud-relationships`,
  `verification=domain-checks-and-tests`, and
  `risk=path-seed-schema-handoff`.
- In the same run, `r30-solo-local` failed at `31/100`; `r31-static-domain-kernel-control`
  passed at `100/100`.

Updated R41 interpretation: local inference can do bounded option selection when
the option vocabulary is explicit and deterministic tooling owns validation and
rendering. This is stronger than R40's label-copy result but still not evidence
that the local model authors senior plans or implements product behavior.

Use local Ollama when the purpose is measuring the local-model thesis, performing
bulk artifact work with deterministic gates, or reproducing the R28/R29 diagnostic
path. Keep the same runner, model, commit, verifier, and timeout policy inside any
claim batch.

Use an external frontier model only when the question has changed to hybrid routing:
read-only final review, high-ambiguity root-cause analysis, security or data-loss
risk, or repeated local failure after the run has been classified. Do not mix
frontier edits into a local-only claim batch; record that as a separate hybrid arm.
