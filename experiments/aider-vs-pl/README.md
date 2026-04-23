# ladder — rung-by-rung solo-vs-PL comparison at fixed model to measure PL's lift per mechanism

**Status:** Frontier rungs complete (H1..H10 6-0-3); H11 local-model viability closed 2-3/12; H12..H20 fixtures unrun
**Last update:** 2026-04-20

## Question

At a fixed model, when does wrapping the same task in a prompt-language flow beat invoking a solo coding agent directly, and which flow mechanism (decomposition, TDD, scoping, gates, pipelines) is doing the work? Each rung isolates one mechanism on one task shape.

## What this area has measured (receipts)

- H1..H10 frontier-model scorecard, 6 PL wins / 0 losses / 3 ties — see [SCORECARD.md](SCORECARD.md)
- H11 local-model viability, 2 wins / 3 losses across 12 fixture phases — see [LOCAL-MODEL-VIABILITY-FINDINGS.md](LOCAL-MODEL-VIABILITY-FINDINGS.md)
- Per-rung run artifacts H1..H10 and H11 phases 2-5 — see [results/](results/)
- Today's OpenCode / Next.js session observations — see [SESSION-2026-04-20-OPENCODE-NEXTJS.md](SESSION-2026-04-20-OPENCODE-NEXTJS.md)
- Triage and evidence consolidation — see [AIDER-P1-TRIAGE.md](AIDER-P1-TRIAGE.md), [EVIDENCE-CONSOLIDATION.md](EVIDENCE-CONSOLIDATION.md)

## What is in flight

- H12..H20 fixtures authored but unrun; no owner assigned
- Partial H14 (TDD) data captured under [results/h14-tdd-fixed/](results/h14-tdd-fixed/)

## What is next (ordered)

1. H14 TDD — complete the run using existing partial data
2. H12 security rung — new task shape
3. H15 API-endpoint rung

## Known blockers

- aider defect B (bead prompt-7zyi)
- aider defect A (bead prompt-g64k)

## Related

- Plan: [GUIDE-AND-ROADMAP.md](GUIDE-AND-ROADMAP.md)
- Sibling areas: [rescue-viability/](rescue-viability/), [../ecosystem-analysis/](../ecosystem-analysis/), [../harness-arena/](../harness-arena/)
