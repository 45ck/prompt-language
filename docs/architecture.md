# Architecture

prompt-language follows domain-driven design with four layers and strict inward dependency flow.

## Layer structure

```
src/domain/          Pure types and functions. Zero external dependencies.
src/application/     Use cases, port interfaces.
src/infrastructure/  Adapters implementing ports.
src/presentation/    Hook entry points.
```

Dependencies flow strictly inward: presentation depends on infrastructure, infrastructure depends on application, application depends on domain. Domain never imports from other layers. This is enforced at build time by [dependency-cruiser](https://github.com/sverweij/dependency-cruiser).

## Execution model

The runtime is approximately 85% deterministic (no AI involvement). Only `prompt` nodes and `let x = prompt` capture pause for Claude's response. All other node types -- `let`, `run`, `while`, `until`, `retry`, `if`, `try`, `foreach`, `break`, `continue`, `spawn`, `await` -- auto-advance without AI interaction.

### Hook-driven loop

The runtime integrates with Claude Code through lifecycle hooks:

1. **UserPromptSubmit** -- parses DSL, creates session state, advances through auto-advance nodes, injects the current step into Claude's context
2. **PostToolUse** -- scans tool results for capture tags and state changes
3. **Stop** -- intercepts when Claude tries to stop; blocks if steps remain or gates have not passed
4. **TaskCompleted** -- runs gate commands; blocks completion if any gate fails (exit code 2)
5. **PreCompact** -- injects a compact summary as additional context so the flow survives context window exhaustion

### Core advancement loop

`autoAdvanceNodes()` in `src/application/advance-flow.ts` is the central loop. It processes nodes sequentially until it encounters a `prompt` node (which requires Claude's response) or reaches the `MAX_ADVANCES` safety limit.

### State immutability

All state transitions return new `SessionState` objects. The state is never mutated in place. State persists to `.prompt-language/session-state.json` with SHA-256 checksums, two-generation backups, and atomic write-then-rename.

## Key implementation files

| File                                              | Purpose                                            |
| ------------------------------------------------- | -------------------------------------------------- |
| `src/domain/flow-node.ts`                         | Node type definitions and factory functions        |
| `src/domain/session-state.ts`                     | Immutable session state and transition functions   |
| `src/domain/render-flow.ts`                       | Flow visualization with execution markers          |
| `src/domain/evaluate-condition.ts`                | Pure condition evaluation (and/or, comparisons)    |
| `src/domain/interpolate.ts`                       | Variable interpolation and shell-safe substitution |
| `src/application/parse-flow.ts`                   | DSL parser (line-oriented, indentation-based)      |
| `src/application/advance-flow.ts`                 | Node advancement and control-flow logic            |
| `src/application/evaluate-completion.ts`          | Gate evaluation with built-in predicates           |
| `src/infrastructure/adapters/file-state-store.ts` | State persistence with integrity checks            |

## Design documents

For detailed design decisions, boundaries, and rationale:

- [Design index](design/index.md) -- canonical architecture boundaries and accepted decisions
- [Hooks architecture](design/hooks-architecture.md) -- hook lifecycle and protocol
- [Multi-agent orchestration](design/multi-agent-orchestration.md) -- subagent-first boundary
- [Compact context program](design/compact-context-program.md) -- context-adaptive rendering

## Naming conventions

| Kind      | Pattern                 | Example                            |
| --------- | ----------------------- | ---------------------------------- |
| Use cases | `verb-noun.ts`          | `parse-flow.ts`, `advance-step.ts` |
| Adapters  | `noun-adapter.ts`       | `file-state-adapter.ts`            |
| Ports     | `noun-port.ts`          | `state-port.ts`                    |
| Tests     | `*.test.ts` (colocated) | `parse-flow.test.ts`               |

## Quality enforcement

The CI pipeline runs: typecheck, lint, format check, spell check, dependency-cruiser (layer violations), knip (unused code), build, test with coverage, e2e eval, and audit. Run locally with `npm run ci`.
