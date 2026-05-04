# Evidence Audit

Date: 2026-05-04

## What We Already Know

Prompt-language is not proven to be a universal speed win. The strongest E4
throughput batch showed direct Codex faster on the bounded CRM slice. That matters
because it prevents a sloppy conclusion: adding orchestration has overhead.

Prompt-language does have repeated evidence for governed quality:

- E4 factory-quality batches favored prompt-language across clean counterbalanced
  pairs when the endpoint was process conformance, closure quality, and reusable
  factory behavior.
- E7-MK showed a narrow but stable quality lift: prompt-language scored `30/30` in
  three runs while solo varied at `28/30` to `29/30`.
- The E7-MK failure pattern was specific and valuable: solo repeatedly missed
  low-salience requirements such as favicon and exact product-name spelling, while
  retry-with-validation forced correction.
- E9 showed real runtime execution of phase sequencing, variable capture,
  deterministic checks, loops, and gates in a full SDLC website flow.
- Aider-vs-PL Phase 1 suggests local models benefit from gates, decomposition, file
  scoping, and retries, but that line remains informal until Phase 2 produces
  predeclared, repeated, trace-backed bundles.
- Senior Pairing Protocol shows that a compact senior-engineering flow can guide a
  local model through a small task, but it does not answer whether full-stack product
  delivery improves.

## What Is Not Proven

We have not yet run the exact comparison the user asked about:

> same local model, same full-stack CRUD task, direct solo prompt versus
> prompt-language flow.

Existing CRM and website factories are adjacent evidence, not the direct answer.
The next experiment should therefore be a full-stack CRUD benchmark with objective
gates and paired local-model runs.

As of R29, we still do not have a claim-grade FSCRUD batch. The live local probes are
valuable because they expose the bottleneck, but they remain diagnostics: solo has
repeatedly completed partial apps around the `61/100` level, while the strongest
prompt-language scaffold and micro-contract arms have plateaued around `80/100` with
`domain_behavior_failed`.

## Narrowed Thesis

The defensible thesis is not "prompt-language always beats direct prompting."

The defensible thesis is:

Prompt-language helps most when the target task has enough cross-layer complexity
that deterministic process control, explicit gates, retries, and traceable artifacts
prevent omissions that a single direct prompt tends to miss.

That predicts wins on:

- CRUD completeness across multiple entities
- API/UI/schema consistency
- validation and error handling
- hidden low-salience requirements
- tests and verification artifacts
- recovery after gate failures

That predicts losses or ties on:

- trivial implementation tasks
- raw time-to-green
- tasks where a frontier model already gets everything right on the first pass

## Next Experiment Rationale

`FSCRUD-01` is the right next experiment because it is hard enough for local models to
drop details, but still small enough to verify deterministically.

The comparison should use local inference first. A hybrid frontier-router arm is
valuable later, but adding it now would blur the core question. First prove or falsify
the local-only PL lift.

## R28 Evidence Update

R28 tested the first micro-contract treatment with native Ollama. The result supports
one narrow claim and rejects another:

- Supported: prompt-language structure can improve broad artifact coverage over the
  same local model running solo.
- Rejected: natural-language micro-contract cards alone can reliably preserve the
  exact CommonJS domain export surface for this task and model.

The important failure was not missing documentation or a cosmetic UI issue. The model
reduced `src/domain.js` to a partial set of empty customer exports, omitted
`deleteCustomer`, and dropped all asset and work order exports. That is why R28 should
drive export-surface controls rather than broader prompts or stronger rhetoric.

## R29 Evidence Update

R29 tested micro-v2 with the public domain API artifacts, checkpoint scripts, and
deterministic export normalization. Solo again scored `61/100` and ended
`verifier_failed`. The micro-v2 arm scored `80/100` but ended `flow_failed` at the
first customer review after `3/3` rounds.

The useful result is that the export surface stabilized. The remaining blocker moved
to behavior implementation: customer behavior/domain implementation still failed,
and the hidden verifier hard failure remained `domain_behavior_failed`. This points
the next experiment toward a stronger domain implementation lane or deterministic
domain kernel, not more export-surface wording.

## R30 Evidence Requirement

R30 should not be scored as another broad product comparison unless it produces a
clean repeated batch. Its immediate evidence target is narrower: identify whether
`domain_behavior_failed` is the first-order bottleneck after export-surface control
has stabilized.

