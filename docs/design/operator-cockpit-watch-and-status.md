# Design: Operator Cockpit Closure Assessment

## Status

Assessment note for bead `prompt-language-f7jp.5`.

The canonical accepted design for this bead is already tracked at
[operator-cockpit-watch-status-snapshots.md](operator-cockpit-watch-status-snapshots.md).
This companion note exists only to make the current `HEAD` closure posture
explicit and to avoid over-reading the bead as shipped runtime behavior.

## Verdict at `HEAD`

`prompt-language-f7jp.5` is **materially closed at the design tier** and
**materially open at the rollout tier**.

What is already true at `HEAD`:

- the canonical design note for a runtime-derived operator snapshot exists
- the design index already points to that canonical note
- the CLI reference documents existing human-facing `statusline` and `watch`
  surfaces

What is **not** yet proven at `HEAD`:

- no tracked runtime implementation in `src/` for `operator-snapshot.v1`
- no tracked `watch --json` support
- no tracked shared snapshot derivation layer that clearly feeds `statusline`,
  `watch`, and machine-readable output from one model
- no tracked rollout evidence showing real operator snapshots or supported-host
  smoke for this slice

## Evidence basis

This assessment is grounded in repo-local evidence:

- [operator-cockpit-watch-status-snapshots.md](operator-cockpit-watch-status-snapshots.md)
  defines the accepted contract
- [index.md](index.md) already treats that file as the canonical design doc
- [cli-reference.md](../reference/cli-reference.md) documents `statusline` and
  `watch` as current operator surfaces
- source search at `HEAD` finds the snapshot contract string only in docs, not
  in shipped runtime code

That means the bead should stay understood as:

- closed as a design decision
- not yet promotable as a shipped machine-readable cockpit feature

## Promotion reading

The safe promotion tier for this slice at current `HEAD` is
`tracked_internal`.

It is **not** yet safe to describe the richer cockpit as
`validated_internal` or `shipped_promoted`, because the repo still lacks the
runtime-backed evidence the accepted design requires.

## Remaining rollout gap

The remaining work is not another design note. It is implementation and
evidence:

- snapshot derivation over runtime-owned artifacts
- shared wiring for `statusline`, `watch`, and machine-readable output
- tests for degraded state, child topology, and recovery hints
- supported-host smoke evidence for the real operator path

## Relationship to the canonical design note

Use [operator-cockpit-watch-status-snapshots.md](operator-cockpit-watch-status-snapshots.md)
for the actual design contract.

Use this file only when auditing whether `prompt-language-f7jp.5` is still open
at the current branch tip.
