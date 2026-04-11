# Design: Hook Manager Ownership and Lifecycle

## Status

Accepted design target for the current operator-shell lifecycle hardening work.

Relevant beads:

- `prompt-language-f7jp.2` - Lifecycle hardening: doctor, refresh, uninstall safety, and diagnostics surface
- `prompt-language-f7jp.3` - Hook manager: ownership metadata, merge-safe install, and uninstall-safe cleanup

## Scope

This note is intentionally narrow. It defines how the repo's installer and uninstall flows may mutate host hook surfaces for Claude Code and Codex CLI.

It does not define:

- DSL syntax
- runtime hook behavior inside `dist/presentation/hooks/*`
- a new cross-runner persistence format beyond what the repo already writes today

## Decision

prompt-language owns only the hook assets and host settings entries that it can identify as prompt-language-managed from repo-specific evidence.

Automatic lifecycle commands may:

- create prompt-language-owned cache content
- add or refresh prompt-language-owned registry rows and settings keys
- enable or disable a prompt-language-managed Codex `codex_hooks` feature toggle
- remove only prompt-language-managed content during uninstall

Automatic lifecycle commands may not:

- rewrite unrelated host hook files wholesale
- remove user-authored plugin registrations or settings
- take ownership of an existing host hook toggle unless prompt-language metadata is already present
- guess through ambiguous ownership; ambiguity is a conflict and stops mutation of that surface

## Canonical ownership surfaces in this repo

The repo does not currently use one global ownership ledger. Ownership is derived from the actual host surfaces that `bin/cli.mjs` and the Codex installer adapter mutate.

### Claude Code surfaces

Claude install and uninstall mutate these exact surfaces:

- install root: `~/.claude/plugins/cache/prompt-language-local/prompt-language/<version>`
- plugin registry: `~/.claude/plugins/installed_plugins.json`
- settings: `~/.claude/settings.json`
- legacy cleanup targets: `~/.claude/plugins/local/prompt-language` and `~/.claude/plugins/local/.claude-plugin`

The install root is populated from these repo directories:

- `dist/`
- `hooks/`
- `skills/`
- `commands/`
- `agents/`
- `.claude-plugin/`
- `bin/`

Claude hook ownership is package-root ownership. The authoritative hook manifest is the copied [hooks/hooks.json](/D:/Visual%20Studio%20Projects/prompt-language/hooks/hooks.json) inside the installed cache root. prompt-language does not merge hook entries into a user-managed Claude hook file under `~/.claude`.

### Codex CLI surfaces

Codex install and uninstall mutate these exact surfaces:

- install root: `~/.codex/plugins/cache/prompt-language-local/prompt-language/<version>`
- plugin registry: `~/.codex/plugins/installed_plugins.json`
- settings: `~/.codex/settings.json`
- host feature toggle: `~/.codex/config.toml`
- legacy cleanup targets: `~/.codex/plugins/local/prompt-language` and `~/.codex/plugins/local/.codex-plugin`

The install root is populated from these repo directories:

- `dist/`
- `skills/`
- `agents/`
- `.codex-plugin/`
- `.agents/`
- `.codex/`
- `bin/`

The copied `.codex/hooks.json` under the install root is prompt-language-owned package content. It is not enough by itself to activate host hooks. Activation is controlled separately by the host file `~/.codex/config.toml`.

## Ownership metadata contract

Ownership metadata is runner-specific and already exists in concrete repo behavior.

### Claude ownership metadata

For Claude, prompt-language ownership is inferred from:

- the plugin key `prompt-language@prompt-language-local` in `installed_plugins.json`
- the marketplace key `prompt-language-local` in `settings.json.extraKnownMarketplaces`
- the enabled flag `settings.json.enabledPlugins["prompt-language@prompt-language-local"]`
- the installed cache root under `~/.claude/plugins/cache/prompt-language-local/`
- the `settings.json.statusLine` command when that command string contains `prompt-language`

Claude does not currently stamp inline ownership markers into a shared host hook file. Ownership is the combination of prompt-language's own cache tree plus prompt-language-specific host registry keys.

The current status-line ownership heuristic is exact to the repo, not an idealized future rule:

- install auto-configures `statusLine` only when it is absent or already points at a command containing `prompt-language`
- uninstall removes `statusLine` only when its command string still contains `prompt-language`

That means status-line ownership is currently heuristic by command string, not backed by a separate metadata record.

### Codex ownership metadata

For Codex, ownership is derived from both host registry rows and an inline marker in `~/.codex/config.toml`.

The current canonical marker strings are:

- section marker: `# prompt-language managed section: codex_hooks`
- entry marker: `# prompt-language managed: codex_hooks`
- managed line: `codex_hooks = true # prompt-language managed: codex_hooks`

The managed scaffold created by `createManagedCodexHooksConfig()` is:

