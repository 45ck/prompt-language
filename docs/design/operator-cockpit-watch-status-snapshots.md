# Design: Operator Cockpit, Watch, and Status Snapshots

## Status

Accepted design target for `prompt-language-f7jp.5`.

This note defines how prompt-language can grow a richer operator cockpit and machine-readable status snapshots **without** introducing a second runtime or shell-only control plane.

## Why this note exists

The imported OMX adaptation work correctly pushes toward a stronger operator surface for long-running flows, but the repo needs one local design note that keeps that work bounded to the existing runtime.

The current repo already has:

- a status line surface
- a `watch` surface
- runtime-owned state files
- a broader operator-shell boundary that rejects hidden orchestration

What is missing is a single contract that says:

- what the richer cockpit actually is
- which CLI surfaces expose it
- what the machine-readable snapshot shape is
- how `watch`, `statusline`, and JSON outputs relate to each other
- how failure, recovery, and rollout should be judged

## Anchors

This note is anchored to the imported operator-cockpit direction requested for:

- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/specs/004-watch-and-statusline.md`
- `plans/evaluation-and-promotion.md`

In this checkout, the corresponding imported material currently lives at:

- [docs/wip/reviews/2026-04-11-omx-adaptation-pack/specs/006-observability-hud.md](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/006-observability-hud.md)
- [docs/wip/reviews/2026-04-11-omx-adaptation-pack/plans/evaluation-and-rollout.md](../wip/reviews/2026-04-11-omx-adaptation-pack/plans/evaluation-and-rollout.md)

This note also composes with:

- [Operator Shell Boundary](operator-shell-boundary.md)
- [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md)

## Decision

prompt-language should expose **one runtime-derived operator snapshot** and allow multiple renderers over that snapshot:

- compact status line rendering
- interactive `watch` rendering
- machine-readable JSON output
- passive log-oriented output for headless debugging

The snapshot is derived from runtime-owned files and metadata. It is not a second runtime, alternate memory model, or hidden shell state.

## Core rule

The operator cockpit is a **projection layer** over the existing runtime.

That means:

- the runtime remains the source of truth for run state, gate state, child topology, checkpoints, and recovery hints
- `statusline` is a compact rendering of that truth
- `watch` is a richer rendering of that truth
- JSON snapshots are a serialized form of that same truth

It must not mean:

- a shell daemon that knows more than the runtime files
- operator-only state that cannot be reconstructed from runtime artifacts
- a second orchestration loop that keeps making decisions outside the flow engine

## Intended operator surface

The richer cockpit should answer the main operator questions quickly:

1. What run is active right now?
2. Where is it stuck or progressing?
3. Which gate or child flow is failing?
4. What recovery action is most likely correct?
5. Which files or artifacts should the operator inspect next?

The cockpit is therefore an **inspection and recovery surface**, not an alternate command language.

## CLI surface

### `statusline`

`statusline` remains the most compact view.

It should continue to show a compressed projection such as:

- run identifier
- active node
- loop progress
- gate summary
- child-flow summary when relevant
- degraded or recovery-needed hint when present

The important constraint is that the status line remains a **lossy projection** of the full snapshot. It is not a separate contract with different truth rules.

### `watch`

`watch` becomes the primary operator cockpit surface.

Expected modes:

- default interactive TUI for active monitoring
- verbose view with child topology, diagnostics, and recovery hints
- one-shot snapshot view for scripts or support workflows
- passive follow mode suitable for headless logs or redirected output

The cockpit should prioritize the following fields:

- active run id
- current node or block
- current phase or lifecycle status
- loop counters
- gate statuses and last failing gate
- last command and exit code when relevant
- pending approvals or blocked checkpoints
- child-flow topology and child states
- last checkpoint or resume marker
- recovery recommendation
- runtime paths such as run manifest, logs, artifacts, and plan files
- adapter or hook health when it affects operator action

### `status`

`status` should remain the higher-level installation and environment probe.

When it exposes run-state information, it should do so by reusing the same snapshot contract rather than inventing a separate diagnostics-only schema.

That allows:

- `status --json` to emit install plus run-state summaries in one predictable contract
- troubleshooting scripts to consume a stable machine-readable surface
- docs and support packs to reference one canonical snapshot shape

### Explicit non-goal for CLI design

The CLI may add flags and renderers, but it should not add a distinct `cockpit` subsystem that becomes more real than `watch`.

The best model is:

- `watch` is the cockpit renderer
- `statusline` is the footer renderer
- JSON is the automation renderer

All three share the same underlying snapshot.

## Snapshot contract

### Canonical object

The operator cockpit should expose one canonical snapshot envelope:

```json
{
  "schemaVersion": "operator-snapshot.v1",
  "generatedAt": "2026-04-11T10:15:30Z",
  "source": {
    "runtimeVersion": "v2",
    "sessionStateCompatible": true
  },
  "run": {
    "id": "run_123",
    "flowPath": "flows/release.flow",
    "status": "running",
    "startedAt": "2026-04-11T10:00:00Z",
    "updatedAt": "2026-04-11T10:15:28Z"
  },
  "node": {
    "id": "gate_deploy",
    "label": "deploy checks",
    "kind": "gate",
    "iteration": 2,
    "maxIterations": 5
  },
  "gates": {
    "summary": {
      "passed": 3,
      "failed": 1,
      "pending": 0
    },
    "lastFailure": {
      "gate": "ci_green",
      "message": "GitHub checks still failing",
      "updatedAt": "2026-04-11T10:14:55Z"
    }
  },
  "children": {
    "total": 2,
    "running": 1,
    "blocked": 1,
    "items": [
      {
        "name": "fix-auth",
        "status": "running",
        "runId": "run_child_a"
      }
    ]
  },
  "recovery": {
    "resumeCommand": "npx @45ck/prompt-language watch --run run_123",
    "lastCheckpoint": "checkpoint_9",
    "orphanedChildren": [],
    "staleLocks": []
  },
  "diagnostics": [
    {
      "severity": "warn",
      "code": "OPC-001",
      "message": "Last gate failure is older than the active child update"
    }
  ],
  "paths": {
    "runDir": ".prompt-language/runs/run_123",
    "manifest": ".prompt-language/runs/run_123/run.json",
    "log": ".prompt-language/runs/run_123/events.jsonl"
  }
}
```

### Required top-level fields

| Field           | Meaning                                           |
| --------------- | ------------------------------------------------- |
| `schemaVersion` | Stable contract version for tooling and tests     |
| `generatedAt`   | Snapshot render time                              |
| `source`        | Runtime compatibility and derivation metadata     |
| `run`           | Current run identity and lifecycle state          |
| `node`          | Current execution focus                           |
| `gates`         | Gate summary and most recent failing detail       |
| `children`      | Child-flow topology summary                       |
| `recovery`      | Resume and repair hints                           |
| `diagnostics`   | Structured operator-facing warnings or blockers   |
| `paths`         | Runtime-owned file paths the operator can inspect |

### Required invariants

- The snapshot is **derived**, not authored manually.
- Every field must be recoverable from runtime-owned artifacts or deterministic derivation rules.
- Missing data must be explicit rather than guessed.
- `statusline` and `watch` may omit fields visually, but the JSON contract remains canonical.
- The contract must remain useful when only legacy `session-state.json` compatibility data exists.

### Status vocabulary

The first snapshot version should keep lifecycle states narrow and inspectable:

- `running`
- `waiting`
- `blocked`
- `failed`
- `completed`
- `interrupted`
- `recoverable`

These are operator-facing lifecycle labels, not new flow semantics.

### Diagnostics vocabulary

Structured diagnostics should cover the operator cases that are slower to localize in raw logs:

- stale or conflicting lock state
- missing or corrupted run metadata
- orphaned child flows
- last failing gate and its age
- recovery artifact mismatch
- hook or adapter degradation when it affects observation or resume

The cockpit should surface these as structured diagnostics first and styled rendering second.

## Relationship to `statusline` and `watch`

### Shared model

`statusline`, `watch`, and JSON snapshots are three views over one model.

That model should be produced once per render cycle and reused across surfaces. The point is not just code reuse. It is contract honesty:

- if the TUI says a child is blocked, the JSON should say the same thing
- if the status line says a gate is failing, the TUI should localize the same gate
- if recovery hints change, every surface should pick up the same recommendation

### Different fidelity, same truth

The surfaces intentionally differ by density:

- `statusline`: tiny, easy to scan, lossy
- `watch`: interactive, contextual, recovery-oriented
- JSON: stable, tool-friendly, diffable

That difference is acceptable because fidelity differs, not authority.

### No second runtime

This is the most important boundary for `prompt-language-f7jp.5`.

The operator cockpit does **not**:

- schedule work
- resume work on its own
- coordinate children outside the runtime
- track hidden progress that cannot be reconstructed later

It only renders and serializes runtime state.

## Failure and debug use cases

The cockpit must help with the failures that currently force operators into raw file and log spelunking.

### 1. Last failing gate localization

When a run is blocked on a gate, the cockpit should show:

- which gate failed
- when it last failed
- what command or check fed that result
- which path or artifact to inspect next

### 2. Interrupted-run recovery

When the host session dies or the operator reconnects, the cockpit should show:

- whether the run is resumable
- the last checkpoint or durable marker
- whether any child flows appear orphaned
- the recommended resume command

### 3. Child-topology debugging

For multi-agent or spawned-child flows, the cockpit should answer:

- which children exist
- which are running, blocked, failed, or completed
- which child most recently changed state
- whether parent progress is blocked on a child await

### 4. Corrupted or partial runtime state

When manifests, logs, or session-state compatibility files disagree, the cockpit should fail visibly rather than pretending certainty.

Expected behavior:

- emit structured diagnostics
- mark inferred or unavailable fields explicitly
- preserve enough path information for manual repair

### 5. Headless and support-pack capture

The machine-readable snapshot should be usable in:

- CI repro capture
- support issue templates
- promotion evidence packs
- regression investigations after a failed run

That is why JSON must be a first-class contract rather than an afterthought bolted onto the TUI.

## Testing and rollout implications

This work should be promoted only as the imported rollout plan earns it.

### Pre-promotion checks

Before this surface is described as shipped behavior, the repo should have:

- unit tests for snapshot derivation from runtime artifacts
- renderer tests for compact and verbose watch/status projections
- interrupted-run recovery tests
- corrupted-state diagnostics tests
- docs that explain the relationship between `watch`, `statusline`, and JSON outputs honestly

### Useful test layers

The test mix should be:

- fixture-driven derivation tests for canonical snapshot JSON
- snapshot tests for watch and statusline renderers
- integration tests for resumed runs and child-topology rendering
- smoke coverage for the operator path from install -> run -> watch -> diagnose -> recover when the underlying shell slices are ready

### Promotion criteria

This slice is promoted when operators can reliably:

- identify the current run and node quickly
- localize the last failing gate faster than by reading raw logs
- understand child topology during supervision
- recover interrupted runs using visible hints rather than internal knowledge
- consume the same truth in human and machine-readable form

### Rollout constraint

The repo must not claim a richer cockpit in shipped CLI docs until the snapshot contract and renderer behavior are tested and wired into the actual surfaces.

Imported pack language remains planning input until that happens.

## Consequences

What this unblocks:

- a sharper watch surface without reopening runtime semantics
- one canonical JSON status contract for tools and support workflows
- better failure localization and recovery guidance
- later rollout evidence for `prompt-language-f7jp.9`

What this constrains:

- no cockpit daemon or shell memory layer
- no renderer-specific truth divergence
- no feature marketing that outruns tested runtime derivation

## Bead status

This bead appears **closable at the design-note level** once this file is accepted as the local contract for `prompt-language-f7jp.5`.

It does **not** imply the implementation is fully closable yet. Actual closure still depends on shipped CLI wiring, snapshot derivation, renderer coverage, and rollout evidence.

Changed files:

- `docs/design/operator-cockpit-watch-status-snapshots.md`
