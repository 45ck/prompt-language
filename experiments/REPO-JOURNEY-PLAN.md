# Repo Journey Plan — making the 2026-04-14 → 2026-04-20 arc legible

Date: 2026-04-20
Author: delivery planning pass (no files moved, no docs edited)
Scope: propose a single reorganisation of `experiments/` and the landing surface so a new visitor can trace the research journey linearly, see what is in flight, and find the fastest reproduction path in under two minutes.
Constraints honoured: plan-only; existing naming conventions kept where possible; half-day of focused work; `docs/` structure (architecture, design, guides, reference, adr, strategy) left alone except for one small add.

---

## 1. Current-state diagnosis

Where things live today:

- **Root README.md** — product face: install, example flow, feature table, CLI table, docs links. Does not mention the research journey and does not link to `experiments/` at all. A visitor arriving from npm or GitHub has no thread back to the 2026-04 research arc.
- **`docs/`** — governance and reference-grade surface: `architecture.md`, `experiments.md`, `design/`, `guides/`, `reference/`, `adr/`, `evaluation/`, `strategy/`, `research/`, `roadmap.md`, `thesis-verification.md`, `operations/`, `security/`. Well-organised, cross-linked, and mostly stable. Some overlap risk: `docs/experiments.md` and `experiments/README.md` both index experiments.
- **`experiments/README.md`** — catalog table (E4/E5/E7/E8 plus scaffolds) and directory tree. No journey narrative, no chronology, and the `aider-vs-pl` row is a single "Complete — See scorecard" line that hides ten days of nested work.
- **`experiments/EXPERIMENT-AREAS.md`** — the newest and most useful navigation artifact. Defines codenames (ladder, rescue, harness-arena, atlas, forge, foundry, crucible), charters each area, inventories evidence strength, and explicitly says "names are not yet adopted." It is currently the closest thing to a journey doc but is not linked from either README.
- **`experiments/aider-vs-pl/`** — ten markdown docs at the top level plus `rescue-viability/`, `e-small-fixtures/`, `fixtures/`, `results/`, `phase2-design.md`. Chronology is only recoverable by reading the `Date:` line inside each file. The April-14 scorecard sits next to April-20 pivot docs with no ordering. `SESSION-2026-04-20-OPENCODE-NEXTJS.md`, `GUIDE-AND-ROADMAP.md`, `RESCUE-VIABILITY-PLAN.md`, `SELF-HOSTING-THEORY.md`, `MULTI-AGENT-REVIEW.md`, `AIDER-P1-TRIAGE.md`, `LEVEL-A-DESIGN.md` are all from today and are the hardest to contextualise.
- **`experiments/aider-vs-pl/ecosystem-analysis/`** — four ecosystem write-ups (pi-mono, hermes-agent, openclaw, adjacent-ecosystem). Nested under aider-vs-pl by accident of history; belongs at the experiments top level per `EXPERIMENT-AREAS.md`.
- **`.beads/`** — live issue DB (`issues.jsonl`, dolt server running). WIP truth lives here but is invisible from any README.

What a new visitor cannot find today:

- Where the research starts (no chronological entry point).
- What is the headline result (PL 6–0–3 on qwen3:30b is only in `SCORECARD.md` three levels deep).
- What changed today (eight new 2026-04-20 docs with no "what's new" surface).
- What is currently in flight (beads exists but is not surfaced).
- Where the thesis got narrowed (the `LOCAL-MODEL-VIABILITY-FINDINGS.md` refutation of the broad small-model rescue claim is the pivotal document and is not highlighted anywhere).

Orphaned or duplicated:

- `ecosystem-analysis/` location mismatch (nested in aider-vs-pl, charter says top-level `atlas/`).
- `docs/experiments.md` vs `experiments/README.md` — same catalog, different shape, drifting.
- `phase2-design.md` and `LEVEL-A-DESIGN.md` both describe forward plans in the same directory with no index.
- `results/` and `e-small-fixtures/` and `fixtures/` — run artifacts intermixed with narrative docs.

---

## 2. Proposed top-level structure

Minimum viable move. Do not touch `docs/`. Add two navigation surfaces and adopt the codename scheme from `EXPERIMENT-AREAS.md` inside `experiments/` only.

