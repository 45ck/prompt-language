# Experiments

This directory holds the research and evaluation scaffold for controlled prompt-language experiments.

## Experiment Catalog

| ID  | Name               | Domain                         | PL Patterns                                                                                    | Status     | Best Result           |
| --- | ------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------- | ---------- | --------------------- |
| E4  | CRM Factory        | Enterprise SaaS                | spawn/await, foreach-spawn, race, retry, review                                                | Complete   | —                     |
| E5  | Trace Verification | Runtime provenance             | Z-series differential tests                                                                    | Active     | —                     |
| E7  | Marketing Factory  | Marketing website              | spawn/await, foreach, retry, review                                                            | Complete   | PL 30/30 x3           |
| E8  | Website Factory    | Marketing website (enterprise) | spawn/await, foreach-spawn, race, retry, review, approve, try/catch, if/else, remember, import | Run 1 done | Factory 3/4, Solo 4/4 |
| —   | Aider vs PL        | Coding assistant comparison    | Various                                                                                        | Complete   | See scorecard         |
| —   | Premature Stop     | Reliability                    | stop hook                                                                                      | Scaffold   | —                     |
| —   | Bounded Feature    | Implementation quality         | Various                                                                                        | Scaffold   | —                     |
| —   | Parallel Planning  | Coordination                   | spawn/await                                                                                    | Scaffold   | —                     |
| —   | Parallel Modules   | Build concurrency              | spawn/await                                                                                    | Scaffold   | —                     |
| —   | Self-healing CI    | CI repair                      | retry, try/catch                                                                               | Scaffold   | —                     |

These scaffolded non-factory experiments are now grouped under the evaluation
note [Non-Factory Proof Program](../docs/evaluation/non-factory-proof-program.md).
Treat them as the next bounded proof layer after the current factory evidence,
not as disconnected placeholders.

## Structure

```text
experiments/
  website-factory/          # E8: Enterprise multi-phase website generation
  marketing-factory/        # E7: Marketing website PL vs solo
  aider-vs-pl/             # Aider coding assistant comparison
  full-saas-factory/       # E4: Full SaaS product factory
    e4-codex-crm-factory/
  meta-factory/            # Meta-level factory experiments
  premature-stop-benchmark/
  bounded-feature-benchmark/
  parallel-planning/
  parallel-isolated-modules/
  self-healing-ci/
  eval/
  results/
  templates/
```

## Detailed Descriptions

- **`website-factory/`** (E8) — Enterprise 6-phase website build: discovery → architecture → design system → implementation → QA → release. 22 flow files, 8 reusable libraries, specialized agent assignments. Compares PL factory (Astro, 30 files, 12 docs) vs solo (Next.js, 14 files). [Results](website-factory/results/run1-scorecard.md)
- **`marketing-factory/`** (E7) — Marketing website generation comparing PL factory vs solo prompt. PL achieved perfect 30/30 across 3 runs vs solo average 28.3/30. [Scorecard](marketing-factory/)
- **`aider-vs-pl/`** — Head-to-head comparison of Aider coding assistant vs prompt-language across 10 hypotheses. [Scorecard](aider-vs-pl/SCORECARD.md)
- **`full-saas-factory/`** (E4) — End-to-end CRM product factory with entity generation, CRUD scaffolding, and deployment config.
- **`meta-factory/`** — Meta-level experiments: factories that generate factories.
- `premature-stop-benchmark/` — Repeated-stop and premature-exit comparisons
- `bounded-feature-benchmark/` — Bounded implementation benchmarks
- `parallel-planning/` — Plan quality and coordination experiments
- `parallel-isolated-modules/` — Isolated module/build concurrency experiments
- `self-healing-ci/` — CI repair and auto-fix experiments
- `eval/` — Shared rubrics, scoring scripts, and evaluation helpers
- `results/` — Run outputs, scores, and analysis artifacts
- `templates/` — Reusable experiment design docs

## Current next step

The repo's next experiment priority is **non-factory proof work**:

- close runtime-truth gaps with narrower falsifiers
- convert smoke-only signals into repeatable differential evidence
- run bounded QA/outcome benchmarks such as premature-stop, bounded feature,
  parallel planning, and self-healing CI

See [docs/evaluation/non-factory-proof-program.md](../docs/evaluation/non-factory-proof-program.md).
