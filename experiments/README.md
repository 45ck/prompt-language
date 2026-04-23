# experiments/ — research and showcase for prompt-language

This tree holds the research journey behind prompt-language: head-to-head
comparisons, factory runs, rescue probes, ecosystem surveys, and
self-hosting attempts. It is deliberately kept separate from `../docs/`
(governance, reference, ADRs — stable surface) and `../src/` (product
code). Everything here is dated, evidence-graded, and may still be wrong.

## If you are new, start here

- [The research journey](./JOURNEY.md) — linear 2026-04-14 → 2026-04-20 chronology.
- [The power of PL](./POWER-OF-PL.md) — capabilities demonstrated with receipts.
- [Current work-in-progress](./STATUS.md) — live snapshot of open beads.

## Experiment areas

Codenames come from [`EXPERIMENT-AREAS.md`](./EXPERIMENT-AREAS.md); directory
paths below are the **current** on-disk paths (the reorganisation in
[`REPO-JOURNEY-PLAN.md`](./REPO-JOURNEY-PLAN.md) has not yet run).

| Codename      | Dir                                                                                                                                                                                                                                                                            | Charter                                                                             | Status                                                             | Receipts                                                              | Next                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ladder        | [`aider-vs-pl/`](./aider-vs-pl/)                                                                                                                                                                                                                                               | Solo aider vs aider-under-PL at one fixed local model, rung-by-rung.                | H1-H10 locked (PL 6-0-3); H11-H20 queued, partial on H11/H14.      | [`SCORECARD.md`](./aider-vs-pl/SCORECARD.md)                          | [`phase2-design.md`](./aider-vs-pl/phase2-design.md) — H14 TDD run             |
| rescue        | [`aider-vs-pl/rescue-viability/`](./aider-vs-pl/rescue-viability/)                                                                                                                                                                                                             | Hold task, vary model capability x PL intensity; measure if PL lifts weaker models. | R1 first signal on qwen3:8b; replications needed.                  | [`LIVE-NOTES.md`](./aider-vs-pl/rescue-viability/LIVE-NOTES.md)       | [`ROADMAP.md`](./aider-vs-pl/rescue-viability/ROADMAP.md) — R1-A solo baseline |
| atlas         | [`ecosystem-analysis/`](./ecosystem-analysis/)                                                                                                                                                                                                                                 | Map the adjacent harness and orchestrator landscape.                                | Four write-ups complete (pi-mono, hermes-agent, openclaw, survey). | [`adjacent-ecosystem.md`](./ecosystem-analysis/adjacent-ecosystem.md) | pi-mono adapter impl                                                           |
| forge         | [`meta-factory/`](./meta-factory/)                                                                                                                                                                                                                                             | Can PL author PL, on a frozen runtime, with an authoritative gate.                  | Design done; M1 authored; live run blocked at preflight.           | [`meta-factory/README.md`](./meta-factory/README.md)                  | Level B port experiment                                                        |
| foundry       | [`full-saas-factory/`](./full-saas-factory/), [`marketing-factory/`](./marketing-factory/), [`full-sdlc-factory/`](./full-sdlc-factory/), [`website-factory/`](./website-factory/)                                                                                             | End-to-end product-build factories with solo comparator.                            | Multiple locked runs across E4/E7-MK/E8/E9.                        | [`e4-codex-crm-factory/`](./full-saas-factory/e4-codex-crm-factory/)  | Review run outputs                                                             |
| harness-arena | [`harness-arena-HA-E1-PLAN.md`](./harness-arena-HA-E1-PLAN.md) (dir being created)                                                                                                                                                                                             | Cloud-harness + frontier model vs PL + local model + task-tuned flow.               | HA-E1 pilot planned.                                               | plan doc                                                              | Ship oracle-isolation runner                                                   |
| crucible      | [`bounded-feature-benchmark/`](./bounded-feature-benchmark/), [`parallel-isolated-modules/`](./parallel-isolated-modules/), [`premature-stop-benchmark/`](./premature-stop-benchmark/), [`parallel-planning/`](./parallel-planning/), [`self-healing-ci/`](./self-healing-ci/) | Narrow stress tests isolating one DSL primitive.                                    | Scaffolded, no runs.                                               | mixed                                                                 | Consolidate and pick first proof                                               |

