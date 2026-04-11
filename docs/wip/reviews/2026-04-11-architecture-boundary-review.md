# Architecture Review: Layer Boundaries and Dependency Health

Bead: `prompt-language-2db5`
Date: `2026-04-11`
Scope: current four-layer architecture (`domain -> application -> infrastructure -> presentation`) and nearby dependency-health signals.

## Summary

The current codebase still matches the repo's intended inward-only dependency model. There are no dependency-cruiser violations, no detected external imports in non-test domain files, and the public SDK surface stays narrow.

The main remaining risk is not an active layer breach. It is edge coupling: presentation hooks still hand-wire concrete infrastructure adapters, and the spawned-child path remains more Claude-shaped than the prompt-turn runner path. That is manageable today, but it is the place where drift is most likely to appear first.

## Findings

### 1. No current layer-boundary violations found

Severity: low

Evidence:

- `npm run depcruise` passed with `0` violations across `183` modules and `717` dependencies.
- The enforced rules in [.dependency-cruiser.cjs](../../../.dependency-cruiser.cjs) match the documented architecture in [CLAUDE.md](../../../CLAUDE.md): domain cannot depend on application, infrastructure, or presentation; application cannot depend upward; infrastructure cannot depend on presentation; circular dependencies are forbidden.
- A direct scan of non-test domain files found `23` checked files and `0` non-relative imports.

Representative code references:

- [src/domain/index.ts](../../../src/domain/index.ts)
- [src/application/run-flow-headless.ts](../../../src/application/run-flow-headless.ts)
- [src/infrastructure/adapters/file-state-store.ts](../../../src/infrastructure/adapters/file-state-store.ts)
- [src/presentation/hooks/user-prompt-submit.ts](../../../src/presentation/hooks/user-prompt-submit.ts)

### 2. Dependency health is currently good, not just barely passing

Severity: low

Evidence:

- `npm run knip` passed with no unused-symbol findings.
- Port and adapter naming still follow the documented convention: `8` port files under `src/application/ports` and `16` adapter files under `src/infrastructure/adapters` matched the expected hyphenated names.
- Test co-location is still above the bead threshold: `66` colocated tests across `77` non-test source files (`85.7%`).
  Measurement rule: `src/**/*.ts` excluding `*.test.ts` and `index.ts`, with "colocated" defined as a sibling `<basename>.test.ts` file.
  Current non-colocated files under that rule are:
  `src/application/ports/audit-logger.ts`,
  `src/application/ports/capture-reader.ts`,
  `src/application/ports/command-runner.ts`,
  `src/application/ports/memory-store.ts`,
  `src/application/ports/message-store.ts`,
  `src/application/ports/process-spawner.ts`,
  `src/application/ports/prompt-turn-runner.ts`,
  `src/application/ports/state-store.ts`,
  `src/infrastructure/mcp-state-reader.ts`,
  `src/presentation/hooks/codex-post-tool-use.ts`,
  `src/presentation/hooks/format-state-load-diagnostic.ts`.
- The shipped primitive list in [CLAUDE.md](../../../CLAUDE.md) still matches the current node kinds in [src/domain/flow-node.ts](../../../src/domain/flow-node.ts), including newer orchestration nodes such as `race`, `foreach_spawn`, `remember`, `send`, and `receive`.

Supporting references:

- [src/application/ports/process-spawner.ts](../../../src/application/ports/process-spawner.ts)
- [src/application/ports/prompt-turn-runner.ts](../../../src/application/ports/prompt-turn-runner.ts)
- [src/domain/flow-node.ts](../../../src/domain/flow-node.ts)
- [src/index.ts](../../../src/index.ts)

### 3. The main architectural risk is edge composition and harness-specific drift

Severity: medium

Why it matters:

The core layering is intact, but the composition root is still spread across hook entrypoints and concrete runner/spawner adapters. That makes the edge easier to drift than the core.

Evidence:

- [src/presentation/hooks/user-prompt-submit.ts](../../../src/presentation/hooks/user-prompt-submit.ts) manually wires `FileStateStore`, `ShellCommandRunner`, `FileCaptureReader`, `ClaudeProcessSpawner`, `FileAuditLogger`, and `FileMemoryStore` directly in the hook.
- The prompt-turn side already has multiple adapter implementations behind one port:
  [src/infrastructure/adapters/codex-prompt-turn-runner.ts](../../../src/infrastructure/adapters/codex-prompt-turn-runner.ts),
  [src/infrastructure/adapters/opencode-prompt-turn-runner.ts](../../../src/infrastructure/adapters/opencode-prompt-turn-runner.ts).
- The spawned-child side is still more provider-shaped:
  [src/infrastructure/adapters/claude-process-spawner.ts](../../../src/infrastructure/adapters/claude-process-spawner.ts).
- The accepted design direction in [docs/design/multi-agent-orchestration.md](../../design/multi-agent-orchestration.md) already acknowledges that harness abstraction remains active follow-up work rather than a finished boundary.

Assessment:

This is not a current violation. It is the most likely place for future coupling debt if more harnesses are added without a shared composition path for hook-time adapter selection.

### 4. Application-layer orchestrators are growing into change hot spots

Severity: medium

Evidence:

- [src/application/advance-flow.ts](../../../src/application/advance-flow.ts) is the central orchestration hub for node advancement, interpolation, conditions, capture prompts, review loops, spawn/await behavior, memory, messaging, and diagnostics.
- [src/application/run-flow-headless.ts](../../../src/application/run-flow-headless.ts) coordinates parsing, state persistence, auto-advancement, prompt execution, and gate-only retry behavior across several ports.

Assessment:

This is appropriate work for the application layer, so it is not a layering defect. The risk is maintainability: boundary integrity can remain green while orchestration modules become the dominant regression surface.

## Checklist Status

| Check                                       | Result                 | Notes                                                                                                                                                                                     |
| ------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run depcruise`                         | Pass                   | `0` violations                                                                                                                                                                            |
| `npm run knip`                              | Pass                   | No unused-symbol output                                                                                                                                                                   |
| Domain files have external imports          | Pass                   | `0` findings across `23` non-test files                                                                                                                                                   |
| Test co-location ratio `> 85%`              | Pass                   | `85.7%`                                                                                                                                                                                   |
| New ports/adapters follow naming convention | Pass                   | No mismatches found                                                                                                                                                                       |
| New singletons or global state              | No material finding    | Heuristic scan hit local `Set`/`Map` constants, not true cross-layer singleton state                                                                                                      |
| `CLAUDE.md` primitive list still accurate   | Pass                   | Matches current `FlowNodeKind` list                                                                                                                                                       |
| Flow-complexity review                      | Partial / evidence gap | [src/domain/flow-complexity.ts](../../../src/domain/flow-complexity.ts) scores `FlowSpec`, not source modules, so the bead wording does not map directly to repo-file architecture health |

## Evidence and Confidence

Confidence: high for current layer integrity, medium for forward-looking maintainability risk.

Direct evidence came from:

- repo policy and architecture docs in [AGENTS.md](../../../AGENTS.md) and [CLAUDE.md](../../../CLAUDE.md)
- enforced dependency rules in [.dependency-cruiser.cjs](../../../.dependency-cruiser.cjs)
- current source structure under `src/domain`, `src/application`, `src/infrastructure`, and `src/presentation`
- live checks run for this review: `npm run depcruise` and `npm run knip`

## Recommended Follow-up

If this review turns into implementation work, the next useful slice is a small composition-root cleanup for presentation hooks so adapter selection is less duplicated and less Claude-specific at the edge.
