# Prompt-language vNext Spec Pack

This zip is a repo-oriented design package for **prompt-language vNext**. It assumes the current project state described in the repo docs as of 2026-04-09: the runtime already ships persistent state, gates, control flow, imports/reuse, memory, approvals, structured capture, review loops, parallel work, and a public SDK; the roadmap still emphasizes registry/MCP/LSP/playground/workspace items; and the thesis/eval docs explicitly say the current proven edge is **structural enforcement via gates**, while broader claims remain unproven.

## What is in this pack

- `00-executive-summary.md` — the refined thesis, strongest critiques, and what to build first
- `01-current-state-and-gap-analysis.md` — detailed scrutiny of the current runtime and docs
- `02-architecture-overview.md` — the target layered architecture
- `03-design-principles.md` — guardrails for the language and runtime
- `04-open-questions-and-risks.md` — unsolved issues and anti-goals
- `specs/` — concrete feature specs with syntax, semantics, migration, and acceptance criteria
- `plans/` — phased implementation, rollout, evaluation, and adoption plans
- `adrs/` — architecture decision records
- `examples/` — sample `.flow` files showing the proposed surface
- `backlog/` — structured backlog in Markdown, CSV, and JSON
- `source-notes.md` — the evidence base used for this pack

## Core recommendation

Treat prompt-language less as “a better control-flow DSL” and more as:

> a **trust, scope, and execution substrate** for bounded agentic engineering.

The runtime should move from:

- flow orchestration with gates

to:

- fail-closed trust semantics
- reusable contracts
- typed artifacts and schemas
- explicit effects and capabilities
- budgets, checkpoints, replay, and event logs
- safer concurrency with worktrees and locks
- first-class evals/judges and regression promotion
- provider adapters over a shared IR

## Suggested implementation order

1. Strict mode and fail-closed behavior
2. Contracts
3. Effect system + capabilities
4. Budgets + checkpoints + replay/event log
5. `review strict` + extracted judges/evals
6. Worktree-safe parallelism
7. Flow IR + lint/static analysis + flow tests
8. Memory governance + wisdom promotion
9. Provider-agnostic adapters

## Fastest way to use this pack

Read in this order:

1. `00-executive-summary.md`
2. `01-current-state-and-gap-analysis.md`
3. `specs/001-trust-model-and-strict-mode.md`
4. `specs/002-contract-system.md`
5. `specs/005-effect-system-and-capabilities.md`
6. `plans/phased-delivery-roadmap.md`

## Package intent

This is written as a **product + architecture package** you can directly turn into:

- repo docs
- ADRs
- `.beads` items
- GitHub issues
- RFCs
- implementation milestones