Add / rename:

```
C:\Projects\prompt-language\
  README.md                                         (edit: add one "Research journey" link)
  experiments\
    README.md                                       (edit: replace catalog with journey-first index)
    JOURNEY.md                                      (NEW: the linear 2026-04-14 → 2026-04-20 narrative)
    STATUS.md                                       (NEW: generated snapshot from `bd list`, regen daily)
    EXPERIMENT-AREAS.md                             (keep; promote to adopted, not proposal)
    CATALOG.md                                      (keep)
    ladder\                                         (renamed from aider-vs-pl\; H1–H20 ladder)
      README.md                                     (NEW: area template, see §5)
      SCORECARD.md                                  (moved; unchanged)
      phase2-design.md                              (moved; unchanged)
      LOCAL-MODEL-VIABILITY-FINDINGS.md             (moved; unchanged — the pivot doc)
      EVIDENCE-CONSOLIDATION.md                     (moved; unchanged)
      AIDER-P1-TRIAGE.md                            (moved; unchanged)
      fixtures\, e-small-fixtures\, results\        (moved; unchanged)
    rescue\                                         (promoted from aider-vs-pl/rescue-viability)
      README.md                                     (NEW: area template, §5 mock)
      RESCUE-VIABILITY-PLAN.md                      (moved from aider-vs-pl/)
      LEVEL-A-DESIGN.md                             (moved from aider-vs-pl/)
      LIVE-NOTES.md, R7-design.md, flows\, runs\, fixtures\, solo-arm.sh   (moved as-is)
    harness-arena\                                  (NEW empty shell; cloud-harness vs local-PL)
      README.md                                     (NEW: area template, charter only)
      SESSION-2026-04-20-OPENCODE-NEXTJS.md         (moved from aider-vs-pl/ — it is a harness-arena artifact)
      GUIDE-AND-ROADMAP.md                          (moved from aider-vs-pl/ — operator guide for this area)
    atlas\                                          (renamed from aider-vs-pl/ecosystem-analysis)
      README.md                                     (NEW: area template)
      pi-mono.md, hermes-agent.md, openclaw.md, adjacent-ecosystem.md   (moved unchanged)
      MULTI-AGENT-REVIEW.md                         (moved from aider-vs-pl/ — it is an ecosystem review)
    forge\                                          (NEW thin wrapper; does NOT replace meta-factory/)
      README.md                                     (NEW: points at meta-factory/ and SELF-HOSTING-THEORY.md)
      SELF-HOSTING-THEORY.md                        (moved from aider-vs-pl/)
    foundry\                                        (NEW thin wrapper; does NOT replace the factory dirs)
      README.md                                     (NEW: pointers to full-saas-factory, marketing-factory, website-factory, full-sdlc-factory)
    crucible\                                       (NEW thin wrapper)
      README.md                                     (NEW: pointers to premature-stop-benchmark, bounded-feature-benchmark, parallel-*, self-healing-ci)
    meta-factory\                                   (UNCHANGED; forge\README.md links to it)
    full-saas-factory\, marketing-factory\, website-factory\, full-sdlc-factory\   (UNCHANGED; foundry\README.md links to them)
    premature-stop-benchmark\, bounded-feature-benchmark\, parallel-planning\, parallel-isolated-modules\, self-healing-ci\   (UNCHANGED; crucible\README.md links to them)
    eval\                                           (UNCHANGED)
```

Why thin-wrapper directories for forge/foundry/crucible instead of renaming: `meta-factory/`, `full-saas-factory/`, `marketing-factory/`, etc. are referenced from external docs (`docs/evaluation/non-factory-proof-program.md`, `docs/experiments.md`, `experiments/README.md` table, internal cross-links). A rename is high-risk for half a day. A wrapper directory containing only a `README.md` that points at the canonical location gives the journey navigation without breaking links.

`docs/` changes: none to existing files. Optionally add `docs/index.md` link "Research journey" → `../experiments/JOURNEY.md`. This is the single concession on the `docs/` boundary and it is one line.

---

## 3. Journey narrative outline (`experiments/JOURNEY.md`)

