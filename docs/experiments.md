# Experiments

This is the docs entry point for prompt-language evidence and experiments. It keeps
the product README clean: stable usage docs stay in guides/reference, while
measurements, hypotheses, caveats, and raw run artifacts live here or under
[`../experiments/`](../experiments/).

For the current short answer to "what works now?", start with
[What Works Now](evaluation/what-works-now.md). For the raw research tree, run
catalog, and dated receipts, see [`../experiments/README.md`](../experiments/README.md).
For experiment design templates and methodology, see
[`../experiments/templates/`](../experiments/templates/).

## Boundaries

- Product guarantees belong in [guides/](guides/index.md) and
  [reference/](reference/index.md), not in experiment notes.
- Current evidence and caveats belong in [evaluation/](evaluation/index.md).
- Experiment designs, raw outputs, scorecards, and research work-in-progress belong
  in [`../experiments/`](../experiments/).
- External research synthesis belongs in [research/](research/README.md).

## Experiment catalog

| ID  | Name               | Domain             | Status     | Summary                                                     |
| --- | ------------------ | ------------------ | ---------- | ----------------------------------------------------------- |
| E1  | Repeated Failure   | Reliability        | Complete   | Gate enforcement vs prompt-only completion                  |
| E4  | CRM Factory        | Enterprise SaaS    | Complete   | End-to-end CRM with spawn/await, foreach-spawn, race, retry |
| E5  | Trace Verification | Runtime provenance | Active     | Z-series differential tests proving live runtime execution  |
| E7  | Marketing Factory  | Marketing website  | Complete   | PL achieved 30/30 x3 vs solo 28.3/30 average                |
| E8  | Website Factory    | Enterprise website | Run 1 done | 6-phase enterprise build: Factory 3/4 vs Solo 4/4           |

## Comparison and benchmark experiments

| Name                                                          | Domain                      | Status   | Summary                                       |
| ------------------------------------------------------------- | --------------------------- | -------- | --------------------------------------------- |
| [Aider vs PL](../experiments/aider-vs-pl/SCORECARD.md)        | Coding assistant comparison | Complete | Head-to-head across 10 hypotheses             |
| [Full-stack CRUD](../experiments/fullstack-crud-comparison/)  | Local-model product build   | Active   | Local Ollama vs PL domain/control diagnostics |
| [Harness Arena](../experiments/harness-arena/)                | Local/frontier routing      | Planned  | Hybrid routing and provider-boundary pilots   |
| [Senior Pairing](../experiments/senior-pairing-protocol/)     | Local-model supervision     | Planned  | Senior-engineer supervision flow program      |
| [Premature Stop](../experiments/premature-stop-benchmark/)    | Reliability                 | Scaffold | Repeated-stop and premature-exit comparisons  |
| [Bounded Feature](../experiments/bounded-feature-benchmark/)  | Implementation quality      | Scaffold | Bounded implementation quality benchmarks     |
| [Parallel Planning](../experiments/parallel-planning/)        | Coordination                | Scaffold | Plan quality and coordination experiments     |
| [Parallel Modules](../experiments/parallel-isolated-modules/) | Build concurrency           | Scaffold | Isolated module build concurrency             |
| [Self-healing CI](../experiments/self-healing-ci/)            | CI repair                   | Scaffold | CI repair and auto-fix via retry/try-catch    |

The next planned wave is documented in
[Non-Factory Proof Program](evaluation/non-factory-proof-program.md). That note
sequences the repo's next proof work around runtime truth, QA lift, and bounded
outcome lift rather than defaulting to larger factory claims.

The broader experiment-area map is maintained in
[`../experiments/README.md`](../experiments/README.md) and
[`../experiments/EXPERIMENT-AREAS.md`](../experiments/EXPERIMENT-AREAS.md).

## Detailed experiment descriptions

### E1: Repeated Failure

Tests whether verification gates catch failures that prompt-only workflows miss. Located in [experiments/eval/e1-repeated-failure/](../experiments/eval/e1-repeated-failure/) and [experiments/results/e1-repeated-failure/](../experiments/results/e1-repeated-failure/).

### E4: CRM Factory

End-to-end SaaS product factory generating a CRM application with entity generation, CRUD scaffolding, and deployment configuration. Uses spawn/await for parallel module builds. Located in [experiments/full-saas-factory/](../experiments/full-saas-factory/).

### E5: Trace Verification

Differential tests (Z-series) that prove the runtime is executing live, not replaying recorded outputs. Each test depends on fresh UUIDs, real child PIDs, capture-gated branches, or hash-matched send/receive payloads. See [docs/thesis-verification.md](thesis-verification.md) and [docs/tracing-and-provenance.md](tracing-and-provenance.md).

The repo also carries a smaller bounded runtime-proof series under
[experiments/results/factory-runtime-proof/](../experiments/results/factory-runtime-proof/)
that exercises the CRM discovery slice through the same PL runtime-backed
Claude/Codex paths. The current committed evidence is asymmetric: `20260418-083500`
is the clean bounded Codex proof through `await all` and `review`, while
`20260418-074500` is the latest Claude terminal bundle but closes with both
spawned children failed. That series is useful as execution evidence, but it is
not an end-to-end factory completion claim on both hosts. Use `20260418-083500`
when the point is the clean bounded completion datapoint and `20260418-074500`
when the point is the latest provenance-backed Claude runner evidence, including
the historical await-integrity gap it exposed. See
[2026-04-18 Runtime Factory Proof: Codex + Claude, Medium Effort](evaluation/2026-04-18-runtime-factory-proof-codex-claude-medium-evidence.md).

### Non-factory proof program

The repo's next proof layer is intentionally not another giant factory.

The current planned sequence is:

- runtime-truth reruns and falsifiers
- repeated differential proof
- bounded QA and outcome-lift benchmarks

See [Non-Factory Proof Program](evaluation/non-factory-proof-program.md).

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
