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

## R33 Planned Evidence Target

R33 is a deterministic UI skeleton control. It will keep the R31 deterministic
domain kernel, add a protected deterministic `public/index.html` skeleton, and ask
the local model to complete only server integration and final handoff artifacts.

Evidence interpretation is intentionally bounded:

- A pass would support "local model can finish constrained integration around
  deterministic domain and UI contracts."
- A pass would not support "local model can generate the UI surface."
- A failure would indicate the remaining blocker is likely server/docs/report
  orchestration or runner reliability, not domain behavior or static UI coverage.

Observed R33 result after the review-gate syntax fix:
`live-fscrud-r33-ui-skeleton-reviewgate-20260504-1624`.

- Solo baseline: `8/100`, broad product failure.
- Static deterministic control: `100/100`, `verified_pass`.
- R33 treatment: `87/100`, verifier passed, no hard failures, hidden oracle passed,
  domain behavior passed, and UI surface passed.

The treatment still has `outcome=flow_failed`, but the cause changed after fixing
the invalid review syntax. The flow reached strict grounded review and failed after
four rounds because `run-manifest.json` and `verification-report.md` remained
missing. The local model did create `src/server.js` and `README.md`, and the hidden
verifier still passed with no hard failures. Classify this as artifact-following
debt under strict local repair, not domain or UI failure.

## R34 Evidence Update

R34 ran as `live-fscrud-r34-server-only-rerun-20260504-1710` on `2026-05-04`
with native Ollama and `qwen3-opencode-big:30b`.

- Solo baseline: `40/100`, broad product failure with UI, seed, and domain hard
  failures.
- Static deterministic control: `100/100`, `verified_pass`.
- R34 treatment: `100/100`, `verified_pass`, public gate passed, hidden oracle
  passed, and domain behavior passed.

This supports a narrow claim: local PL can make the same local model perform
server-only integration when domain behavior, UI surface, README, run manifest,
and verification report are deterministic protected artifacts. It does not prove
local generation of those artifacts.

The strict-root rerun
`live-fscrud-r34-server-only-strict-root-20260504-1727` tested the same diagnostic
after adding the nested-root guard. The treatment again scored `100/100` on content,
passed the public gate, and passed executable domain behavior, but the hidden oracle
failed with `path_root_isolation_failed` because the workspace contained an extra
nested `fscrud-01/src/server.js`.

That updates the evidence boundary: R34 proves constrained server integration
capability only before strict path isolation. Under the hardened verifier, the
remaining blocker is local action path discipline, not domain behavior, UI surface,
or handoff artifact generation.

The path-guard rerun
`live-fscrud-r34-server-only-path-guard-20260504-1801` tested the runner and public
gate hardening directly. The treatment scored `100/100`, completed the PL flow,
passed the public gate, passed the hidden verifier, passed executable domain
behavior, and passed `pathRootIsolation` with no nested roots.

That is the strongest R34 evidence so far, but it remains narrow. It supports
constrained server-only local integration around deterministic protected artifacts.
It still does not prove local generation of the domain kernel, UI skeleton, README,
run manifest, or verification report. The next claim-grade step should be a repeated
same-commit R34 path-guard batch, not a broad PL-vs-solo conclusion.

The same-commit R34 path-guard batch
`live-fscrud-r34-server-only-path-guard-k3-20260504-1820` ran three repeats on
`2026-05-04` with native Ollama and `qwen3-opencode-big:30b`. The treatment passed
all three repeats at `100/100`. Each R34 repeat had `pathRootIsolation=true`, no
nested roots, no leaks, executable domain behavior passing, and npm tests exiting
`0`.

The solo baseline failed all three repeats with scores `48/100`, `33/100`, and
`48/100`; failures stayed in the expected broad-product categories rather than
server-only integration. The static deterministic control passed all three repeats
at `100/100`.

This upgrades R34 from a single-run diagnostic to a stable narrow control: under
strict path guarding, local PL can make this local model complete server-only
integration around deterministic protected FSCRUD artifacts. It does not upgrade the
broader thesis. The next evidence step should broaden artifact responsibility one
class at a time, such as handoff artifacts first or UI skeleton next, while keeping
the same runner, model, verifier, path guard, and timeout discipline.

