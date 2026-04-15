# Experiments

Controlled experiments comparing prompt-language factory workflows against solo prompting and alternative tools. Each experiment tests specific hypotheses about when structured supervision outperforms unstructured prompting.

For experiment design templates and methodology, see [experiments/templates/](../experiments/templates/).

## Experiment catalog

| ID  | Name               | Domain             | Status     | Summary                                                     |
| --- | ------------------ | ------------------ | ---------- | ----------------------------------------------------------- |
| E1  | Repeated Failure   | Reliability        | Complete   | Gate enforcement vs prompt-only completion                  |
| E4  | CRM Factory        | Enterprise SaaS    | Complete   | End-to-end CRM with spawn/await, foreach-spawn, race, retry |
| E5  | Trace Verification | Runtime provenance | Active     | Z-series differential tests proving live runtime execution  |
| E7  | Marketing Factory  | Marketing website  | Complete   | PL achieved 30/30 x3 vs solo 28.3/30 average                |
| E8  | Website Factory    | Enterprise website | Run 1 done | 6-phase enterprise build: Factory 3/4 vs Solo 4/4           |

## Comparison and benchmark experiments

| Name                                                          | Domain                      | Status   | Summary                                      |
| ------------------------------------------------------------- | --------------------------- | -------- | -------------------------------------------- |
| [Aider vs PL](../experiments/aider-vs-pl/SCORECARD.md)        | Coding assistant comparison | Complete | Head-to-head across 10 hypotheses            |
| [Premature Stop](../experiments/premature-stop-benchmark/)    | Reliability                 | Scaffold | Repeated-stop and premature-exit comparisons |
| [Bounded Feature](../experiments/bounded-feature-benchmark/)  | Implementation quality      | Scaffold | Bounded implementation quality benchmarks    |
| [Parallel Planning](../experiments/parallel-planning/)        | Coordination                | Scaffold | Plan quality and coordination experiments    |
| [Parallel Modules](../experiments/parallel-isolated-modules/) | Build concurrency           | Scaffold | Isolated module build concurrency            |
| [Self-healing CI](../experiments/self-healing-ci/)            | CI repair                   | Scaffold | CI repair and auto-fix via retry/try-catch   |

## Detailed experiment descriptions

### E1: Repeated Failure

Tests whether verification gates catch failures that prompt-only workflows miss. Located in [experiments/eval/e1-repeated-failure/](../experiments/eval/e1-repeated-failure/) and [experiments/results/e1-repeated-failure/](../experiments/results/e1-repeated-failure/).

### E4: CRM Factory

End-to-end SaaS product factory generating a CRM application with entity generation, CRUD scaffolding, and deployment configuration. Uses spawn/await for parallel module builds. Located in [experiments/full-saas-factory/](../experiments/full-saas-factory/).

### E5: Trace Verification

Differential tests (Z-series) that prove the runtime is executing live, not replaying recorded outputs. Each test depends on fresh UUIDs, real child PIDs, capture-gated branches, or hash-matched send/receive payloads. See [docs/thesis-verification.md](thesis-verification.md) and [docs/tracing-and-provenance.md](tracing-and-provenance.md).

### E7: Marketing Factory

Marketing website generation comparing PL factory against solo prompting. PL achieved perfect 30/30 scores across three consecutive runs versus a solo average of 28.3/30. Located in [experiments/marketing-factory/](../experiments/marketing-factory/).

### E8: Website Factory

Enterprise 6-phase website build: discovery, architecture, design system, implementation, QA, release. Uses 22 flow files and 8 reusable libraries with specialized agent assignments. Compares PL factory (Astro, 30 files, 12 docs) against solo (Next.js, 14 files). Run 1 scorecard: [experiments/website-factory/results/run1-scorecard.md](../experiments/website-factory/results/run1-scorecard.md). Located in [experiments/website-factory/](../experiments/website-factory/).

### Aider vs PL

Head-to-head comparison of Aider coding assistant against prompt-language across 10 hypotheses. [Scorecard](../experiments/aider-vs-pl/SCORECARD.md). Located in [experiments/aider-vs-pl/](../experiments/aider-vs-pl/).

### Meta Factory

Meta-level experiments: factories that generate factories. Explores self-hosting and recursive flow generation. Located in [experiments/meta-factory/](../experiments/meta-factory/).

### Full SDLC Factory

Full software development lifecycle factory with QA-heavy variant. Located in [experiments/full-sdlc-factory/](../experiments/full-sdlc-factory/).

## Supporting infrastructure

| Directory                                           | Purpose                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| [experiments/eval/](../experiments/eval/)           | Shared rubrics, scoring scripts, and evaluation helpers                          |
| [experiments/results/](../experiments/results/)     | Run outputs, scores, and analysis artifacts                                      |
| [experiments/templates/](../experiments/templates/) | Reusable experiment design templates (hypothesis, methodology, metrics, results) |

## Evaluation and evidence

For evaluation methodology, A/B results, and parity matrices, see:

- [Evaluation results](evaluation/eval-analysis.md)
- [What works now](evaluation/what-works-now.md)
- [Eval parity matrix](evaluation/eval-parity-matrix.md)
- [Thesis](strategy/thesis.md) and [thesis roadmap](strategy/thesis-roadmap.md)