```toml
# prompt-language Codex scaffold.
# Codex hooks are experimental; opt in explicitly before using the local install.

# prompt-language managed section: codex_hooks
[features]
codex_hooks = true # prompt-language managed: codex_hooks
```

The ownership snapshots implemented in `src/infrastructure/adapters/codex-hooks-config.ts` are:

- `absent`
- `managed`
- `user-owned`
- `conflict`

Their repo-specific meanings are:

- `absent`: no `codex_hooks` entry exists in `[features]`
- `managed`: exactly one `[features].codex_hooks` entry exists and its inline comment contains `prompt-language managed: codex_hooks`
- `user-owned`: exactly one `[features].codex_hooks` entry exists and it has no prompt-language marker
- `conflict`: any duplicate, mixed managed and unmanaged, or out-of-section `codex_hooks` entry exists

A plain `codex_hooks = true` or `codex_hooks = false` without the marker is user-owned and must remain user-owned.

### No global ledger yet

There is no current `.prompt-language/hooks/ownership.json` or equivalent shared ledger.

If the repo later adds one, it must be treated as derived diagnostics metadata only. It must reconcile with the real host surfaces above and may not invent ownership that is not visible in:

- the cache install root
- the plugin registry rows
- the marketplace and enabled settings entries
- the managed Codex inline markers

## Merge-safe install and refresh semantics

Merge-safe in this repo means "upsert prompt-language-owned entries only, preserve everything else, and leave ambiguous surfaces unchanged."

### Common rules

All install and refresh paths must:

1. Read the existing host surface before mutation.
2. Mutate only prompt-language-owned files, keys, or marked entries.
3. Preserve unrelated JSON keys, TOML entries, and plugin registrations.
4. Recompute ownership after writing rather than assuming the write succeeded.
5. Warn and leave the shared surface unchanged on `conflict`.

### Claude install and refresh

Claude install in `bin/cli.mjs install` is merge-safe in this exact way:

1. Remove only the legacy local install paths from the pre-cache layout.
2. Copy prompt-language package content into `~/.claude/plugins/cache/prompt-language-local/prompt-language/<version>`.
3. Generate `~/.claude/plugins/cache/prompt-language-local/.claude-plugin/marketplace.json`.
4. Upsert only `installed_plugins.json.plugins["prompt-language@prompt-language-local"]`.
5. Upsert only `settings.json.extraKnownMarketplaces["prompt-language-local"]`.
6. Upsert only `settings.json.enabledPlugins["prompt-language@prompt-language-local"] = true`.
7. Preserve all unrelated settings and plugin rows.
8. Auto-configure `settings.json.statusLine` only when there is no existing status line or the existing command already contains `prompt-language`.

Claude refresh is effectively a reinstall of prompt-language-owned cache content plus prompt-language-owned registry keys. There is no Claude per-hook merge algorithm because the Claude hook manifest is shipped inside the plugin package rather than merged into a shared home-directory hook manifest.

### Codex install and refresh

Codex install in `bin/cli.mjs codex-install` plus `enableManagedCodexHooksFile()` is merge-safe in this exact way:

1. Remove only the legacy local Codex install paths from the pre-cache layout.
2. Copy prompt-language package content into `~/.codex/plugins/cache/prompt-language-local/prompt-language/<version>`.
3. Upsert only `installed_plugins.json.plugins["prompt-language@prompt-language-local"]`.
4. Upsert only `settings.json.extraKnownMarketplaces["prompt-language-local"]`.
5. Upsert only `settings.json.enabledPlugins["prompt-language@prompt-language-local"] = true`.
6. Inspect `~/.codex/config.toml` before mutation.
7. If `config.toml` is missing, create a prompt-language-managed scaffold with the managed section marker and managed `codex_hooks` line.
8. If `[features]` exists and no `codex_hooks` entry exists, insert only the managed `codex_hooks` line into `[features]` without crossing into the next section.
9. If a managed `codex_hooks = false` exists, rewrite only that line back to the managed `true` form.
10. If a user-owned `codex_hooks` entry exists, preserve it unchanged and do not add a second entry.
11. If duplicate, mixed, or out-of-section `codex_hooks` entries exist, return `conflict`, warn, and leave `config.toml` unchanged.

The note must be read against the adapter implementation, not against a generic TOML merge promise. The current merge boundary is one feature flag entry in one host file.

## Uninstall-safe cleanup semantics

Uninstall is stricter than install. The repo must prefer an obvious leftover over deleting content it cannot prove it owns.

### Common rules

Uninstall may remove:

- prompt-language cache directories
- prompt-language registry rows
- prompt-language marketplace and enablement keys
- prompt-language-managed status-line configuration
- prompt-language-managed `codex_hooks` entries and prompt-language scaffold comments

Uninstall may not remove:

