# rescue — does PL's top-level wisdom lift lower-capability models above their solo ceiling

**Status:** R1-A solo baseline timed out at 1/11; R1v3 PL-full produced 9/11 after retry on qwen3:8b E-SMALL.
**Last update:** 2026-04-24

## Question

If we encode PL's discipline (decomposition, scoping, gates, retry loops) as top-level flow structure, can a weaker local model finish tasks it cannot finish solo? The area looks for a reproducible lift above each model's unaided ceiling — not parity with frontier models.

## What this area has measured (receipts)

- R1-A solo aider baseline on qwen3:8b E-SMALL timed out after 1800s and scored 1/11 — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1v3 PL-full run on qwen3:8b E-SMALL reached 9/11 after retry — see [LIVE-NOTES.md](LIVE-NOTES.md)
- R1..R10 experiment plan and success criteria — see [RESCUE-VIABILITY-PLAN.md](RESCUE-VIABILITY-PLAN.md)
- Sequencing, stop conditions, and falsification milestone — see [ROADMAP.md](ROADMAP.md)
- Run artifacts and fixtures — see [runs/](runs/), [fixtures/](fixtures/), [flows/](flows/)

## What is in flight

- R1 replications across models/seeds (bead prompt-b5eb)
- R7 foreach-spawn variant blocked on runtime bug (bead prompt-zbpc)

## What is next (ordered)

1. R1-B and R1-C PL-full replications to establish whether the 9/11 result reproduces
2. Additional solo repeat if the R1-A timeout looks like a one-off runner/model stall
3. R2 ablation — remove top-level wisdom and re-run

## Known blockers

- aider defect B (bead prompt-7zyi)
- PL gate evaluator defect (bead prompt-0zn1)
- foreach-spawn child-index defect (bead prompt-nba9)

## Stop conditions

Copied from [ROADMAP.md](ROADMAP.md) falsification milestone: halt and re-plan if R1-A shows the solo arm reaching parity, if R2 ablation preserves the lift, or if three consecutive replications fail to reproduce the +4 assertion delta.

## Related

- Plan: [RESCUE-VIABILITY-PLAN.md](RESCUE-VIABILITY-PLAN.md), [ROADMAP.md](ROADMAP.md)
- Sibling areas: [../](../), [../../ecosystem-analysis/](../../ecosystem-analysis/), [../../harness-arena/](../../harness-arena/)
