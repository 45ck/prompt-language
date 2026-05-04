# harness-arena — compare whole stacks: vanilla cloud harness + frontier model vs PL + local model + task-tuned flow

**Status:** Planned. HA-E1 and HA-HR1 pilots not yet run; a dry-run runner
skeleton exists, but live local/frontier execution is not implemented.
**Last update:** 2026-05-04

## Question

When you compare complete stacks rather than isolated mechanisms — a vanilla cloud harness driving a frontier model vs prompt-language driving a local model through a task-tuned flow — which stack wins on which task shapes, and at what dollar and wall-clock cost? The ladder isolates mechanisms; this area asks the whole-stack question.

## What this area has measured (receipts)

- None yet; pilot HA-E1 has not been run.

## What is in flight

- HA-HR1 dry-run runner skeleton — see [runner.mjs](runner.mjs)
- HA-E1 pilot plan — see [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- HA-HR1 hybrid routing plan — see [hybrid-model-routing.md](hybrid-model-routing.md)
- Synthetic v2 manifest schema smoke coverage — see
  [hybrid-routing-manifest.schema.test.mjs](hybrid-routing-manifest.schema.test.mjs)
- Static-split team-flow scaffolds — see [flows/](flows/)
- Team runbook — see [TEAM-OF-AGENTS-RUNBOOK.md](TEAM-OF-AGENTS-RUNBOOK.md)

## What is next (ordered)

1. Validate the HA-HR1 dry-run manifests with
   `node experiments/harness-arena/runner.mjs --dry-run --run-id HA-HR1-structure-001 --output-root .tmp/harness-arena`
2. Replace the synthetic lanes with live local/frontier invocations while
   preserving workspace/oracle isolation
3. Run HA-HR1 across local-only, frontier-only, advisor-only, and hybrid-router arms
4. Run HA-E1 pilot under a $5 budget cap
5. Write up findings and decide whether to scale

## Known blockers

- HA-HR1 still depends on live model execution and real verifier/oracle wiring
  before claims can be made.
- Dry-run manifests intentionally set `oracle.passed=false`; they validate
  structure only and are not model-performance evidence.
- The checked-in flows are scaffolds for orchestration shape, not completed evidence.

## Related

- Plan: [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- Hybrid routing plan: [hybrid-model-routing.md](hybrid-model-routing.md)
- Operator guide: [../../docs/guides/team-of-agents.md](../../docs/guides/team-of-agents.md)
- Sibling areas: [../aider-vs-pl/](../aider-vs-pl/), [../aider-vs-pl/rescue-viability/](../aider-vs-pl/rescue-viability/), [../ecosystem-analysis/](../ecosystem-analysis/)
