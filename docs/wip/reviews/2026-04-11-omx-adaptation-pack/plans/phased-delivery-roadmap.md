# Phased Delivery Roadmap

## Phase 0 — Planning landing

Deliver:

- imported review pack
- review-index update
- issue templates
- backlog seeds

Exit criteria:

- the plan is landable in-repo without polluting shipped docs
- maintainers can open implementation slices directly from the pack

## Phase 1 — Hook manager and doctor

Deliver:

- ownership model
- `doctor`
- `refresh`
- uninstall hardening
- machine-readable diagnostics

Exit criteria:

- user-owned hooks survive refresh / uninstall
- doctor can identify stale, missing, or conflicting hook state

## Phase 2 — Run-state directory v2

Deliver:

- richer `.prompt-language/` layout
- migration path
- recovery artifacts
- retention / cleanup policy

Exit criteria:

- existing state remains compatible
- recovery is materially easier after interrupted runs

## Phase 3 — Operator cockpit

Deliver:

- `watch` upgrade
- stronger statusline summaries
- gate / child / recovery panels
- diagnostic snapshots

Exit criteria:

- long-running flows are inspectable without raw log-diving

## Phase 4 — Workflow alias lowering + scaffolding

Deliver:

- inspectable canonical workflow aliases
- AGENTS / library / gate scaffolding
- rendered / compiled flow preview

Exit criteria:

- new users get OMX-like onboarding clarity without changing the language's center

## Phase 5 — Team supervisor

Deliver:

- team lifecycle commands
- child-topology persistence
- resume / stop / doctor
- optional worktree adapter spike

Exit criteria:

- team supervision is robust and inspectable
- no semantic conflict with the swarm direction

## Promotion rule

No phase may be promoted into README-level “shipped” messaging until:

- docs exist
- tests exist
- recovery story exists
- the surface is distinguishable from imported planning material
