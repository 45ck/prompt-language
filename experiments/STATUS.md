# STATUS — open research work at 2026-04-24

Snapshot of the beads tracker for experiments. Source of truth lives in `.beads/` via the `bd` CLI; this file is a committed mirror so the status is readable without a bd install and is PR-reviewable.

**Regenerate:** `bd list --all --created-after 2026-04-19 --flat > /tmp/bd.txt` then hand-edit this file. Automation is a backlog item.

## Headline

- **1 bug committed as closed today:** `prompt-959j` (opencode runner progress-detector patch, landed in commit `04367d2`).
- **13 items open.** Two P1 bugs block measurement integrity. One P2 epic tracks the R1..R10 rescue-viability program. First-pass R1 is complete. R2 hardened H8 v3 now has clean retry-scoped PL rescue evidence: PL-lite 15/20, solo 18/20, corrected PL-medium v3b 20/20 across N=3 after two excluded operational attempts. The earlier qwen3:8b 9/11 PL-full result remains unreproduced.

## Open items by priority

### P1 — blocking measurement integrity

| ID            | Type | Subject                                                                                            | Blocks                                                                                               |
| ------------- | ---- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `prompt-0zn1` | bug  | PL gate evaluator reports `file_exists` as false when file exists on disk (opencode-v2 regression) | Every flow using relative `done when: file_exists …` under opencode. Rescue-viability, self-hosting. |
| `prompt-7zyi` | bug  | PL aider runner walks up to parent git dir for path resolution even with `--no-git`                | Every aider run inside `experiments/**` without a per-run `git init`. Rescue-viability, ladder.      |

### P2 — next-tier execution work

| ID            | Type    | Subject                                                                      | Blocked by                   |
| ------------- | ------- | ---------------------------------------------------------------------------- | ---------------------------- |
| `prompt-g64k` | bug     | PL aider runner hangs on ollama TCP stream drop — litellm retries infinitely | — (containment plan written) |
| `prompt-gysa` | epic    | Rescue-viability research program (R1..R10 umbrella)                         | —                            |
| `prompt-b5eb` | task    | Rescue-viability R1 replications: lock in qwen3:8b E-SMALL CSV baseline      | —                            |
| `prompt-zbpc` | task    | Run R7 foreach-spawn experiment (blocked on isolation)                       | `prompt-l1xz`, `prompt-nba9` |
| `prompt-lmas` | feature | Add pi-mono runner adapter (~300 LOC headless JSONL bridge)                  | —                            |

### P3 — follow-ups and ecosystem work

| ID            | Type     | Subject                                                                            | Depends on                     |
| ------------- | -------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| `prompt-4rcm` | task     | R2 PL-intensity ablation on qwen3:8b H8 fixture                                    | `prompt-b5eb`                  |
| `prompt-4noo` | task     | Level B self-hosting: PL-authored port of opencode runner patch                    | — (reference patch now merged) |
| `prompt-l1xz` | bug      | Concurrent opencode children may share `.prompt-language/opencode-home/` state     | —                              |
| `prompt-nba9` | feature  | `foreach-spawn` should expose a child-index variable for per-child state isolation | —                              |
| `prompt-pm17` | feature  | Evaluate OpenHands runner adapter for PL                                           | —                              |
| `prompt-82lx` | decision | Prefer aider over opencode as PL runner for local-model orchestration              | —                              |

## Recently closed

| ID            | Closed     | Commit                                                                                                                     |
| ------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `prompt-959j` | 2026-04-20 | `04367d2` — fix(runtime): treat completed mutating tool_use as opencode progress. 14/14 tests pass. Pushed to origin/main. |

## Dependency chains worth knowing

```
prompt-7zyi (aider parent-git walk, P1)
  └── blocks trustworthy ladder/rescue runs
       ├── prompt-b5eb (R1 replications)
       │    └── prompt-4rcm (R2 ablation)
       └── prompt-gysa (rescue-viability epic)

prompt-0zn1 (gate file_exists false negative, P1)
  └── blocks any flow with relative done-when paths

prompt-l1xz (opencode-home concurrent sharing)
prompt-nba9 (foreach-spawn child-index)
  └── both block prompt-zbpc (R7 execution)

prompt-959j CLOSED — unblocks prompt-4noo (Level B self-hosting)
```

## Adjacent plan docs (not in beads)

These are written plans awaiting bead-tracked execution tasks:

- `experiments/aider-vs-pl/rescue-viability/ROADMAP.md` — R1..R10 execution sequencing
- `experiments/aider-vs-pl/AIDER-P1-TRIAGE.md` — triage for `prompt-7zyi` + `prompt-g64k`
- `experiments/REPO-JOURNEY-PLAN.md` — folder reorg plan (not executed)
- `experiments/harness-arena-HA-E1-PLAN.md` — HA-E1 pilot design
- `experiments/pi-mono-RUNNER-PLAN.md` — pi-mono adapter implementation plan for `prompt-lmas`

## Conventions

- **P0–P4.** `bd` defaults to P2; P0 reserved for incidents, P1 for blockers, P2 for the next tier of substantive work, P3 for follow-ups, P4 for nice-to-have.
- **Bead IDs** are `prompt-XXXX`. Scoped by repo prefix.
- **Labels** group by subsystem (runtime, aider, opencode, dsl, ecosystem, experiment) — see `bd list --help` for querying.
- **Closing.** A bead is closed only when (a) a commit, PR, or artefact is named in the close reason, or (b) the work is declared deliberately out of scope.

## What a contributor should do next

If you are picking up work:

1. **If you can fix a P1 infra bug:** `prompt-7zyi` has a concrete plan (fix in `buildAiderEnv` via `GIT_CEILING_DIRECTORIES`); `prompt-0zn1` has an investigation plan with a minimal repro described in `AIDER-P1-TRIAGE.md`'s sibling triage and the gate-evaluator write-up. Either one closed unblocks ≥3 downstream items.
2. **If you want to run an experiment:** choose between R2-C PL-full on semantic v3, R3 stronger-model H11, or R9 review-vs-retry. R2-B medium retry is no longer the blocker.
3. **If you want to add a runner:** `prompt-lmas` (pi-mono) is scoped at ~300 LOC with a full plan in `pi-mono-RUNNER-PLAN.md`.
