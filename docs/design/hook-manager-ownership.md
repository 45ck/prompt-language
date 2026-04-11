# Design: Hook Manager Ownership and Lifecycle

## Status

Accepted design target for the current operator-shell lifecycle hardening work.

Relevant beads:

- `prompt-language-f7jp.2` - Lifecycle hardening: doctor, refresh, uninstall safety, and diagnostics surface
- `prompt-language-f7jp.3` - Hook manager: ownership metadata, merge-safe install, and uninstall-safe cleanup

## Decision

prompt-language manages host hook surfaces through runner-specific adapters with a strict ownership boundary:

- prompt-language may create, refresh, or remove only prompt-language-managed assets
- user-owned or unknown host config must be preserved by default
- ambiguous ownership is a conflict and must stop automatic mutation

In this repo, ownership is not modeled as one abstract ledger only. It is split across the concrete surfaces the installers already mutate:

- host plugin registration in `installed_plugins.json`
- host enablement and marketplace registration in `settings.json`
- prompt-language-owned packaged hook assets under the installed cache root
- runner-specific inline markers when a host config file needs a prompt-language-managed entry

This keeps lifecycle safety inside the operator shell while respecting the [Host Extension Boundary](host-extension-boundary.md) and the [Operator Shell Boundary](operator-shell-boundary.md).

## Why this needs a first-class design

The repo already treats hook integrity as part of the enforcement engine. A naive installer that rewrites host hook config wholesale would create two classes of failure:

- it could weaken or remove user-managed host automation
- it could leave prompt-language unable to refresh or uninstall its own entries safely

The design therefore needs an explicit contract for:

- what prompt-language owns on each runner
- how install and refresh merge with existing host state
- how uninstall removes only prompt-language-managed artifacts

## Ownership model

Hook state is evaluated as one of four ownership snapshots when the runner exposes a shared config surface:

- `absent` - no prompt-language-managed hook content is present
- `managed` - the relevant hook entries are present and clearly marked as prompt-language-owned
- `user-owned` - matching hook slots are present but are not marked as prompt-language-owned
- `conflict` - ownership is ambiguous, duplicated, malformed, or otherwise unsafe to mutate automatically

That snapshot model already exists in the Codex adapter for `codex_hooks`.

For this repo, ownership is concrete per runner:

### Claude ownership

Claude install does not merge individual hook entries into a user-edited hook manifest. Instead, `bin/cli.mjs install`:

- copies the packaged runtime, including [hooks/hooks.json](/D:/Visual%20Studio%20Projects/prompt-language/hooks/hooks.json), into the prompt-language cache install root
- registers `prompt-language@prompt-language-local` in `.claude/plugins/installed_plugins.json`
- registers `prompt-language-local` in `.claude/settings.json.extraKnownMarketplaces`
- enables the plugin in `.claude/settings.json.enabledPlugins`
- may set `settings.statusLine` only when configuring the prompt-language statusline script

Claude hook ownership is therefore package-root ownership, not inline ownership inside a host hook file:

- prompt-language owns the copied files under its install root
- prompt-language owns only its own plugin registry row, marketplace row, enablement flag, and statusline entry when that entry points at prompt-language
- prompt-language does not own unrelated Claude settings or any user-managed plugin rows

### Codex ownership

Codex install has both package ownership and shared-config ownership:

- package ownership is the copied scaffold under the Codex cache install root plus the prompt-language plugin registry and enablement rows
- shared-config ownership is the `codex_hooks` entry in `.codex/config.toml`

The Codex adapter makes ownership explicit with inline markers:

- section marker: `# prompt-language managed section: codex_hooks`
- entry marker: `# prompt-language managed: codex_hooks`

That marker is the current canonical ownership metadata for the Codex hook toggle. A plain `codex_hooks = true` or `false` without the marker is user-owned and must be preserved.

## Ownership metadata contract

The repo should treat ownership metadata as layered rather than forcing everything into `.prompt-language/hooks/ownership.json`.

Today, the concrete ownership sources are:

- host-native registry metadata in `installed_plugins.json` and `settings.json`
- prompt-language-owned install roots under the cache directories
- inline managed markers for Codex `config.toml`

If a later lifecycle milestone adds a prompt-language-owned ledger such as `.prompt-language/hooks/ownership.json`, it should be derivative metadata used for diagnostics and repair, not the sole source of truth. The ledger must not claim ownership that is not also visible in a host-native surface or prompt-language-owned file tree.

Minimum metadata fields for any future derived ledger remain:

- runner identifier
- host config path or target file
- managed file paths and managed entry identifiers
- install timestamp
- prompt-language version
- migration version
- rendered checksum for managed content

## Install and refresh contract

Install and refresh must be merge-safe, but "merge-safe" differs by runner.

### Common requirements

Required behavior:

