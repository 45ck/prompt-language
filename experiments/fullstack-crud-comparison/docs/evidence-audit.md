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
