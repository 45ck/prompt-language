# Target Architecture

## Design principle

The operator shell must be a **layer above** the prompt-language runtime, not a second runtime.

## Layered model

### Layer 0 — Runtime core (existing center)

This remains the source of truth:

- parser + lowering
- session advancement
- gate evaluation
- state machine
- memory
- child-flow coordination
- SDK surface

Nothing in the shell may bypass this layer.

### Layer 1 — Canonical lowering and templates

This layer turns ergonomic conveniences into explicit prompt-language artifacts:

- workflow alias templates
- generated flow files
- project-scaffolding templates
- AGENTS / library bootstraps
- compiled / rendered views of higher-level actions

Rule: if a user runs a convenience workflow, the result must be explainable as an explicit flow, generated file, or state transition.

### Layer 2 — Host integration and operator services

This layer owns environment integration:

- hook manager
- setup / doctor / refresh / uninstall
- run-state directory management
- migration helpers
- inspect / recovery surfaces
- watch / statusline aggregation
- optional worktree / tmux adapters

This layer is implementation-specific, but must not become product-defining.

### Layer 3 — Operator shell UX

This is the user-facing shell:

- doctor and status summaries
- operator cockpit / enhanced watch
- workflow aliases
- team supervisor commands
- inspect commands
- recovery helpers

It should feel polished, but every action must map back to lower layers.

## Proposed runtime directory v2

.prompt-language/
session-state.json # backward-compatible canonical entry
runs/
<run-id>/
manifest.json
plan/
gates/
logs/
approvals/
children/
artifacts/
recovery/
rendered/
hooks/
ownership.json
installs/
guidance/
AGENTS.generated.md
flow-library/
cache/
diagnostics/

## Key invariants

1. `session-state.json` remains readable as the stable entry point.
2. Richer directories are additive and migration-safe.
3. Hooks must be merge-safe and uninstall-safe.
4. The operator cockpit reads from runtime state; it does not invent alternate truth.
5. Team supervision orchestrates child flows; it does not replace them.

## Compatibility model

- keep existing commands working
- add operator-shell commands incrementally
- treat all workflow aliases as optional ergonomics
- keep docs explicit about which surfaces are shipped, tracked, or merely imported planning artifacts