A single markdown file, reverse-navigable via a table of contents, written in chronological order so a visitor can scroll. Each section is one or two paragraphs and links out to the canonical doc.

1. **Founding thesis — why verification-first supervision.** One paragraph restating the product thesis from the root README (deterministic execution, verification gates, parallel agents). Link to `README.md` and `docs/architecture.md`. Gap: no dated "thesis" doc inside `experiments/`; the narrative stitches from the root README.
2. **H1–H10 validation ladder (2026-04-14).** The scorecard run. PL 6–0–3 vs solo-aider on qwen3-opencode:30b. Link to `ladder/SCORECARD.md`. Feeds: `SCORECARD.md`. Known caveats: single model, single host.
3. **Phase 2 design (H11–H20).** What the scorecard suggested testing next. Link to `ladder/phase2-design.md`. Gap: only H11 and H14 have partial evidence.
4. **Methodology audit and evidence consolidation (2026-04-15/16).** Why the scorecard numbers hold up. Link to `ladder/EVIDENCE-CONSOLIDATION.md` and `docs/security/aider-vs-pl-scrutiny.md`.
5. **Local-model viability probe (2026-04-17) — the pivot.** E-SMALL run on gemma4-e2b/e4b/qwen3-30b plus the H11 rigor artifact. The broad "PL rescues any weak model" claim is refuted; the narrower "PL helps models above the valid-syntax threshold" claim stands. Two P1 runtime defects surfaced. Link to `ladder/LOCAL-MODEL-VIABILITY-FINDINGS.md` and `ladder/AIDER-P1-TRIAGE.md`. **This is the hinge of the whole arc and should be visually marked.**
6. **Rescue-viability plan (2026-04-20).** The follow-up experiment designed to formalise what the April-17 probe narrowed. Three-axis sweep: model capability × task difficulty × PL intensity. Link to `rescue/RESCUE-VIABILITY-PLAN.md` and `rescue/LEVEL-A-DESIGN.md`. Status: design and one live-notes file, no locked matrix.
7. **Harness-arena session (2026-04-20).** Live end-to-end run: opencode + qwen3-opencode:30b + PL building a Next.js app. Produced three infra-level findings (Modelfile `num_ctx` truncation, opencode tool-mode config, etc.). Link to `harness-arena/SESSION-2026-04-20-OPENCODE-NEXTJS.md` and the operator-facing `harness-arena/GUIDE-AND-ROADMAP.md`.
8. **Self-hosting theory (2026-04-20).** Three levels of recursion (PL orchestrates research → PL authors PL tests → PL authors PL source). Connects to `meta-factory/` for the safety envelope. Link to `forge/SELF-HOSTING-THEORY.md` → `meta-factory/README.md`.
9. **Ecosystem analysis (atlas).** Positional survey vs aider, opencode, OpenHands, Cline, Continue, Claude Code, Codex CLI; focused write-ups on pi-mono, hermes-agent, openclaw; multi-agent review. Link to `atlas/`.
10. **Open questions (as of 2026-04-20).** Single bulleted section, each bullet links to a bead ID where tracked. Gaps that are currently untracked: (a) whether rescue works above H10 on any model; (b) whether the `opencode` infra fixes reproduce on non-Windows hosts; (c) whether meta-factory M2–M9 are feasible with local models.

Feeder → section mapping is embedded above so the doc can be drafted by copy-paste of existing prose.

---

## 4. WIP tracking surface — choose (a) `STATUS.md` regenerated from `bd list`

Chosen option: **(a) `experiments/STATUS.md` regenerated from `bd list`.** Committed to git, refreshed by a small script (`scripts/regen-status.mjs` or similar), linked from `experiments/README.md` and the root README's "Research journey" row.

Rationale:

- Beads is already the source of truth (`.beads/issues.jsonl`, dolt server running). A committed markdown snapshot gives a stable URL for a visitor who does not have `bd` installed and does not want to run a tool.
- Option (b) "live section in root README" couples product-facing surface to research churn; root README should stay stable and not move with every experiment state change.
- Option (c) "per-area README showing queued/running/done" duplicates beads state into seven places and will drift. Per-area READMEs should instead link to a filtered `STATUS.md` anchor or a `bd list --label <area>` invocation.
- A generated `STATUS.md` is append-only-friendly, diff-reviewable in PRs, and the regen script can be a pre-commit or a manual step — both acceptable for a half-day effort.