## R35 Planned Evidence Target

R35 gives responsibility for handoff artifacts back to the local model while keeping
domain behavior, UI surface, and server integration deterministic and protected. It
is intentionally narrower than R33 and broader than R34.

Evidence interpretation:

- A pass supports local generation of README, run manifest, and verification report
  artifacts under strict PL review when product behavior is already protected.
- A pass does not support local generation of server, UI, or domain code.
- A failure isolates the remaining blocker to handoff artifact-following discipline,
  because the product behavior path is deterministic.

First R35 smoke result:
`live-fscrud-r35-handoff-artifacts-20260504-1925` ran on `2026-05-04` with native
Ollama and `qwen3-opencode-big:30b`. The treatment scored `91/100`, passed hidden
verification, passed executable domain behavior, and passed path isolation, but the
PL flow failed public review. It created `README.md` and a generic
`run-manifest.json`, missed `verification-report.md`, and then returned a no-op
repair response.

That does not falsify product assembly; it isolates the residual issue to handoff
artifact-following. The follow-up R35 change splits README, manifest, and
verification report into separate cards with file-specific public checks before the
full R35 public gate.

Follow-up R35 results:

- `live-fscrud-r35-handoff-artifacts-split-20260504-1945`: treatment scored
  `87/100`, hidden verification passed, executable domain behavior passed, UI
  surface passed, and path isolation passed, but the flow failed after creating only
  `README.md`.
- `live-fscrud-r35-handoff-artifacts-template-20260504-1955`: treatment again scored
  `87/100` with the same protected product checks passing, but the model wrote a
  generic README and ignored a grounded `readme_missing:npm test` critique before
  the flow reached `run-manifest.json` or `verification-report.md`.

Updated R35 evidence: stronger split-card structure and exact template wording did
not make this local model comply with non-code handoff artifact generation. R35
therefore isolates the remaining local-only blocker to artifact-following and repair
compliance, not product behavior. A deterministic fallback writer would make the
flow pass, but it would no longer measure local-model handoff artifact generation.

## R36 Evidence Update

R36 tested whether the R35 blocker was specifically multi-file Markdown/JSON
handoff generation, or whether the same local model would comply if asked for one
structured source file that deterministic tooling could render into handoff
artifacts.

Observed R36 results:

- `live-fscrud-r36-structured-handoff-20260504-2008`: treatment scored `82/100`,
  hidden verification passed, domain behavior passed, UI surface passed, seed
  integrity passed, and path isolation passed, but the model wrote `{}` to
  `handoff-source.json` and failed the structured-source review.
- `live-fscrud-r36-structured-handoff-template-20260504-2025`: treatment again
  scored `82/100` with protected product checks green, but the model wrote a short
  invented object instead of the supplied exact JSON template.

Updated R36 evidence: the failure is not just freeform handoff prose. This local
model is not reliably following even a single structured-source artifact contract
under the current natural-language PL runner. The next defensible local-only
diagnostic would need runtime-level schema/constrained output support, or it should
be labeled as deterministic artifact rendering rather than local model handoff
generation.

## R37 Evidence Update

R37 gives the model only
`handoff-source.raw.json` and uses deterministic tooling to check for minimum
handoff intent before normalizing canonical `handoff-source.json` and rendering the
final handoff artifacts.

Observed R37 results:

- `live-fscrud-r37-schema-repaired-handoff-20260504-2055`: treatment scored
  `82/100`; the model emitted repairable raw intent and deterministic normalization
  produced canonical `handoff-source.json`, but a post-normalization model review
  stopped the flow before deterministic rendering.
- `live-fscrud-r37-schema-repaired-handoff-fixed-20260504-2110`: treatment scored
  `100/100` and passed public gate, hidden verifier, executable domain behavior,
  and path isolation after that unnecessary model step was removed.

Updated R37 evidence: this supports only schema-repairable local handoff intent. It
does not prove strict local JSON-schema compliance or local generation of final
README, manifest, or verification-report artifacts. It does show a useful pattern:
let local inference emit small intent payloads, then use deterministic normalization
and rendering for artifacts where exact schema/format compliance matters.

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
