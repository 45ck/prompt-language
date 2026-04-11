# Design: Operator Shell Lifecycle Hardening

## Status

Accepted design target for the current operator-shell lifecycle milestone.

This note is the closure-ready design boundary for `prompt-language-f7jp.2`. It is not a claim
that current `HEAD` already ships standalone `doctor` and `refresh` commands with full supported
runner parity.

Relevant beads:

- `prompt-language-f7jp.2` - Lifecycle hardening: doctor, refresh, uninstall safety, and diagnostics surface
- `prompt-language-f7jp.3` - Hook manager: ownership metadata, merge-safe install, and uninstall-safe cleanup

Primary planning inputs:

- [Spec 001 — Operator Shell](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/001-operator-shell.md)
- [Spec 002 — Hook Manager](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/002-hook-manager.md)
- [Phased Delivery Roadmap](../wip/reviews/2026-04-11-omx-adaptation-pack/plans/phased-delivery-roadmap.md)

This note defines the additive lifecycle milestone for `doctor`, `refresh`, uninstall safety, and operator-facing diagnostics. It does not expand the runtime boundary already accepted in [Operator Shell Boundary](operator-shell-boundary.md) or the ownership contract already accepted in [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md).

## Decision

prompt-language may harden its operator shell with lifecycle commands that are:

- additive over the existing runtime
- conservative around user-owned host assets
- explicit about degraded or conflicting ownership
- diagnosable through both human-readable and machine-readable output

The lifecycle milestone exists to make install, repair, and removal safer. It does not create a second control plane and does not make host integration state more canonical than runtime artifacts.

## Lifecycle milestone scope

Phase 1 of the operator-shell roadmap covers four linked surfaces:

- `doctor` - read-only validation of managed integrations, lifecycle metadata, runner availability, and stale operator state
- `refresh` - idempotent re-render of prompt-language-managed assets without clobbering user-owned content
- uninstall safety - conservative removal of prompt-language-managed assets only
- diagnostics output - a stable operator-facing report surface for lifecycle state and repair guidance

These surfaces must compose cleanly. `doctor` is the visibility layer, `refresh` is the safe repair path for managed assets, uninstall safety is the safe removal path, and diagnostics is the shared reporting contract used by both.

## Managed vs user-owned assets

Lifecycle hardening depends on a strict ownership boundary.

Managed assets are prompt-language-created or prompt-language-marked artifacts such as:

- prompt-language-managed hook sections or entries in supported runner config
- prompt-language-generated hook files
- prompt-language lifecycle metadata under prompt-language-owned runtime directories
- prompt-language-generated diagnostics snapshots for lifecycle inspection

User-owned assets are preserved by default, including:

- manual hook entries that are not marked as prompt-language-managed
- runner configuration outside prompt-language-managed regions
- unrelated host files adjacent to managed integrations
- ambiguous or partially matching host content whose ownership cannot be proven safely

Unknown or ambiguous state is not treated as managed. It is treated as `conflict` or `user-owned` and surfaced for operator repair.

## Doctor contract

`doctor` is the primary lifecycle inspection surface. It must be read-only and must not silently repair state as a side effect of inspection.

At minimum, `doctor` must validate:

- managed asset presence vs expected install footprint
- ownership metadata readability and schema compatibility
- managed content checksum or render drift where checksums are part of the adapter contract
- duplicate managed entries or duplicate ownership markers
- runner availability and supported adapter status
- parse failures in supported host config formats
- conflicting ownership between prompt-language-managed and user-managed content
- stale or partial lifecycle state that would make `refresh` or uninstall unsafe

`doctor` output must identify concrete evidence, not just categories. Findings should point to a file path, runner target, managed entry identifier, or specific migration / repair action.

## Refresh semantics

`refresh` is a repair and re-render path for managed assets. It is not a blanket reinstall.

Required semantics:

1. Read the current adapter-visible state before writing.
2. Re-render only prompt-language-managed assets for the selected runner or lifecycle target.
3. Preserve user-owned and unknown content by default.
4. Refuse destructive writes when ownership is ambiguous or the adapter cannot merge safely.
5. Update lifecycle metadata only after a successful write and post-write verification.
6. Remain idempotent when run repeatedly against already-healthy managed state.

`refresh` may normalize prompt-language-managed content to the current rendered form, but it must not silently absorb adjacent user changes into managed state. If the adapter cannot distinguish between prompt-language-managed and user-managed content, the command must stop with a conflict diagnosis rather than forcing the rewrite.

