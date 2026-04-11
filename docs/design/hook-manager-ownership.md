# Design: Hook Manager Ownership and Lifecycle

## Status

Accepted design target for the current operator-shell lifecycle hardening work.

Relevant beads:

- `prompt-language-f7jp.2` - Lifecycle hardening: doctor, refresh, uninstall safety, and diagnostics surface
- `prompt-language-f7jp.3` - Hook manager: ownership metadata, merge-safe install, and uninstall-safe cleanup

## Decision

prompt-language manages host hook surfaces through **runner-specific adapters** that preserve a strict ownership boundary:

- prompt-language may create, refresh, or remove only **prompt-language-managed** hook content
- user-owned or unknown hook content is preserved by default
- ambiguous ownership is treated as a conflict and surfaced for operator repair rather than silently rewritten

This keeps hook lifecycle safety inside the operator shell while respecting the [Host Extension Boundary](host-extension-boundary.md) and the [Operator Shell Boundary](operator-shell-boundary.md).

## Why this needs a first-class design

The repo already treats hook integrity as part of the enforcement engine. A naive installer that rewrites host hook config wholesale would create two classes of failure:

- it could weaken or remove user-managed host automation
- it could leave prompt-language unable to uninstall or refresh its own entries safely

The design therefore needs an explicit contract for ownership, merge behavior, and conservative cleanup.

## Ownership model

Hook state is evaluated as one of four ownership snapshots:

- `absent` - no prompt-language-managed hook content is present
- `managed` - the relevant hook entries are present and clearly marked as prompt-language-owned
- `user-owned` - matching hook slots are present but are not marked as prompt-language-owned
- `conflict` - ownership is ambiguous, duplicated, malformed, or otherwise unsafe to mutate automatically

The canonical metadata model for managed installs is:

- runner identifier
- host config path or target file
- managed file paths and managed entry identifiers
- install timestamp
- prompt-language version
- migration version
- rendered checksum for the managed content

That metadata belongs under a prompt-language-owned runtime area such as `.prompt-language/hooks/ownership.json`, not inside the DSL surface.

## Install and refresh contract

Install and refresh must be **merge-safe**.

Required behavior:

1. Read and parse the current host hook config through the runner adapter.
2. Preserve unknown or user-owned entries by default.
3. Replace or re-render only prompt-language-managed entries.
4. Record or update ownership metadata after a successful write.
5. Verify the post-write snapshot instead of assuming the merge succeeded.

Important constraint:

Merge-safe does not always mean "append another entry." Some host surfaces allow multiple neighboring hooks; others expose singleton keys or mutually exclusive slots. When the adapter cannot add prompt-language-managed content without overwriting user-managed content, it must report `conflict` and stop rather than forcing the write.

## Uninstall-safe cleanup contract

Uninstall must be conservative.

Required behavior:

1. Remove only prompt-language-managed entries or files.
2. Leave user-owned hooks intact.
3. Keep the host hook file when non-prompt-language content remains.
4. Remove prompt-language ownership metadata only when no managed artifacts remain.
5. Prefer a visible warning over aggressive cleanup when ownership is unclear.

The uninstall path is allowed to fully remove a generated hook file only when that file is wholly prompt-language-managed or becomes empty after managed content is removed.

## Doctor and diagnostics contract

Lifecycle safety depends on a readable diagnostics surface. `doctor` or equivalent lifecycle checks must be able to report at least:

- missing hook files
- parse failures
- duplicated managed entries
- stale or mismatched ownership checksums
- conflicting ownership
- unsupported or partial runner integration

Conflict detection is part of the safety model, not a secondary UX improvement.

## Current repository status

This note is the accepted target contract for lifecycle hardening. It should not be read as a claim that every current install or uninstall path already satisfies it.

As of April 11, 2026:

- the repo already has installed hook surfaces and host-specific installer code
- the imported OMX spec defines the target ownership model in WIP form
- the current branch contains an initial Codex ownership helper, but the full install / refresh / uninstall flow has not yet been uniformly promoted to this contract

That remaining work stays tracked under `prompt-language-f7jp.2` and `prompt-language-f7jp.3`.

## Consequences

What this unblocks:

- one canonical design reference for hook ownership decisions
- later smoke tests for install, refresh, uninstall, and conflict handling
- host-specific adapter work that stays aligned to one ownership contract

What this constrains:

- user-facing docs should not claim merge-safe or uninstall-safe behavior beyond what the active adapters actually implement
- installers must not overwrite ambiguous host hook state just to appear convenient
- hook lifecycle work remains an operator-shell concern, not a new prompt-language syntax feature
