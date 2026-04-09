# Does this fit the design of Prompt Language?

## Short answer

Yes — but only if these additions strengthen Prompt Language as an **explicit, inspectable, project-oriented engineering medium**.

They do **not** fit well if they turn Prompt Language into:

- a general memory platform
- a vector-database DSL
- a fuzzy retrieval engine
- a system with hidden autonomous memory mutation

## Why it fits

Prompt Language's own thesis already places these inside scope:

- memory
- reusable wisdom
- recovery logic
- multi-file projects
- persistent lessons
- project-level operating knowledge

That means:

- `knowledge:`
- `section`
- scoped memory
- checkpoints
- project `wisdom.flow`
- repo `memory/`
- policy/read-only docs

are all directionally consistent with the repo vision.

## Why some parts do not fit as core DSL

The current runtime is strongest where it is:

- deterministic
- hook-driven
- gate-enforced
- stateful in an explicit way
- auditable

So the language should avoid exposing:

- vector index internals
- embedding model selection in ordinary flows
- hidden retrieval side effects
- very heavy memory ontologies

Those belong in runtime config, adapters, or the eval layer.

## Best design split

### Core DSL

Keep these close to the language:

- `knowledge:`
- `section`
- `remember`
- `memory:`
- `checkpoint`
- `approve`
- `review`
- `done when:`
- `spawn` / `await`

### Project system

Keep these as repo-level composition:

- `wisdom.flow`
- `policies.flow`
- `review.flow`
- `memory/`
- Markdown guidance trees
- shared reusable libraries

### Runtime / backend config

Keep these below normal flow authoring:

- retrieval backend choice
- keyword vs hybrid vs semantic modes
- background consolidation
- versioned memory backends
- retention defaults
- access-control defaults

### Eval / meta layer

Keep these above ordinary execution:

- rubrics
- judges
- eval suites
- baselines
- replay
- artifact reports

## Litmus test

A feature fits if it helps engineers edit the **execution system** rather than repeatedly babysitting outputs.

A feature does not fit as well if it mostly teaches the language about backend storage internals.
