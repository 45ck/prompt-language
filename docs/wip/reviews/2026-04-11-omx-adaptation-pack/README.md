# 2026-04-11 OMX Adaptation Pack

Imported from `prompt-language-omx-adaptation-plan-pack-2026-04-11.zip`.

This pack is an operator-shell planning import, not shipped product documentation. It is useful because it translates OMX-style operator discipline into prompt-language-native backlog slices without changing the product's flow / gate / state center of gravity.

## Imported as raw source

The provenance summary for this bundle lives under:

- [docs/source-imports/from-omx-adaptation-pack-2026-04-11/README.md](../../../source-imports/from-omx-adaptation-pack-2026-04-11/README.md)

## Imported docs

| Doc                                                                   | Focus                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [00 Executive Summary](00-executive-summary.md)                       | Core recommendation and implementation order                                         |
| [02 Target Architecture](02-target-architecture.md)                   | Layered shell-over-runtime architecture                                              |
| [03 Adopt / Modify / Reject Matrix](03-adopt-modify-reject-matrix.md) | Which OMX ideas transfer directly, which must be translated, and which stay rejected |
| [04 Open Questions and Risks](04-open-questions-and-risks.md)         | Open design risks before implementation                                              |
| [Issue Breakdown](plans/issue-breakdown.md)                           | Repo-sized grouping of implementation slices                                         |
| [Phased Delivery Roadmap](plans/phased-delivery-roadmap.md)           | Suggested sequencing across foundation, recovery, visibility, and supervision        |
| [Operator Shell Spec](specs/001-operator-shell.md)                    | CLI-surface proposal including `doctor`, `refresh`, `inspect`, and team commands     |
| [Team Supervisor Spec](specs/007-team-supervisor.md)                  | Supervisor layer over existing `spawn` / `await` primitives                          |

## How this was integrated

- The full planning pack was kept under `docs/wip/reviews/2026-04-11-omx-adaptation-pack/` as imported WIP material, not promoted into shipped docs.
- The accepted shell-vs-runtime rule from this pack was promoted into [docs/design/operator-shell-boundary.md](../../../design/operator-shell-boundary.md) so later OMX follow-up beads can depend on one canonical design note.
- The accepted hook-manager ownership and lifecycle contract from this pack was promoted into [docs/design/hook-manager-ownership.md](../../../design/hook-manager-ownership.md) so `prompt-language-f7jp.3` has a canonical repo-native design anchor instead of only the imported WIP spec.
- The pack's implementation backlog was remapped into the repo-native Beads program `prompt-language-f7jp` instead of copying the raw `OPSH-*` issue IDs as canonical backlog.
- Overlap with existing work is explicit:
  - `prompt-language-f7jp.4` stays additive to `prompt-language-zhog.3` replayability work rather than replacing it.
  - `prompt-language-f7jp.8` stays distinct from swarm-specific lowering under `prompt-language-1wr7` and Codex child-session work under `prompt-language-72a5.5`.
  - `prompt-language-f7jp.1` records the shell-vs-runtime boundary so operator-shell work does not reopen product identity or hidden-magic questions.

Concrete repo outcomes:

- Beads: `prompt-language-f7jp`, `prompt-language-f7jp.1`, `prompt-language-f7jp.2`, `prompt-language-f7jp.3`, `prompt-language-f7jp.4`, `prompt-language-f7jp.5`, `prompt-language-f7jp.6`, `prompt-language-f7jp.7`, `prompt-language-f7jp.8`, `prompt-language-f7jp.9`

## Intentionally not imported as user-facing docs

- the optional `.github/ISSUE_TEMPLATE/*` drafts from the archive
- the top-level `patches/*.patch` files
- any OMX-driven README or roadmap rewrite that would imply a shipped product-identity change
- a slash-command-first or tmux-first conceptual model

The accepted shape is an additive operator shell above the existing runtime, with visible lowering and explicit state rather than hidden authority.
