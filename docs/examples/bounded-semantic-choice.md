# Example: Bounded Semantic Choice

Use this pattern when a local or cheaper model is useful for judgment, but should
not own artifact shape, final rendering, or verification.

The model chooses from a closed option set and gives a short rationale. PL then
validates the choice deterministically, renders the final artifact, and gates on a
real check.

## Natural language

```
Pick the safest repair strategy from these three options. Explain the choice using
only the supplied criteria. Do not edit code directly. The runtime will validate
your selection, render the plan, and run the verifier.
```

## DSL pattern

```yaml
Goal: choose a bounded repair strategy and render it deterministically

flow:
  let decision = prompt "Choose the best repair strategy for this failing task.

  Options:
  - guard-path-seed-schema-handoff: protect path root, seed integrity, schema repair, and handoff artifacts
  - expand-editable-product-scope: let the model edit more product files
  - defer-verification-to-manual-review: skip deterministic verification and rely on manual review

  Criteria:
  - Prefer protected local scope.
  - Prefer deterministic verification.
  - Prefer strategies that reduce path-root, seed, schema, and handoff risk.

  Return JSON with:
  - choice: one option id
  - rationale: one sentence using at least two criteria terms" as json {
    "choice": "string",
    "rationale": "string"
  }

  run "node scripts/validate-choice.mjs '${decision.choice}' '${decision.rationale}'"
  run "node scripts/render-plan.mjs '${decision.choice}' '${decision.rationale}' > plan.md"
  run "node scripts/verify-plan.mjs plan.md"

done when:
  file_exists plan.md
```

## What PL owns

- The closed option set.
- The JSON fields required from the model.
- Deterministic validation of option ids and rationale terms.
- Rendering the final `plan.md`.
- The final gate that decides whether the output is acceptable.

## What the model owns

- Selecting one option from the closed set.
- Providing a short criteria-grounded rationale.

## Why this matters

The FSCRUD R40-R45 diagnostics found that local Ollama was unreliable as a
free-form full-stack implementer, but useful as a bounded selector/ranker/rationale
source when deterministic tooling owned shape and verification.

This pattern turns that result into a reusable workflow rule:

```text
local model = bounded semantic judgment
PL runtime = validation, normalization, rendering, gates, and evidence
```

## When not to use it

Do not use this pattern when the model must invent the option set, generate large
free-form artifacts, or own product behavior directly. For those cases, run a
separate implementation-slice experiment with protected files, hidden verifier, and
clear failure classification.
