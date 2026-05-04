<!-- cspell:ignore FSCRUD fscrud metacognition metacognitive precheck -->

# Full-Stack CRUD Comparison

Status: diagnostic probes running; no claim-grade batch yet

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

| Arm                               | Runner                                                  | Model                                  | Purpose                                                                     |
| --------------------------------- | ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `solo-local-crud`                 | aider or prompt-language `--runner aider` direct prompt | local Ollama model                     | Baseline: direct "build the app" prompt                                     |
| `pl-local-crud-factory`           | prompt-language flow                                    | same local Ollama model                | Treatment: phase, gate, retry, review, and verification control             |
| `pl-local-crud-scaffold-contract` | prompt-language flow                                    | same local Ollama model                | Treatment: deterministic senior scaffold plus executable contract feedback  |
| `pl-local-crud-micro-contract`    | prompt-language flow                                    | same local Ollama model                | Diagnostic: scaffold plus executable domain micro contracts                 |
| `pl-local-crud-micro-contract-v2` | prompt-language flow                                    | same local Ollama model                | Diagnostic: public domain API contract, export normalizer, checkpoint tests |
| `pl-local-senior-crud`            | prompt-language flow                                    | same local Ollama model                | Optional later arm: senior pairing metacognition plus factory gates         |
| `hybrid-router-crud`              | prompt-language flow                                    | local default plus frontier escalation | Later arm: local bulk work, external model only for policy-triggered review |

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

The next planned diagnostic treatment is
[flows/pl-fullstack-crud-micro-contract-v2.flow](flows/pl-fullstack-crud-micro-contract-v2.flow).
It adds public domain API artifacts (`DOMAIN_API.md`, `contracts/domain-exports.json`,
and `scripts/check-domain-*.cjs`), deterministic export-surface normalization between
micro steps, and public checkpoint reviews. The hidden FSCRUD verifier remains in the
experiment harness after the flow, not in model-facing repair loops. Run it with
`--arms micro-v2`.