- unrelated plugin rows
- unrelated settings keys
- unmarked `codex_hooks` entries
- any shared config surface whose ownership is `conflict`

### Claude uninstall

Claude uninstall in `bin/cli.mjs uninstall` currently does this:

1. Remove `~/.claude/plugins/cache/prompt-language-local`.
2. Remove the legacy local Claude install paths if present.
3. Delete only `installed_plugins.json.plugins["prompt-language@prompt-language-local"]`.
4. Delete only `settings.json.enabledPlugins["prompt-language@prompt-language-local"]`.
5. Delete only `settings.json.extraKnownMarketplaces["prompt-language-local"]`.
6. Delete `settings.json.statusLine` only when `statusLine.command` still contains `prompt-language`.
7. Preserve the rest of `settings.json` and `installed_plugins.json`.

### Codex uninstall

Codex uninstall in `bin/cli.mjs codex-uninstall` plus `disableManagedCodexHooksFile()` currently does this:

1. Remove `~/.codex/plugins/cache/prompt-language-local`.
2. Remove the legacy local Codex install paths if present.
3. Delete only `installed_plugins.json.plugins["prompt-language@prompt-language-local"]`.
4. Delete only `settings.json.enabledPlugins["prompt-language@prompt-language-local"]`.
5. Delete only `settings.json.extraKnownMarketplaces["prompt-language-local"]`.
6. Inspect `~/.codex/config.toml` ownership before changing it.
7. Remove the `codex_hooks` line only when the managed marker is present.
8. Remove the section marker comment `# prompt-language managed section: codex_hooks`.
9. Remove scaffold header lines created by prompt-language when they are otherwise stale.
10. Remove the `[features]` section only when it becomes empty after managed cleanup.
11. Preserve user-owned `codex_hooks` entries unchanged.
12. Preserve the file unchanged on `conflict`.

The current cleanup helpers also normalize whitespace:

- trim leading empty lines after removing prompt-language-owned scaffold comments
- trim trailing empty lines
- allow the resulting file to become empty when prompt-language created the whole scaffold

An empty `~/.codex/config.toml` after uninstall is therefore currently considered safe and expected in the fully prompt-language-managed case.

## Current implementation evidence

This note is grounded in current repo behavior, not aspirational architecture alone.

Primary implementation files:

- [bin/cli.mjs](/D:/Visual%20Studio%20Projects/prompt-language/bin/cli.mjs)
- [src/infrastructure/adapters/codex-installer.ts](/D:/Visual%20Studio%20Projects/prompt-language/src/infrastructure/adapters/codex-installer.ts)
- [src/infrastructure/adapters/codex-hooks-config.ts](/D:/Visual%20Studio%20Projects/prompt-language/src/infrastructure/adapters/codex-hooks-config.ts)

Current regression evidence:

- [src/infrastructure/adapters/installer.test.ts](/D:/Visual%20Studio%20Projects/prompt-language/src/infrastructure/adapters/installer.test.ts)
- [src/infrastructure/adapters/codex-installer.test.ts](/D:/Visual%20Studio%20Projects/prompt-language/src/infrastructure/adapters/codex-installer.test.ts)
- [src/infrastructure/adapters/codex-hooks-config.test.ts](/D:/Visual%20Studio%20Projects/prompt-language/src/infrastructure/adapters/codex-hooks-config.test.ts)

Those tests already prove these concrete behaviors:

- repeated install preserves unrelated Claude settings
- Codex install and uninstall preserve unrelated `config.toml` entries
- user-owned `codex_hooks` values remain untouched
- managed `codex_hooks = false` is re-enabled on refresh
- conflicts are detected instead of overwritten
- uninstall removes prompt-language-owned scaffold comments and empty managed sections

## Consequences

What this note now makes concrete:

- the exact host files and JSON keys that prompt-language owns
- the exact Codex marker strings that define managed ownership
- the exact merge and conflict rules for `~/.codex/config.toml`
- the exact uninstall cleanup rules for managed scaffold comments, empty sections, and legacy install paths

What this still does not claim:

- that a single hook-manager abstraction already exists across Claude and Codex
- that Claude has explicit inline ownership markers comparable to Codex
- that a separate ownership ledger already exists

## Implementation-readiness

This note is intended to be strong enough to drive implementation and review for `prompt-language-f7jp.3`.

An implementation derived from this note is complete only if it can demonstrate:

1. prompt-language mutates only the repo-specific paths and keys named here
2. user-owned Codex `codex_hooks` values survive install, refresh, and uninstall unchanged
3. conflicting Codex config stays unchanged and surfaces a warning
4. Claude uninstall removes only prompt-language-specific settings keys and heuristic status-line ownership
5. uninstall can clean a fully prompt-language-managed Codex scaffold back to an empty file without touching unrelated settings