Claim-grade R30 evidence requires a predeclared matrix that keeps local-only arms
local-only and labels any frontier-authored `src/domain.js` as hybrid evidence. The
decisive signal is not aggregate score alone. The decisive signal is whether a lane
can make the public domain checks pass and whether the hidden verifier then still
fails on domain behavior or moves to a different hard failure.

## R30 Evidence Update

The first R30 local-only diagnostic,
`live-fscrud-r30-domain-control-20260504-1208`, did not support the hypothesis that
stronger local natural-language domain control is enough for this model.

Results:

- `r30-solo-local`: `8/100`, `flow_failed`, primary failure
  `package_json_missing_or_invalid`.
- `r29-static-export-control`: `80/100`, `flow_failed`, hard failure
  `domain_behavior_failed`.
- `r30-pl-domain-control`: `80/100`, `flow_failed`, hard failure
  `domain_behavior_failed`.

The stronger R30 domain-control lane preserved static artifacts, seed integrity, UI
surface, test files, and the exact export surface. It still left `src/domain.js` as
stub functions and failed executable behavior at `reset not implemented`.

This supports a narrower conclusion: R29/R30 are now isolated to executable domain
behavior for the local model, not export-surface drift or missing scaffold artifacts.
It does not prove PL can complete FSCRUD locally. The next useful control is R31:
provide a deterministic domain kernel, protect it, and test whether local PL can
complete non-domain server/UI/docs work around it.

## R31 Evidence Update

The R31 domain-kernel diagnostic,
`live-fscrud-r31-domain-kernel-20260504-1247`, tested that control directly with
native Ollama and `qwen3-opencode-big:30b`.

Results:

- `r30-solo-local`: `35/100`, `flow_failed`, hard failures
  `ui_surface_incomplete`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r31-pl-domain-kernel-bulk`: `93/100`, `flow_failed`, hard failure
  `ui_surface_incomplete`; domain behavior passed.

This confirms the deterministic domain kernel is verifier-valid and that the local
PL lane can avoid the R30 executable-domain failure when the domain layer is supplied
and protected. It still does not prove local PL can complete FSCRUD end to end,
because the local bulk lane missed hidden UI/product-surface coverage.

The evidence-backed next step is R32, a protected-kernel server/UI surface-control
lane. The hypothesis is narrower than "PL solves FSCRUD locally": test whether
explicit nearby UI entity/action gates can close the final `7/100` gap without
frontier edits.

## R32 Evidence Update

The R32 UI surface-control diagnostic,
`live-fscrud-r32-ui-surface-20260504-1448`, tested that narrower hypothesis with
native Ollama and `qwen3-opencode-big:30b`.

Results:

- `r30-solo-local`: `40/100`, `flow_failed`, hard failures
  `ui_surface_incomplete`, `seed_integrity_failed`, and
  `domain_behavior_failed`.
- `r31-static-domain-kernel-control`: `100/100`, `verified_pass`.
- `r32-pl-ui-surface-control`: `80/100`, `flow_failed`, hard failure
  `ui_surface_incomplete`; domain behavior passed.

R32 did not close the R31 gap. The public review loop failed after `4/4` rounds:
the generated UI covered only customers and assets, missed work_orders and the
status/priority/completedAt task concepts, and the run never reached README,
run-manifest, or verification-report creation.

This weakens the "just write the prompt language better" explanation for the UI
surface blocker. The next useful local-only control should add structure the model
cannot skip: deterministic UI skeleton, per-entity UI cards, or split artifact cards
after the UI surface is green.

## Model-Use Boundary

Use local Ollama when the experiment is testing local-model capability, bulk
artifact generation under deterministic gates, repeated repair against public
checks, or GPU/cost telemetry. The R28/R29 evidence says local Ollama is appropriate
for diagnostics and controlled local-only measurements, but not yet proven sufficient
for the FSCRUD domain layer.

Use an external frontier model only when the run is explicitly a hybrid experiment or
when the operational risk justifies escalation: final read-only review,
high-ambiguity root-cause analysis, architecture/security/data-loss decisions, or
repeated local failure after classification. Frontier advice or patches must not be
mixed into a local-only claim batch.
