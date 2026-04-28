# STATUS — open research work at 2026-04-28

Snapshot of the beads tracker for experiments. Source of truth lives in `.beads/` via the `bd` CLI; this file is a committed mirror so the status is readable without a bd install and is PR-reviewable.

**Regenerate:** `bd list --all --created-after 2026-04-19 --flat > /tmp/bd.txt` then hand-edit this file. Automation is a backlog item.

## Headline

- 2026-04-28 local-model ladder reruns are committed. H15 is a clean PL win (`10/10` vs solo `6/10`), H12 is a tie (`8/9` vs `8/9`) with PL much slower, and H14 is a solo win (`8/8` vs PL `6/8`).
- The current interpretation changed: PL helps when the flow supplies task-fit staged control and oracle-fed repair; it can hurt when over-staged or when repair prompts do not expose the real failure.
- New tracked experiment: `prompt-language-sfd3`, hybrid local/frontier model routing. Goal: local models handle bulk work, Codex/GPT-5.5-class models handle high-ambiguity reasoning, stuck-state repair, and final review.
- Raw ad hoc logs from H11/H12/H14/H15 remain local and uncommitted; committed evidence should prefer scorecards, manifests, and curated reports.

## Open items by priority

### P1 — blocking measurement integrity

| ID            | Type | Subject                                                                                            | Blocks                                                                                               |
| ------------- | ---- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `prompt-0zn1` | bug  | PL gate evaluator reports `file_exists` as false when file exists on disk (opencode-v2 regression) | Every flow using relative `done when: file_exists …` under opencode. Rescue-viability, self-hosting. |
| `prompt-7zyi` | bug  | PL aider runner walks up to parent git dir for path resolution even with `--no-git`                | Every aider run inside `experiments/**` without a per-run `git init`. Rescue-viability, ladder.      |

### P2 — next-tier execution work

| ID                     | Type    | Subject                                                                      | Blocked by                   |
| ---------------------- | ------- | ---------------------------------------------------------------------------- | ---------------------------- |
| `prompt-g64k`          | bug     | PL aider runner hangs on ollama TCP stream drop — litellm retries infinitely | — (containment plan written) |
| `prompt-gysa`          | epic    | Rescue-viability research program (R1..R10 umbrella)                         | —                            |
| `prompt-b5eb`          | task    | Rescue-viability R1 replications: lock in qwen3:8b E-SMALL CSV baseline      | —                            |
| `prompt-zbpc`          | task    | Run R7 foreach-spawn experiment (blocked on isolation)                       | `prompt-l1xz`, `prompt-nba9` |
| `prompt-lmas`          | feature | Add pi-mono runner adapter (~300 LOC headless JSONL bridge)                  | —                            |
| `prompt-language-sfd3` | task    | Hybrid local/frontier model routing experiment                               | —                            |

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
- `experiments/harness-arena/hybrid-model-routing.md` — HA-HR1 dynamic routing pilot design
- `experiments/pi-mono-RUNNER-PLAN.md` — pi-mono adapter implementation plan for `prompt-lmas`

## Conventions

- **P0–P4.** `bd` defaults to P2; P0 reserved for incidents, P1 for blockers, P2 for the next tier of substantive work, P3 for follow-ups, P4 for nice-to-have.
- **Bead IDs** are `prompt-XXXX`. Scoped by repo prefix.
- **Labels** group by subsystem (runtime, aider, opencode, dsl, ecosystem, experiment) — see `bd list --help` for querying.
- **Closing.** A bead is closed only when (a) a commit, PR, or artefact is named in the close reason, or (b) the work is declared deliberately out of scope.

## What a contributor should do next

If you are picking up work:

1. **If you can fix a P1 infra bug:** `prompt-7zyi` has a concrete plan (fix in `buildAiderEnv` via `GIT_CEILING_DIRECTORIES`); `prompt-0zn1` has an investigation plan with a minimal repro described in `AIDER-P1-TRIAGE.md`'s sibling triage and the gate-evaluator write-up. Either one closed unblocks ≥3 downstream items.
2. **If you want to run an experiment:** choose between H14 flow redesign, HA-HR1 hybrid routing, R3 stronger-model H11, or R9 review-vs-retry. Prefer runs that improve classification of no-edit, timeout, and oracle-fed repair behavior.
3. **If you want to add a runner:** `prompt-lmas` (pi-mono) is scoped at ~300 LOC with a full plan in `pi-mono-RUNNER-PLAN.md`.
