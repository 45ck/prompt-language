# Spec 005 — Project Scaffolding and Guidance

## Goal

Turn the best parts of OMX's AGENTS / skills discipline into prompt-language-native scaffolding.

## Scaffold targets

`init --operator-shell` should be able to generate:

- `AGENTS.md` template
- `flows/` starter library
- `gates/` starter pack
- `docs/wip/reviews/<date>-pack/` skeleton
- `.prompt-language/guidance/` metadata
- example clarify / plan / execute flows

## Design rule

Scaffolding must generate ordinary repo files that remain editable and reviewable.

No hidden prompt bundle should outrank repo-visible files.

## Guidance model

Use scoped guidance files and generated library metadata rather than opaque skills.

Good scaffold output:

- top-level operating contract
- local subsystem guidance
- reusable prompt / flow / gate libraries
- generated manifests for discovery

## Acceptance criteria

- scaffolded files are ordinary text files under version control
- users can delete or modify generated guidance without breaking the runtime
- shell commands can discover scaffolded assets without introducing invisible authority
