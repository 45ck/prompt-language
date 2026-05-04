<!-- cspell:ignore FSCRUD fscrud metacognition metacognitive precheck -->

# Full-Stack CRUD Comparison

Status: R30 local-only diagnostic complete; R31 domain-kernel control ready

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

| Arm                                | Runner                                                  | Model                                  | Purpose                                                                     |
| ---------------------------------- | ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `solo-local-crud`                  | aider or prompt-language `--runner aider` direct prompt | local Ollama model                     | Baseline: direct "build the app" prompt                                     |
| `pl-local-crud-factory`            | prompt-language flow                                    | same local Ollama model                | Treatment: phase, gate, retry, review, and verification control             |
| `pl-local-crud-scaffold-contract`  | prompt-language flow                                    | same local Ollama model                | Treatment: deterministic senior scaffold plus executable contract feedback  |
| `pl-local-crud-micro-contract`     | prompt-language flow                                    | same local Ollama model                | Diagnostic: scaffold plus executable domain micro contracts                 |
| `pl-local-crud-micro-contract-v2`  | prompt-language flow                                    | same local Ollama model                | Diagnostic: public domain API contract, export normalizer, checkpoint tests |
| `r31-static-domain-kernel-control` | prompt-language flow                                    | deterministic only                     | Control: scaffold plus known-good domain kernel, no model-authored code     |
| `r31-pl-domain-kernel-bulk`        | prompt-language flow                                    | same local Ollama model                | Diagnostic: protected domain kernel, local model owns server/UI/docs        |
| `pl-local-senior-crud`             | prompt-language flow                                    | same local Ollama model                | Optional later arm: senior pairing metacognition plus factory gates         |
| `hybrid-router-crud`               | prompt-language flow                                    | local default plus frontier escalation | Later arm: local bulk work, external model only for policy-triggered review |

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

Use `--arms r31-domain-kernel` for the next diagnostic. It runs the R30 solo
baseline, a static deterministic-domain control, and the local PL bulk lane with the
domain kernel protected. The hybrid frontier-domain flow remains predeclared but not
runner-enabled until per-step provider routing exists.

Use local Ollama when the purpose is measuring the local-model thesis, performing
bulk artifact work with deterministic gates, or reproducing the R28/R29 diagnostic
path. Keep the same runner, model, commit, verifier, and timeout policy inside any
claim batch.

Use an external frontier model only when the question has changed to hybrid routing:
read-only final review, high-ambiguity root-cause analysis, security or data-loss
risk, or repeated local failure after the run has been classified. Do not mix
frontier edits into a local-only claim batch; record that as a separate hybrid arm.
