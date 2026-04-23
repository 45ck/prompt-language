# harness-arena — compare whole stacks: vanilla cloud harness + frontier model vs PL + local model + task-tuned flow

**Status:** Stub. HA-E1 pilot planned, not yet run; runner not yet implemented
**Last update:** 2026-04-20

## Question

When you compare complete stacks rather than isolated mechanisms — a vanilla cloud harness driving a frontier model vs prompt-language driving a local model through a task-tuned flow — which stack wins on which task shapes, and at what dollar and wall-clock cost? The ladder isolates mechanisms; this area asks the whole-stack question.

## What this area has measured (receipts)

- None yet; pilot HA-E1 has not been run.

## What is in flight

- HA-E1 pilot plan — see [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- Runner spec spawned from today's planning session (not yet on disk as a design doc)

## What is next (ordered)

1. Implement `runner.mjs` in this directory: whitelist-copy plus leak-audit (blocker for HA-E1)
2. Run HA-E1 pilot under a $5 budget cap
3. Write up HA-E1 findings and decide whether to scale to HA-E2

## Known blockers

- None new; depends on the oracle-isolation runner being shipped first

## Related

- Plan: [../harness-arena-HA-E1-PLAN.md](../harness-arena-HA-E1-PLAN.md)
- Sibling areas: [../aider-vs-pl/](../aider-vs-pl/), [../aider-vs-pl/rescue-viability/](../aider-vs-pl/rescue-viability/), [../ecosystem-analysis/](../ecosystem-analysis/)
