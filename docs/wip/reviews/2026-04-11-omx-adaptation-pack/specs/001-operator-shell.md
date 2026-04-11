# Spec 001 — Operator Shell

## Goal

Add an operator shell around prompt-language that improves install, inspection, recovery, and supervision without changing the runtime's source of truth.

## Principles

- the runtime remains canonical
- every shell surface must lower to runtime state, generated flows, or stable host integrations
- no shell surface may bypass gates or obscure recovery state

## Proposed command additions

Using the existing CLI namespace:

- `doctor` — validate install, hooks, state layout, runner availability, and migration status
- `refresh` — re-render managed integrations without clobbering user-owned state
- `inspect` — read-only repo / runtime inspection
- `team-status` — summarize active child-flow topologies
- `team-resume` — resume an interrupted supervised topology
- `team-stop` — graceful stop / cleanup path
- `render-workflow <name>` — show the lowered flow template for a canonical workflow alias

## Command contract

### doctor

Must emit:

- human-readable summary
- machine-readable JSON mode
- clear ownership warnings
- migration instructions
- hook conflicts
- runner availability problems
- stale child-flow / lock / artifact detection

### refresh

Must:

- reapply managed shell artifacts
- preserve user-owned hook entries
- avoid deleting unknown files
- be idempotent

### inspect

Submodes:

- `inspect state`
- `inspect gates`
- `inspect last-run`
- `inspect plan`
- `inspect child <name>`
- `inspect repo --prompt "..."`
- `inspect shell <command>` with bounded output

## Acceptance criteria

- operator commands do not require users to understand hidden implementation state
- every diagnosis points to a file, hook entry, run id, or migration action
- `refresh` and `uninstall` preserve user-owned artifacts
- command help is explicit about shipped vs experimental surfaces

## Non-goals

- replacing the language with command workflows
- creating a separate branded runtime
- making tmux or any single host integration mandatory
