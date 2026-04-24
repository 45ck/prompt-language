# rescue — does PL's top-level wisdom lift lower-capability models above their solo ceiling

**Status:** R1 complete for the first pass: qwen3:8b solo timed out at 1/11, qwen3:8b PL-full corrected repeats scored 5/11 and 5/11, gemma4-opencode:e4b PL-full scored 3/11 with no implementation file, and qwen3-opencode:30b solo passed 11/11. R2-B has a clean hardened-H8 retry-scoped N=3 band at 20/20, 20/20, 20/20. R9-E review-grounded E-SMALL completed cleanly at 11/11 in 482s.
**Last update:** 2026-04-24

## Question

If we encode PL's discipline (decomposition, scoping, gates, retry loops) as top-level flow structure, can a weaker local model finish tasks it cannot finish solo? The area looks for a reproducible lift above each model's unaided ceiling — not parity with frontier models.

## What this area has measured (receipts)

- R1-A solo aider baseline on qwen3:8b E-SMALL timed out after 1800s and scored 1/11 — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1-B/R1-C corrected PL-full repeats on qwen3:8b E-SMALL scored 5/11 and 5/11; an uncorrected R1-B attempt is invalidated by CommonJS/ESM fixture hygiene — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1-D gemma4-opencode:e4b PL-full floor check scored 3/11 and produced no `csv2json.js`; `ollama ps` showed local partial-GPU placement at 68%/32% CPU/GPU — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1-E qwen3-opencode:30b solo ceiling remeasurement passed 11/11; `ollama ps` showed local partial-GPU placement at 15%/85% CPU/GPU — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R2-A qwen3:8b PL-lite on reconstructed H8 passed 4/4 with no retry and no completion gate — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R2-D qwen3:8b solo on reconstructed H8 also passed 4/4, so this reconstruction does not support a rescue claim — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R2 hardened H8 v3 semantic repair: PL-lite scored 15/20, solo scored 18/20, corrected PL-medium v3b first failed operationally at 19/20, then completed cleanly at 20/20 across three repeats — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R9-E qwen3:8b PL review-grounded E-SMALL completed cleanly with exit 0 and scored 11/11 in 482s; timeout controls were explicit at shell, runner, run-node, and review-loop levels — see [LIVE-NOTES.md](LIVE-NOTES.md)
- Earlier R1v3 PL-full run on qwen3:8b E-SMALL reached 9/11 after retry, but remains an unreproduced high outlier — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1..R10 experiment plan and success criteria — see [RESCUE-VIABILITY-PLAN.md](RESCUE-VIABILITY-PLAN.md)
- Sequencing, stop conditions, and falsification milestone — see [ROADMAP.md](ROADMAP.md)
- Run artifacts and fixtures — see [runs/](runs/), [fixtures/](fixtures/), [flows/](flows/)

## What is in flight

- R1 replications across models/seeds (bead prompt-b5eb); qwen3:8b PL-full rep 2/3 are now recorded
- R7 foreach-spawn variant blocked on runtime bug (bead prompt-zbpc)

## What is next (ordered)

1. Start R3 if the goal is the task-difficulty ladder; R2-B and R9 now both have at least one clean local qwen3:8b result
2. Repeat R9-E to N=3 only if review-vs-retry cost becomes a publication target; otherwise one clean probe is enough to rank the mechanism
3. If another aider exit occurs, inspect PLR-007 `_runtime_diagnostic.prompt_runner.*` state before deleting run state

## Known blockers

- aider defect B (bead prompt-7zyi)
- PL gate evaluator defect (bead prompt-0zn1)
- foreach-spawn child-index defect (bead prompt-nba9)

## Stop conditions

Copied from [ROADMAP.md](ROADMAP.md) falsification milestone: halt and re-plan if R1-A shows the solo arm reaching parity, if R2 ablation preserves the lift, or if three consecutive replications fail to reproduce the +4 assertion delta.

## Related

- Plan: [RESCUE-VIABILITY-PLAN.md](RESCUE-VIABILITY-PLAN.md), [ROADMAP.md](ROADMAP.md)
- Sibling areas: [../](../), [../../ecosystem-analysis/](../../ecosystem-analysis/), [../../harness-arena/](../../harness-arena/)