`STATUS.md` shape: three tables — **In flight**, **Queued**, **Recently done (last 14 days)** — each with columns `ID | Area | Title | Owner | Updated`. Area is the bead label (ladder, rescue, harness-arena, atlas, forge, foundry, crucible, meta, eval). Footer timestamp plus the exact `bd` command used so regen is reproducible.

---

## 5. Area-README template

Every area README fits on one screen. Target: a visitor answers "what is this, what is done, what is in flight, what is next" in 30 seconds.

````md
# <codename> — <one-line charter>

Area: <codename> Evidence: strong | medium | thin Updated: YYYY-MM-DD

## What this is

One or two sentences. Scope and what is explicitly out of scope.

## Done (locked findings)

- <finding 1> — <link to doc> (YYYY-MM-DD)
- <finding 2> — <link to doc> (YYYY-MM-DD)

## In flight

- <experiment ID> <one line> — bead <bd-NNN> — owner <who>
- See `../STATUS.md` for the live view.

## Queued / next

- <experiment ID> <one line> — bead <bd-NNN>

## Key docs in this directory

- `FILE.md` — <one-line purpose>
- `subdir/` — <one-line purpose>

## Reproduce the headline claim

```bash
# exact copy-paste command to reproduce the single most important result
```
````

````

**Mock filled in for `experiments/rescue/README.md`:**

