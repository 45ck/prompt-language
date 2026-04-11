# Adopt / Modify / Reject Matrix

## Adopt directly

### Setup / doctor / refresh / uninstall discipline

Take the lifecycle hygiene almost unchanged. prompt-language already has install / status / uninstall; it should extend that into explicit refresh and doctor semantics.

### Hook ownership model

Take the rule that tool-managed hooks must preserve user-owned hooks and uninstall cleanly.

### Richer run-state and recovery artifacts

Take the discipline of treating state, logs, plans, and recovery files as first-class artifacts instead of a single opaque session file.

### Explicit operator monitoring

Take the idea that long-running flows deserve a robust watch / HUD surface.

### Read-only inspect surfaces

Take the idea of bounded repo inspection and shell-native verification helpers.

## Modify

### Canonical workflows

Do not copy `$deep-interview`, `$ralplan`, `$ralph`, `$team` as the primary product identity.
Instead, ship prompt-language equivalents that lower to explicit flow templates.

### AGENTS / skills

Do not create an invisible command universe that outranks the language.
Turn this into:

- project scaffolding
- flow libraries
- reusable gate packs
- generated guidance files

### HUD

Do not create a parallel runtime experience.
Extend `watch` and statusline into an operator cockpit fed by runtime state.

### Team runtime

Do not make tmux/worktree the conceptual model.
Build a supervisor over `spawn` / `await`, with optional worktree or tmux adapters where they materially help.

## Reject

### Codex-first identity

prompt-language should stay runner-agnostic at the product level, even while supporting runner-specific adapters.

### Command-first identity

The language and runtime must stay primary. Shortcuts are secondary.

### Hidden authority layers

No skill, role, or alias should bypass gates, approvals, or visible runtime state.

### Environment-specific worldview

tmux, worktrees, hooks, and host adapters are implementation details, not the explanation of the product.

## Final rule

The OMX move for prompt-language is:

> copy the operations discipline, translate the abstractions, reject the identity shift.
