# Evaluation: `prompt-language-f7jp.5` Closure Check at `HEAD`

## Status

Assessment note for bead `prompt-language-f7jp.5`.

This note records whether the operator cockpit / richer `watch` / machine-readable
status snapshot slice is materially still open at the current branch tip.

## Verdict

`prompt-language-f7jp.5` is **not materially open as a design decision** at
current `HEAD`.

It **is** still open as an implementation and promotion slice, because the repo
does not yet prove runtime-backed operator snapshots or machine-readable watch
output.

## Evidence at `HEAD`

Positive evidence:

- [operator-cockpit-watch-status-snapshots.md](../design/operator-cockpit-watch-status-snapshots.md)
  is already tracked and defines the accepted design contract
- [index.md](../design/index.md) already points to that canonical design doc
- [cli-reference.md](../reference/cli-reference.md) documents current
  `statusline` and `watch` surfaces

Negative evidence:

- source search at `HEAD` finds `operator-snapshot.v1` in docs, not in tracked
  runtime code
- source search at `HEAD` does not show tracked `watch --json` implementation
- no tracked rollout note or smoke artifact at `HEAD` proves supported-host
  machine-readable operator snapshots for this slice

## Promotion classification

Recommended classification for the bead at current `HEAD`:

- `tracked_internal` for design closure
- not `validated_internal`
- not `shipped_promoted`

## Remaining gap

The remaining work is runtime and evidence work:

- derive one operator snapshot from runtime-owned artifacts
- wire `statusline`, `watch`, and machine-readable output to that shared model
- add degraded-state, child-topology, and recovery-path tests
- capture supported-host smoke evidence for the operator path before promotion
