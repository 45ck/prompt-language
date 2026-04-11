# OMX Adaptation Pack Provenance

Source archive: `prompt-language-omx-adaptation-plan-pack-2026-04-11.zip`

Observed in `C:\Users\Admin\Downloads` with last-write time `2026-04-11 11:21:11 +10:00`.

## What was imported

Curated review-pack docs were folded into:

- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/README.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/00-executive-summary.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/01-current-state-and-gap-analysis.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/02-target-architecture.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/03-adopt-modify-reject-matrix.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/04-open-questions-and-risks.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/specs/*.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/plans/*.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/adrs/*.md`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/backlog/*`
- `docs/wip/reviews/2026-04-11-omx-adaptation-pack/examples/*`

These stay in WIP because the pack is future-facing operator-shell planning, not shipped product behavior.

## What was intentionally not imported raw

- `INTEGRATE.md`
- `patches/*.patch`
- `repo-files/.github/ISSUE_TEMPLATE/*`
- the archive's raw top-level `repo-files/` mirror outside the curated WIP docs folder

Those files are useful as source material, but they would create duplicate maintenance burden once the accepted content is curated into repo-native docs and Beads.

## Backlog mapping

The pack's raw `OPSH-*` backlog was remapped into repo-native Beads instead of being copied verbatim:

- canonical shell-vs-runtime boundary -> `docs/design/operator-shell-boundary.md`
- canonical hook-manager ownership contract -> `docs/design/hook-manager-ownership.md`
- boundary and shell-vs-runtime framing -> `prompt-language-f7jp.1`
- `OPSH-001` and `OPSH-002` -> `prompt-language-f7jp.2`
- `OPSH-003` -> `prompt-language-f7jp.3`
- `OPSH-004` and `OPSH-005` -> `prompt-language-f7jp.4`
- `OPSH-006` and `OPSH-007` -> `prompt-language-f7jp.5`
- `OPSH-008` -> `prompt-language-f7jp.6`
- `OPSH-009` -> `prompt-language-f7jp.7`
- `OPSH-010` and `OPSH-011` -> `prompt-language-f7jp.8`
- `OPSH-012` -> `prompt-language-f7jp.9`

Program umbrella:

- `prompt-language-f7jp` — operator-shell adaptation program

Overlap kept explicit instead of silently duplicated:

- `prompt-language-f7jp.4` stays narrower than `prompt-language-zhog.3` replayability and event-log work
- `prompt-language-f7jp.8` stays distinct from swarm lowering under `prompt-language-1wr7`
- `prompt-language-f7jp.8` also stays separate from Codex-specific child-session harness work under `prompt-language-72a5.5`

## Why this shape

The pack is useful because it sharpens operator-shell design judgment. It is not useful if it becomes a raw archive dump, a duplicate roadmap program, or a stealth product-identity rewrite.
