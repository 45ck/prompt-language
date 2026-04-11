# Spec 002 — Hook Manager

## Goal

Manage host hooks safely across supported runners while preserving user ownership and enabling clean uninstall / refresh cycles.

## Requirements

- merge-safe writes
- explicit ownership markers
- uninstall-safe behavior
- runner adapter model
- doctor visibility
- no silent fallback that hides degraded behavior

## Data model

.prompt-language/hooks/
ownership.json
installs/
claude.json
codex.json
diagnostics/
latest.json

`ownership.json` should record:

- runner
- managed files
- managed entry ids
- install timestamp
- version
- migration version
- checksum of rendered managed content

## Behavior

### install / refresh

- read existing runner hook config
- preserve unknown / user-owned entries
- replace only prompt-language-managed entries
- write ownership metadata
- verify post-write state

### uninstall

- remove only prompt-language-managed entries
- leave user hooks untouched
- keep the hook file if non-prompt-language hooks remain
- clear ownership metadata only when nothing managed remains

### doctor

Must report:

- missing hook file
- parse failures
- duplicated managed entries
- stale checksums
- conflicting ownership
- unsupported runner / partial integration

## Adapter strategy

Phase 1:

- Claude path hardening
- Codex scaffold compatibility

Phase 2:

- broader runner abstraction once harness work is ready

## Acceptance criteria

- refresh does not clobber manual edits outside managed regions
- uninstall is reversible and conservative
- doctor can identify ownership conflicts without destructive repair
- hook behavior is covered by snapshot / property tests
