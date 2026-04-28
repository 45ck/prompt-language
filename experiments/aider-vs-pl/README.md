# ladder — rung-by-rung solo-vs-PL comparison at fixed model to measure PL's lift per mechanism

**Status:** Frontier rungs complete (H1..H10 6-0-3); local H11-H15 evidence is mixed; H16-H20 fixtures remain unrun
**Last update:** 2026-04-28

## Question

At a fixed model, when does wrapping the same task in a prompt-language flow beat invoking a solo coding agent directly, and which flow mechanism (decomposition, TDD, scoping, gates, pipelines) is doing the work? Each rung isolates one mechanism on one task shape.

## What this area has measured (receipts)

- H1..H10 frontier-model scorecard, 6 PL wins / 0 losses / 3 ties — see [SCORECARD.md](SCORECARD.md)
- H11 local-model viability, 2 wins / 3 losses across 12 fixture phases — see [LOCAL-MODEL-VIABILITY-FINDINGS.md](LOCAL-MODEL-VIABILITY-FINDINGS.md)
- 2026-04-28 local-model reruns: H12 clean tie (`8/9` vs `8/9`), H14 clean solo win (`8/8` vs `6/8`), H15 clean PL win (`10/10` vs `6/10`) — see [results/2026-04-28-local-model-experiments.md](results/2026-04-28-local-model-experiments.md)
- Per-rung run artifacts H1..H10 and H11 phases 2-5 — see [results/](results/)
- Today's OpenCode / Next.js session observations — see [SESSION-2026-04-20-OPENCODE-NEXTJS.md](SESSION-2026-04-20-OPENCODE-NEXTJS.md)
- Triage and evidence consolidation — see [AIDER-P1-TRIAGE.md](AIDER-P1-TRIAGE.md), [EVIDENCE-CONSOLIDATION.md](EVIDENCE-CONSOLIDATION.md)

## What is in flight

- H16..H20 fixtures authored but unrun; no owner assigned
- H14 flow redesign is next because the 2026-04-28 clean run showed the current TDD flow over-stages and fails to feed oracle output back into repair.
- Hybrid local/frontier model routing is now planned under [../harness-arena/hybrid-model-routing.md](../harness-arena/hybrid-model-routing.md).

## What is next (ordered)

1. H14 TDD — revise the flow to require the `mergeDuplicates` import, explicit field-merge assertions, and an oracle-fed repair loop.
2. H11 — add no-edit/timeout classification or split the first PL prompt into smaller file groups.
3. H16-H20 — run the remaining fixtures only after the harness classification is stable.

## Known blockers

- Local model capture latency and no-edit classifications are still measurement risks.
- Single-GPU Ollama runs should not be parallelized when wall-time or GPU-active-time matters.

## Related

- Plan: [GUIDE-AND-ROADMAP.md](GUIDE-AND-ROADMAP.md)
- Sibling areas: [rescue-viability/](rescue-viability/), [../ecosystem-analysis/](../ecosystem-analysis/), [../harness-arena/](../harness-arena/)
