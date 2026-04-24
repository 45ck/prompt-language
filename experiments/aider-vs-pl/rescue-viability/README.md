# rescue — does PL's top-level wisdom lift lower-capability models above their solo ceiling

**Status:** R1 complete for the first pass: qwen3:8b solo timed out at 1/11, qwen3:8b PL-full corrected repeats scored 5/11 and 5/11, gemma4-opencode:e4b PL-full scored 3/11 with no implementation file, and qwen3-opencode:30b solo passed 11/11. Earlier qwen3:8b PL-full 9/11 has not reproduced yet.
**Last update:** 2026-04-24

## Question

If we encode PL's discipline (decomposition, scoping, gates, retry loops) as top-level flow structure, can a weaker local model finish tasks it cannot finish solo? The area looks for a reproducible lift above each model's unaided ceiling — not parity with frontier models.

## What this area has measured (receipts)

- R1-A solo aider baseline on qwen3:8b E-SMALL timed out after 1800s and scored 1/11 — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1-B/R1-C corrected PL-full repeats on qwen3:8b E-SMALL scored 5/11 and 5/11; an uncorrected R1-B attempt is invalidated by CommonJS/ESM fixture hygiene — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1-D gemma4-opencode:e4b PL-full floor check scored 3/11 and produced no `csv2json.js`; `ollama ps` showed local partial-GPU placement at 68%/32% CPU/GPU — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1-E qwen3-opencode:30b solo ceiling remeasurement passed 11/11; `ollama ps` showed local partial-GPU placement at 15%/85% CPU/GPU — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R2-A qwen3:8b PL-lite on reconstructed H8 passed 4/4 with no retry and no completion gate — see [LIVE-NOTES.md](LIVE-NOTES.md)
- Earlier R1v3 PL-full run on qwen3:8b E-SMALL reached 9/11 after retry, but remains an unreproduced high outlier — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1..R10 experiment plan and success criteria — see [RESCUE-VIABILITY-PLAN.md](RESCUE-VIABILITY-PLAN.md)
- Sequencing, stop conditions, and falsification milestone — see [ROADMAP.md](ROADMAP.md)
- Run artifacts and fixtures — see [runs/](runs/), [fixtures/](fixtures/), [flows/](flows/)

## What is in flight

- R1 replications across models/seeds (bead prompt-b5eb); qwen3:8b PL-full rep 2/3 are now recorded
- R7 foreach-spawn variant blocked on runtime bug (bead prompt-zbpc)

## What is next (ordered)

1. R2-D solo qwen3:8b on the reconstructed H8 fixture, to compare against the 4/4 PL-lite result
2. Decide whether R2-B/R2-C add information; PL-lite already reached the oracle ceiling on this fixture
3. Defer R5/R6 multi-agent race work until R2 says the gate/retry path is load-bearing

## Known blockers

- aider defect B (bead prompt-7zyi)
- PL gate evaluator defect (bead prompt-0zn1)
- foreach-spawn child-index defect (bead prompt-nba9)

## Stop conditions

Copied from [ROADMAP.md](ROADMAP.md) falsification milestone: halt and re-plan if R1-A shows the solo arm reaching parity, if R2 ablation preserves the lift, or if three consecutive replications fail to reproduce the +4 assertion delta.

## Related

- Plan: [RESCUE-VIABILITY-PLAN.md](RESCUE-VIABILITY-PLAN.md), [ROADMAP.md](ROADMAP.md)
- Sibling areas: [../](../), [../../ecosystem-analysis/](../../ecosystem-analysis/), [../../harness-arena/](../../harness-arena/)