Evidence tiers per area are summarised in [`EXPERIMENT-AREAS.md`](./EXPERIMENT-AREAS.md) §5.

## Experiment catalog

Rows already locked in or actively running (preserved from the previous catalog; see [`CATALOG.md`](./CATALOG.md) for authoritative registry):

| ID     | Name                        | Domain                         | PL patterns                                                                  | Status          | Best result               |
| ------ | --------------------------- | ------------------------------ | ---------------------------------------------------------------------------- | --------------- | ------------------------- |
| E4     | CRM Factory                 | Enterprise SaaS                | spawn/await, foreach-spawn, race, retry, review                              | Complete        | —                         |
| E5     | Trace Verification          | Runtime provenance             | Z-series differential tests                                                  | Active          | —                         |
| E7     | Marketing Factory           | Marketing website              | spawn/await, foreach, retry, review                                          | Complete        | PL 30/30 × 3              |
| E8     | Website Factory             | Marketing website (enterprise) | spawn/await, foreach-spawn, race, retry, review, approve, try/catch, if/else | Run 1 done      | Factory 3/4, Solo 4/4     |
| H1-H10 | Aider vs PL                 | Coding assistant comparison    | Various                                                                      | Complete        | PL 6 – Solo 0 – Tie 3     |
| H11    | Multi-file refactor         | Rigor probe                    | retry, gate, review                                                          | Phases 2-5 done | qwen3-opencode:30b 2-3/12 |
| R1     | Rescue viability (qwen3:8b) | Small-model rescue             | retry + gate                                                                 | Run B logged    | 5/11 → 9/11 (N=1)         |
| —      | Premature Stop              | Reliability                    | stop hook                                                                    | Scaffold        | —                         |
| —      | Bounded Feature             | Implementation quality         | Various                                                                      | Scaffold        | —                         |
| —      | Parallel Planning           | Coordination                   | spawn/await                                                                  | Scaffold        | —                         |
| —      | Parallel Modules            | Build concurrency              | spawn/await                                                                  | Scaffold        | —                         |
| —      | Self-healing CI             | CI repair                      | retry, try/catch                                                             | Scaffold        | —                         |

Scaffolded non-factory experiments are grouped under [Non-Factory Proof Program](../docs/evaluation/non-factory-proof-program.md).

## How to reproduce the strongest claim right now

The cleanest locked result is **H2 gate-enforcement TDD** (solo 7/10,
PL 10/10 after three retries) on `qwen3-opencode:30b`. From the repo root:

```bash
# 1. Pull the model and confirm aider + ollama are live
ollama pull qwen3-opencode:30b
aider --version

# 2. Run the H2 PL flow via the published runtime
npx @45ck/prompt-language ci --runner aider \
  --file experiments/aider-vs-pl/fixtures/h14-tdd-red-green/task.flow

# 3. Check the oracle (should pass 10/10)
node experiments/aider-vs-pl/fixtures/h14-tdd-red-green/verify.js
```

Expected walltime: 4-8 minutes on a single RX 7600 XT. See
[`SCORECARD.md`](./aider-vs-pl/SCORECARD.md) for H1-H10 detail.

For the freshest (thin) signal, see R1 Run B in
[`rescue-viability/LIVE-NOTES.md`](./aider-vs-pl/rescue-viability/LIVE-NOTES.md).

## Navigation

- Proposed reorganisation: [`REPO-JOURNEY-PLAN.md`](./REPO-JOURNEY-PLAN.md)
- Area naming scheme: [`EXPERIMENT-AREAS.md`](./EXPERIMENT-AREAS.md)
- Experiment catalog: [`CATALOG.md`](./CATALOG.md)
- Design docs index: [`../docs/design/`](../docs/design/)
- DSL reference: [`../docs/reference/`](../docs/reference/)
- Roadmap for rescue program: [`aider-vs-pl/rescue-viability/ROADMAP.md`](./aider-vs-pl/rescue-viability/ROADMAP.md)
- Product face: [`../README.md`](../README.md)

## Contributing

Product contributions follow [`../CONTRIBUTING.md`](../CONTRIBUTING.md). The
research tree has its own conventions: every claim is dated, every scorecard
names its model and host, evidence tiers (strong / medium / thin) are
explicit, and speculation is kept out of locked results. If you add a run,
add a manifest and link it from the relevant area's receipts column.
