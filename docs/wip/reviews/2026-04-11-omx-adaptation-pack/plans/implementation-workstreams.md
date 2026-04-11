# Implementation Workstreams

## WS1 — CLI and operator commands

Likely repo touchpoints:

- `src/`
- `commands/`
- CLI docs
- tests

Deliverables:

- `doctor`
- `refresh`
- `inspect`
- team lifecycle summaries

## WS2 — Hook ownership and adapters

Likely touchpoints:

- `hooks/`
- `src/`
- install / uninstall flows
- diagnostics

Deliverables:

- ownership metadata
- merge-safe writes
- uninstall preservation
- adapter diagnostics

## WS3 — Runtime state layout and recovery

Likely touchpoints:

- `src/`
- docs
- test fixtures

Deliverables:

- `runs/<run-id>/...`
- migration layer
- checkpoint / recovery artifacts

## WS4 — Observability

Likely touchpoints:

- `src/`
- statusline logic
- `watch`
- docs

Deliverables:

- cockpit views
- recovery hints
- machine-readable snapshots

## WS5 — Workflow aliasing and scaffolding

Likely touchpoints:

- `commands/`
- templates
- docs
- examples

Deliverables:

- rendered aliases
- AGENTS / library scaffolds
- inspectable generated flows

## WS6 — Team supervision

Likely touchpoints:

- spawn / await supervision state
- docs/wip alignment
- recovery integration

Deliverables:

- topology store
- status / resume / stop
- optional worktree adapter spike

## WS7 — Docs integrity and promotion

Likely touchpoints:

- `README.md`
- `docs/roadmap.md`
- `docs/wip/`
- troubleshooting

Deliverables:

- clean promotion path from imported pack -> tracked roadmap -> shipped docs
