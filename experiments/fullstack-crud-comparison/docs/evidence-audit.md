# Evidence Audit

Date: 2026-04-30

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
