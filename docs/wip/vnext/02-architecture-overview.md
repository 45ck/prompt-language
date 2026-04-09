# Target architecture overview

## Design goal

Separate prompt-language into clean layers so the system is easier to trust, test, port, and evolve.

## Layered architecture

### Layer A — Spec / intent

Purpose:

- define what must remain true
- express scenarios, invariants, and non-goals
- define allowed scope and required artifacts

New surface:

- `spec`
- `contract`
- `schema`
- `policy`

### Layer B — Compile / validate

Purpose:

- parse and validate flows
- resolve imports and contracts
- type-check state/artifacts
- infer capabilities and risk
- emit a stable Flow IR
- simulate or lint before execution

New components:

- parser
- contract checker
- schema/type validator
- static analyzer
- simulator
- compiler

### Layer C — Runtime execution

Purpose:

- execute Flow IR
- manage state, checkpoints, retries, and child flows
- enforce policies and budgets
- log events and artifacts
- replay/resume safely
- mediate effects

New components:

- event log
- state snapshotderivation
- policy engine
- effect executor
- checkpoint manager
- replay engine

### Layer D — Evaluation / learning

Purpose:

- score outcomes
- compare candidates
- lock baselines
- generate regressions from failures
- promote durable wisdom/contracts

New surface:

- `rubric`
- `judge`
- `eval`
- regression promotion tooling
- memory governance tooling

### Layer E — Provider / tool adapters

Purpose:

- run the same Flow IR against different agent runtimes and tool ecosystems

Adapters:

- Claude Code adapter
- Codex CLI adapter
- raw shell/tool adapter layer
- future provider adapters

## Why this separation matters

Without this separation:

- natural-language intent and executable flow blur together
- trust decisions happen too late
- replay is weak
- portability is hard
- evaluation becomes ad hoc
- runtime hooks become the architecture instead of an adapter

With this separation:

- the language becomes reviewable and testable
- provider-specific behavior becomes pluggable
- the project can evolve beyond “Claude hooks + DSL”
- you can eventually build a true engineering substrate

## Architectural north star

**Prompt-language source → Flow IR → policy-checked runtime → replayable artifacts → eval/regression loop**
