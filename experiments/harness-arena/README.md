# harness-arena — compare whole stacks: vanilla cloud harness + frontier model vs PL + local model + task-tuned flow

**Status:** Planned. HA-E1 and HA-HR1 pilots not yet run; runner not yet implemented.
**Last update:** 2026-05-04

## Question

When you compare complete stacks rather than isolated mechanisms — a vanilla cloud harness driving a frontier model vs prompt-language driving a local model through a task-tuned flow — which stack wins on which task shapes, and at what dollar and wall-clock cost? The ladder isolates mechanisms; this area asks the whole-stack question.

## What this area has measured (receipts)

- None yet; pilot HA-E1 has not been run.

## What is in flight

- HA-E1 pilot plan — see [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- HA-HR1 hybrid routing plan — see [hybrid-model-routing.md](hybrid-model-routing.md)
- Static-split team-flow scaffolds — see [flows/](flows/)
- Team runbook — see [TEAM-OF-AGENTS-RUNBOOK.md](TEAM-OF-AGENTS-RUNBOOK.md)

## What is next (ordered)

1. Implement `runner.mjs` in this directory: whitelist-copy plus leak-audit (blocker for HA-E1 and HA-HR1)
2. Validate the HA-HR1 manifest schema against one synthetic manifest
3. Run HA-HR1 across local-only, frontier-only, advisor-only, and hybrid-router arms
4. Run HA-E1 pilot under a $5 budget cap
5. Write up findings and decide whether to scale

## Known blockers

- HA-HR1 still depends on the oracle-isolation runner before claims can be made.
- The checked-in flows are scaffolds for orchestration shape, not completed evidence.

## Related

- Plan: [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- Hybrid routing plan: [hybrid-model-routing.md](hybrid-model-routing.md)
- Operator guide: [../../docs/guides/team-of-agents.md](../../docs/guides/team-of-agents.md)
- Sibling areas: [../aider-vs-pl/](../aider-vs-pl/), [../aider-vs-pl/rescue-viability/](../aider-vs-pl/rescue-viability/), [../ecosystem-analysis/](../ecosystem-analysis/)
