# atlas — position PL in the OSS coding-agent landscape, identify adapter targets and threats

**Status:** Four landscape docs on disk; pi-mono adapter plan drafted, implementation not started
**Last update:** 2026-04-20

## Question
Where does prompt-language sit in the open-source coding-agent landscape, which projects are plausible adapter targets (so PL flows can drive their runners), and which ones occupy the same quadrant and therefore threaten PL's positioning? The output is a short, decision-ready map, not a survey.

## What this area has measured (receipts)
- pi-mono survey and adapter fit — see [pi-mono.md](pi-mono.md)
- hermes-agent survey — see [hermes-agent.md](hermes-agent.md)
- openclaw survey — see [openclaw.md](openclaw.md)
- Adjacent-ecosystem scan (LangGraph, OpenHands, and others) — see [adjacent-ecosystem.md](adjacent-ecosystem.md)

## What is in flight
- pi-mono runner adapter plan (bead prompt-lmas) — see [../pi-mono-RUNNER-PLAN.md](../pi-mono-RUNNER-PLAN.md)

## What is next (ordered)
1. Implement pi-mono adapter, Phase 1 ollama-only (bead prompt-lmas)
2. OpenHands feasibility spike (bead prompt-pm17)
3. Quarterly reassessment of the LangGraph quadrant overlap

## Known blockers
- None on the infra side; all adapter implementations are green-field

## Threat callout
LangGraph occupies the same flow-orchestration quadrant as PL. Tracked in [adjacent-ecosystem.md](adjacent-ecosystem.md) with a quarterly reassessment cadence so repositioning remains evidence-driven rather than reactive.

## Related
- Plan: [../pi-mono-RUNNER-PLAN.md](../pi-mono-RUNNER-PLAN.md)
- Sibling areas: [../aider-vs-pl/](../aider-vs-pl/), [../aider-vs-pl/rescue-viability/](../aider-vs-pl/rescue-viability/), [../harness-arena/](../harness-arena/)
