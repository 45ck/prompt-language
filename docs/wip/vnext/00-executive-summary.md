# Executive summary

## Refined thesis

Prompt-language should evolve from:

- a stateful flow runner around Claude/Codex

into:

- a **safe execution substrate for bounded software work**

That means the language should optimize for six things:

1. **Deterministic checks over model judgment**
2. **Fail-closed behavior over fail-open convenience**
3. **Contracts over ad hoc human supervision**
4. **Explicit side effects over opaque shell**
5. **Replayable execution over hidden state mutation**
6. **Provider-agnostic execution over provider-specific hooks**

## Current truth

The repo already proves something real: the runtime’s strongest measured advantage is **structural enforcement through gates**. The eval docs are unusually honest: flow control mostly ties vanilla, while gate-based enforcement is the proven differentiator. The thesis docs also explicitly say the stronger claims are not yet proven: preference for editing prompt-language over code, stable multi-file prompt-language repos, wisdom materially reducing babysitting, and prompt-language as the primary engineering surface all remain hypotheses.

That means the right next step is **not** more control-flow sugar.

The right next step is:

- stricter trust semantics
- stronger contracts
- typed state and artifacts
- explicit effects and capabilities
- better replay/observability
- safer parallelism
- a first-class evaluation and learning loop

## Build first

### P0 — Trust hardening

- strict mode
- fail-closed captures
- fail-closed approvals
- fail-closed review exhaustion
- fail-closed state corruption handling
- budgets
- checkpoints

### P1 — Scope and effects

- contracts
- risk tiers
- effect nodes
- capabilities
- policy engine

### P2 — Replayability and compile-time rigor

- append-only event log
- replay CLI
- Flow IR
- static analysis
- flow unit tests
- simulator

### P3 — Evaluation and learning

- reusable rubrics
- reusable judges
- eval suites
- baseline locking
- failure-to-fixture promotion
- memory/wisdom governance

### P4 — Safer orchestration

- worktree-backed spawn
- resource locks
- ownership declarations
- merge/backout policies

### P5 — Portability

- provider adapters (Claude Code, Codex CLI, future others)
- tool adapters over shell
- shared runtime engine over Flow IR

## Most important additions

If only four things ship, ship these:

1. **Strict mode**
2. **Contracts**
3. **Explicit effect system**
4. **Event log + replay**

That combination alone would materially reduce developer babysitting while making the system more trustworthy.

## Main critique of the current roadmap

The current roadmap prioritizes useful DX items such as registry/MCP/LSP/playground/workspace orchestration. Those are good, but they are not the highest-leverage autonomy multipliers. The biggest missing items are trust, contracts, effects, event logs, checkpoints, evals, and provider abstraction.

## Main product message

Do **not** position prompt-language as:

- “zero oversight”
- “the end of code”
- “fully autonomous software engineering”

Do position it as:

- “a bounded, replayable, fail-closed execution layer for agentic engineering”
- “a way to move human effort from babysitting steps to designing contracts, policies, and evaluations”