1. Detect the runner-specific ownership surface before writing.
2. Preserve unknown or user-owned host state by default.
3. Update only prompt-language-managed rows, entries, or files.
4. Verify the post-write snapshot instead of assuming the write succeeded.
5. Surface `conflict` rather than forcing an overwrite.

### Claude install and refresh

For Claude, merge-safe behavior means:

1. Copy prompt-language-owned files only into the prompt-language cache root.
2. Upsert only the prompt-language plugin key in `.claude/plugins/installed_plugins.json`.
3. Upsert only the prompt-language marketplace and enablement keys in `.claude/settings.json`.
4. Preserve unrelated settings and plugin registrations.
5. Only remove or replace `statusLine` when it points at a prompt-language script path.

Claude does not currently need per-hook merge logic because the hook manifest is shipped inside the installed plugin package. The managed boundary is the package root plus the prompt-language-owned registry keys.

### Codex install and refresh

For Codex, merge-safe behavior means:

1. Copy prompt-language-owned scaffold files into the Codex cache root.
2. Upsert only the prompt-language plugin key in `.codex/plugins/installed_plugins.json`.
3. Upsert only the prompt-language marketplace and enablement keys in `.codex/settings.json`.
4. Inspect `.codex/config.toml` before mutation.
5. Create a managed `codex_hooks` entry only when none exists.
6. Re-enable an existing managed `codex_hooks` entry when refreshing.
7. Preserve a user-owned `codex_hooks` entry unchanged.
8. Return `conflict` and leave the file unchanged when duplicate, stray, or ambiguous `codex_hooks` entries exist.

The current adapter already treats `codex_hooks` outside `[features]`, duplicate entries, or mixed managed and unmanaged entries as `conflict`.

## Uninstall-safe cleanup contract

Uninstall must be stricter than install because it removes assets.

Required behavior:

1. Remove only prompt-language-managed files, registry rows, and managed config entries.
2. Leave user-owned settings, plugin rows, and hook entries intact.
3. Keep a host config file when non-prompt-language content remains.
4. Remove prompt-language-owned generated files only from the prompt-language install root.
5. Prefer a visible warning over aggressive cleanup when ownership is unclear.

### Claude uninstall

For Claude, uninstall-safe cleanup means:

- remove the prompt-language cache directory
- remove only the `prompt-language@prompt-language-local` row from `.claude/plugins/installed_plugins.json`
- remove only the `prompt-language-local` marketplace row and prompt-language enablement flag from `.claude/settings.json`
- remove `statusLine` only when its command still points at prompt-language
- leave all other settings and plugin registrations intact

### Codex uninstall

For Codex, uninstall-safe cleanup means:

- remove the prompt-language Codex cache directory
- remove only the prompt-language plugin row and marketplace/enablement settings
- remove `codex_hooks` from `.codex/config.toml` only when the managed marker is present
- clean up the prompt-language-managed section comment and empty `[features]` section only when they become empty after managed removal
- preserve user-owned `codex_hooks` settings unchanged
- preserve the config file unchanged on `conflict`

An uninstall path may reduce a prompt-language-created `config.toml` to an empty file. That is still considered safe because the file was fully prompt-language-managed in that scenario.

## Doctor and diagnostics contract

Lifecycle safety depends on a readable diagnostics surface. `doctor` or equivalent lifecycle checks must be able to report at least:

- missing install roots
- missing registry rows relative to copied assets
- parse failures in shared config files
- duplicated managed entries
- stale or mismatched rendered checksums if a derived ownership ledger is added
- conflicting ownership
- unsupported or partial runner integration

Conflict detection is part of the safety model, not a secondary UX improvement.

## Current repository status

This note is the accepted target contract for lifecycle hardening. It should not be read as a claim that every lifecycle path is already fully normalized under one shared hook manager abstraction.

As of April 11, 2026:

- Claude install and uninstall already behave as scoped registry and package-root mutations, with tests that preserve unrelated settings across repeated install runs
- Codex install and uninstall already implement explicit ownership snapshots for `codex_hooks` and preserve user-owned entries or conflicting files unchanged
- the repo does not yet persist a separate prompt-language-owned hook ownership ledger under `.prompt-language/hooks/ownership.json`
- the current hook manager design should therefore treat host-native metadata and inline markers as canonical until a derived ledger is actually implemented

That remaining promotion work stays tracked under `prompt-language-f7jp.2` and `prompt-language-f7jp.3`.

## Consequences

What this unblocks:

- one canonical design reference for hook ownership decisions in this repo
- clear acceptance criteria for Claude package-root ownership versus Codex shared-config ownership
- later smoke tests for install, refresh, uninstall, and conflict handling

What this constrains:

- docs must not imply a single existing ownership ledger when the repo currently uses host-native rows and inline markers
- installers must not overwrite ambiguous host hook state just to appear convenient
- hook lifecycle work remains an operator-shell concern, not a new prompt-language syntax feature
- any future ownership ledger must reconcile with the host-native source of truth instead of replacing it by assumption
