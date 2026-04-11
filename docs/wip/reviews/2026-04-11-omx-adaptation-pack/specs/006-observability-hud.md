# Spec 006 — Observability / Operator Cockpit

## Goal

Extend the existing statusline + `watch` into a richer cockpit for long-running supervised flows.

## Why not a separate HUD product

prompt-language already has operator surfaces for statusline and `watch`. The right move is to deepen those, not split the product into a separate shell UI.

## Required panels / fields

- active run id
- current node / block
- loop counters
- gate status and last failure
- last command and exit code
- pending approval checkpoints
- child-flow topology
- recovery hints
- hook / adapter health
- artifact / plan paths

## Modes

- compact TUI
- verbose TUI
- machine-readable snapshot
- passive watch mode for CI / headless logs

## Recovery integration

The cockpit should make interruption legible:

- show orphaned child flows
- stale lock hints
- last checkpoint
- recommended resume command

## Acceptance criteria

- cockpit state is derived from runtime files, not hidden memory
- it remains useful without tmux
- it continues to work when a run is resumed
- it helps operators localize failures faster than reading raw logs