```md
# rescue — does PL lift weaker models on harder tasks, and which features carry the lift?

Area: rescue   Evidence: thin   Updated: 2026-04-20

## What this is
Three-axis sweep — model capability (gemma-e4b, qwen3:8b, qwen3:30b, frontier) x task difficulty (E-SMALL, H1–H10, H11–H20) x PL intensity (solo, pl-lite, pl-medium, pl-full) — to localise where and why PL rescues a model. Out of scope: cloud-harness comparisons (see `../harness-arena/`).

## Done (locked findings)
- Design framing: rescue(T, M, φ) = pl - solo; a feature matters if removing it drops pl. — `RESCUE-VIABILITY-PLAN.md` (2026-04-20)
- Level A design — `LEVEL-A-DESIGN.md` (2026-04-20)
- R7 single-GPU Ollama sequentiality hypothesis — `R7-design.md` (2026-04-20)

## In flight
- R1–R10 matrix scaffolding — bead <bd-NNN> — owner <unassigned>
- See `../STATUS.md` for the live view.

## Queued / next
- R1 baseline locked run on qwen3:8b x H1–H10 x pl-full — bead <bd-NNN>
- Decide candidate model set excluding gemma4-opencode:{e2b,e4b} (refuted 2026-04-17) — bead <bd-NNN>

## Key docs in this directory
- `RESCUE-VIABILITY-PLAN.md` — the full three-axis plan.
- `LEVEL-A-DESIGN.md` — Level A design for the first wave.
- `R7-design.md` — foreach-spawn vs sequential scaffolding single-GPU hypothesis.
- `LIVE-NOTES.md` — running journal for in-flight runs.
- `flows/`, `runs/`, `fixtures/` — execution artifacts.

## Reproduce the headline claim
No locked run matrix yet. See `RESCUE-VIABILITY-PLAN.md` §"How to reproduce" for the first-wave command once R1 lands.
````

---

## 6. Migration sequence

Ordered, reversible-where-noted. Each step is a single commit.

| #   | Step                                                                                                                                                                                                                                                              | Est. min | Risk                                                                                                                                                                                                                                                             | Reversibility                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Add `experiments/JOURNEY.md` drafted from §3 outline, copy-paste-linking existing docs at their current paths.                                                                                                                                                    |       60 | Low. New file. No existing doc moves.                                                                                                                                                                                                                            | Trivial — delete one file.                                               |
| 2   | Add `experiments/STATUS.md` hand-generated first cut from `bd list`; add `scripts/regen-status.mjs` as a thin wrapper.                                                                                                                                            |       40 | Low. New file. Script can be a one-liner shell wrapping `bd list --json` + a template.                                                                                                                                                                           | Trivial.                                                                 |
| 3   | Add `experiments/README.md` rewrite: journey-first (links to `JOURNEY.md` and `STATUS.md` at top), keep the catalog table below.                                                                                                                                  |       20 | Low — file already exists. Keep the existing catalog table as-is to avoid breaking links from `docs/experiments.md`.                                                                                                                                             | Git revert.                                                              |
| 4   | Add thin-wrapper area directories: `forge/`, `foundry/`, `crucible/` with only a `README.md` each pointing at canonical locations.                                                                                                                                |       20 | Very low. Pure additions, no renames.                                                                                                                                                                                                                            | Trivial.                                                                 |
| 5   | Rename `experiments/aider-vs-pl/ecosystem-analysis/` → `experiments/atlas/`. Update cross-references in the moved files and in `ladder/` docs that point at it. Grep for the old path first.                                                                      |       25 | **Medium** — this directory is referenced from `EXPERIMENT-AREAS.md`, `EVIDENCE-CONSOLIDATION.md`, and potentially `docs/`. A grep pass must precede the move.                                                                                                   | Reversible via `git mv` inverse; links need re-patching.                 |
| 6   | Move today's (2026-04-20) docs that are really harness-arena artifacts out of `aider-vs-pl/` into a new `experiments/harness-arena/` dir: `SESSION-2026-04-20-OPENCODE-NEXTJS.md`, `GUIDE-AND-ROADMAP.md`. Add `harness-arena/README.md` from the §5 template.    |       25 | Low–medium. These docs have internal relative links (`../../docs/security/aider-vs-pl-scrutiny.md`, sibling links to `SCORECARD.md`). Fix after move.                                                                                                            | `git mv` reversible.                                                     |
| 7   | Move `SELF-HOSTING-THEORY.md` → `experiments/forge/` and `MULTI-AGENT-REVIEW.md` → `experiments/atlas/`.                                                                                                                                                          |       15 | Low.                                                                                                                                                                                                                                                             | Reversible.                                                              |
| 8   | Rename `experiments/aider-vs-pl/` → `experiments/ladder/`. **This is the biggest single move.** Move `rescue-viability/` out to `experiments/rescue/` at the same time. Promote `RESCUE-VIABILITY-PLAN.md` and `LEVEL-A-DESIGN.md` from `ladder/` into `rescue/`. |       45 | **High** — every cross-link in `docs/security/aider-vs-pl-scrutiny.md`, `docs/experiments.md`, external README badges, any external blog posts, and every intra-experiment link breaks. See §8 discoverability: the reproduce-the-claim command must still work. | Reversible with `git mv` inverse. Links need a full grep-and-patch pass. |
| 9   | Fill in each area `README.md` from the §5 template.                                                                                                                                                                                                               |       45 | Low.                                                                                                                                                                                                                                                             | Trivial.                                                                 |
| 10  | Edit root `README.md` — add one row or one line: `Research journey → experiments/JOURNEY.md` and `Live status → experiments/STATUS.md`.                                                                                                                           |       10 | Low. Root README is product-facing; keep the edit small.                                                                                                                                                                                                         | Trivial.                                                                 |
| 11  | Run `grep -r "aider-vs-pl" .` and `grep -r "ecosystem-analysis" .` across the repo; patch every hit. Run `npm run build` / `npm test` / docs build if any.                                                                                                        |       30 | **High if skipped.** This step is the migration's actual correctness gate.                                                                                                                                                                                       | Patches are just edits; revert if the build breaks.                      |
| 12  | Update `EXPERIMENT-AREAS.md` from "Proposal — not adopted" to "Adopted 2026-04-20" and make it the second link from `JOURNEY.md`.                                                                                                                                 |       10 | Very low.                                                                                                                                                                                                                                                        | Trivial.                                                                 |

Total: ~5.75 hours of focused work, fits inside a half-day with buffer. Steps 1–4 can ship alone as a safe "navigation-only" PR if time runs out.

---

## 7. What NOT to change

- `docs/adr/` — decision records are immutable by convention. Do not move, rename, or renumber.
- `docs/reference/` — DSL reference, CLI reference, grammar. External links and npm README point here. Leave alone.
- `docs/design/` — design notes referenced by ADRs. Leave alone.
- `docs/guides/` — user-facing guides (getting-started, claude-code-and-codex). Leave alone. The `harness-arena/GUIDE-AND-ROADMAP.md` is a **different** document — operator-facing research roadmap, not a product guide — and should not be merged into `docs/guides/`.
- `docs/evaluation/` — external citations exist against `non-factory-proof-program.md`. Do not rename.
- `meta-factory/`, `full-saas-factory/`, `marketing-factory/`, `website-factory/`, `full-sdlc-factory/`, `eval/`, `premature-stop-benchmark/`, `bounded-feature-benchmark/`, `parallel-planning/`, `parallel-isolated-modules/`, `self-healing-ci/` — keep canonical names. `forge/`, `foundry/`, `crucible/` are wrappers pointing at these, not renames of these.
- Root README product surface (install, example, feature table, CLI table) — add a one-line research-journey link; do not restructure.
- `CHANGELOG.md`, `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md` — out of scope.
- `.beads/` — single source of truth. Do not try to mirror state into markdown beyond the generated `STATUS.md`.

Separation of concerns in one sentence: `docs/` is the product's governance and reference surface; `experiments/` is the research journey; the two must not cross-depend beyond one link each way.

---

## 8. Discoverability quality gates

A new visitor landing on the GitHub page must be able to answer all three in under two minutes by clicking only from `README.md` → `experiments/JOURNEY.md` → one more hop.

1. **"Can prompt-language help my local 8B model?"** Expected path: root README → `experiments/JOURNEY.md` §5 (local-model viability pivot) → `ladder/LOCAL-MODEL-VIABILITY-FINDINGS.md`. Answer visible within the first screen: **yes for models that reliably emit valid target-language syntax (qwen3:30b passes E-SMALL 11/11), no for sub-capability models (gemma4-e2b/e4b refuted 2026-04-17); the rescue-viability plan is the formal next step.**
2. **"What is the fastest way to reproduce the key claim?"** Expected path: root README → `experiments/JOURNEY.md` §2 → `ladder/README.md` "Reproduce the headline claim" block. The block must contain the exact copy-paste command for the H1–H10 scorecard run on qwen3-opencode:30b. Currently that command is scattered across per-hypothesis scripts; consolidating it into `ladder/README.md` is an explicit acceptance criterion for step 9 of the migration.
3. **"Where is the research still open?"** Expected path: root README → `experiments/STATUS.md` (regenerated from `bd list`) plus `experiments/JOURNEY.md` §10 "Open questions." The visitor sees current in-flight beads and the three named unresolved questions (rescue above H10, opencode infra fixes cross-platform, meta-factory M2–M9 with local models).

If any of these three paths exceeds two minutes or more than two hops in testing, the migration is not done.

---

## Appendix — codename clash check

From `EXPERIMENT-AREAS.md` proposed names vs existing top-level dirs under `experiments/`:

- **ladder** — no clash. Replaces `aider-vs-pl`.
- **rescue** — no clash. Promoted from `aider-vs-pl/rescue-viability`.
- **harness-arena** — no clash. New dir.
- **atlas** — no clash. Replaces `aider-vs-pl/ecosystem-analysis`.
- **forge** — no clash as a directory, but **semantic clash with `meta-factory/`**. Recommendation: keep `meta-factory/` as the canonical location and make `forge/` a one-file pointer dir. Do not rename `meta-factory/` — it is referenced from `docs/` and has live artifacts (M1 authored, result directories) whose paths appear in run manifests.
- **foundry** — no directory clash but **semantic overlap with the four factory dirs** (`full-saas-factory/`, `marketing-factory/`, `website-factory/`, `full-sdlc-factory/`). Same recommendation: pointer dir, no rename.
- **crucible** — no clash. Pointer dir over `premature-stop-benchmark/`, `bounded-feature-benchmark/`, `parallel-planning/`, `parallel-isolated-modules/`, `self-healing-ci/`.

Alternative names considered and rejected: **"workshop"** for forge (too generic), **"factories"** for foundry (collides with existing plural usage in prose), **"edges"** for crucible (loses the stress-test connotation).