## Uninstall safety contract

Uninstall must be stricter than refresh because it removes assets.

Required semantics:

1. Remove only prompt-language-managed entries, sections, files, and metadata.
2. Leave user-owned hook entries and non-prompt-language files intact.
3. Keep partially shared host config files when non-prompt-language content remains.
4. Remove prompt-language lifecycle metadata only when no managed artifacts remain for that target.
5. Prefer visible residual warnings over aggressive cleanup when ownership is unclear.

A full file delete is allowed only when the file is entirely prompt-language-managed or becomes empty after prompt-language-managed content is removed. If operator intervention is needed, uninstall must say so explicitly instead of guessing.

## Diagnostics output contract

Lifecycle hardening needs a stable diagnostics surface that operators can read and tools can consume.

Required output modes:

- human-readable summary for normal terminal use
- machine-readable JSON for automation, snapshotting, and future cockpit integration

Required report content:

- overall status for the inspected lifecycle target
- runner / adapter identity and support level
- ownership state for each managed target
- findings with stable codes or categories
- file paths, entry identifiers, or artifact references where applicable
- recommended next action such as `refresh`, manual repair, reinstall, or safe no-op

Diagnostics must distinguish at least these operator-relevant outcomes:

- healthy managed state
- absent managed state
- degraded state that `refresh` can repair
- conflicting ownership that blocks automatic repair
- unsupported or partial adapter integration

This reporting contract is part of the lifecycle milestone because later watch / cockpit work depends on a dependable diagnostics substrate rather than ad hoc command text.

## Rollout and testing implications

The lifecycle milestone is promotable only when its safety claims are backed by evidence.

Required validation direction:

- adapter-level tests for managed vs user-owned merge behavior
- uninstall tests that prove user-owned content survives removal paths
- doctor tests for missing, stale, conflicting, and unsupported states
- machine-readable diagnostics tests that verify stable report shape
- live smoke tests for install, refresh, doctor, and uninstall flows on supported runners

The [Phased Delivery Roadmap](../wip/reviews/2026-04-11-omx-adaptation-pack/plans/phased-delivery-roadmap.md) sets the promotion rule: this surface should not be described as shipped operator behavior until docs, tests, recovery story, and distinguishable implementation evidence exist together.

## Current repository status

At current `HEAD`, the repo already ships part of the lifecycle story:

- Claude `install`, `status`, and `uninstall` manage the prompt-language cache install, plugin
  registration, marketplace registration, enablement, and prompt-language-owned status-line
  cleanup.
- Codex `codex-install`, `codex-status`, and `codex-uninstall` manage the local scaffold plus the
  prompt-language-managed `codex_hooks` entry with explicit ownership and conflict handling.
- adapter tests already prove key uninstall-safety and ownership-preservation cases for Claude and
  Codex host state

At current `HEAD`, the repo does not yet ship the full milestone described above:

- there is no standalone repo-backed `doctor` command
- there is no explicit `refresh` command exposed as a first-class operator surface
- there is no unified machine-readable lifecycle diagnostics contract spanning install, repair, and
  uninstall across supported runners
- there is not yet promotion evidence for a supported install-refresh-doctor-uninstall lifecycle
  story across runners

That means `prompt-language-f7jp.2` is effectively satisfied as a design-and-scope bead, while the
remaining implementation and promotion work stays open in later operator-shell beads such as
ownership/merge hardening and rollout evidence. This note defines the target boundary those later
slices must meet; it does not say they have all shipped already.

## Explicit out-of-scope boundaries

This lifecycle milestone does not include:

- redefining the runtime or moving source-of-truth state into shell metadata
- broad runner support beyond adapters that can prove merge-safe behavior
- destructive cleanup of user-owned or ambiguous host content
- hidden auto-repair during `doctor`
- a separate operator product or HUD that outranks existing runtime inspection surfaces
- any weakening of hooks, gates, or other enforcement paths for the sake of convenience

## Consequences

What this unblocks:

- a clear acceptance target for `doctor`, `refresh`, uninstall hardening, and diagnostics
- adapter work that can be judged against one lifecycle contract
- later cockpit and recovery work built on top of stable diagnostics

What this constrains:

- lifecycle commands must remain conservative around user-owned state
- adapters must surface conflicts instead of masking them
- shipped docs must not claim uninstall-safe or refresh-safe behavior beyond what supported adapters actually implement
