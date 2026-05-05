<!-- cspell:ignore FSCRUD fscrud Ollama qwen ranker superbrain metacognitive -->

# Evidence Snapshot: 2026-05-06

This is the short evidence boundary after the local-model FSCRUD R30-R45 sequence.
It separates what prompt-language has actually shown from what remains a thesis.

## Highest-Confidence Claims

| Claim                                                                               | Strength      | Evidence                                                                                                                                     | Boundary                                                                                              |
| ----------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Prompt-language is a useful verification-first supervision runtime.                 | Strong        | Shipped runtime primitives, real gates, review loops, retry, state, CI, and passing repo `npm run ci`.                                       | This is a product/runtime claim, not proof that PL is a primary engineering medium.                   |
| Gates and retry improve work when failures are externally checkable.                | Strong        | E1 seed, E7-MK `30/30 x3`, Aider-vs-PL H-series, and current CI/eval infrastructure.                                                         | Best for bounded tasks with deterministic oracles; not a blanket speed win.                           |
| PL improves auditability and process fidelity even when direct Codex is faster.     | Medium-strong | E4 CRM factory batches: direct Codex faster, PL stronger on factory-quality/process evidence.                                                | Does not claim PL is faster or always better.                                                         |
| Local 30B Ollama models can be useful inside PL as bounded selector/ranker modules. | Medium        | FSCRUD R40-R45 all reached `100/100` treatment passes when local ownership was reduced to bounded choices/rankings/rationales/risk response. | Deterministic tooling owned product behavior, rich prose, schema repair, rendering, and verification. |
| Deterministic scaffolds and gates can isolate local-model bottlenecks.              | Medium        | FSCRUD R30-R35 moved failures from export shape to executable domain behavior, UI surface, server/docs/handoff, and shape compliance.        | Diagnostic value is strong; it did not prove local full-stack implementation.                         |

## What FSCRUD Proved

FSCRUD did not prove "local model builds the full CRUD app when prompted better."

The R-series evidence supports a narrower, more useful conclusion:

- R30-R32 showed local natural-language control did not move `qwen3-opencode-big:30b`
  past executable domain/UI behavior reliably.
- R31 proved the deterministic domain kernel and verifier are valid.
- R34 proved constrained local server integration can pass when domain, UI, and
  handoff artifacts are protected.
- R35-R39 showed local free-form artifact/schema/senior-plan authoring remains
  brittle or shallow.
- R40-R45 showed a working pattern: local inference can select, rank, attach bounded
  rationale, and choose a bounded risk response when criteria and vocabularies are
  explicit and deterministic tooling validates the output.

The practical architecture that emerges is:

```text
local model = bounded semantic selector / ranker / rationale source
PL runtime = deterministic validator, normalizer, renderer, gate runner, evidence recorder
frontier model = optional hybrid reviewer/escalation path for high-ambiguity work
```

## What Is Not Proven

| Unsupported or weak claim                                        | Current evidence gap                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Local models can autonomously implement the full FSCRUD product. | The strongest local implementation attempts failed on executable domain behavior, UI surface, artifact following, or schema/shape discipline. |
| More senior-engineer prose alone solves local-model failures.    | Dense senior prompts stalled or produced shallow/generic plans; R39 failed the quality scorer.                                                |
| PL is always faster.                                             | E4 showed direct Codex faster on the bounded CRM slice; local Ollama runs are intentionally slow.                                             |
| PL is already a primary engineering medium.                      | We have supervision/runtime evidence, not evidence that engineers prefer or mostly edit PL artifacts instead of code.                         |
| Multi-agent local inference is a speed primitive on this host.   | Single-GPU local model use is queue-bound; parallelism is currently more useful for isolation/review than throughput.                         |

## Roadmap Implications

The next valuable work is not another deterministic-protected R46 that only repeats
the selector result. The next evidence should increase one of these responsibilities:

1. **Local product ownership, one small slice at a time.** Give the local model a tiny
   executable implementation responsibility with deterministic gates and compare it
   against the selector-only pattern.
2. **Hybrid routing.** Keep local models for bounded bulk/selection work and escalate
   only high-ambiguity review, root-cause analysis, or risky implementation decisions
   to a frontier model.
3. **Claim-grade repetition.** Repeat the strongest bounded local selector/risk
   pattern across tasks or seeds, not just one FSCRUD fixture.
4. **Evidence packaging.** Promote curated summaries and manifests; keep raw run
   bundles out of normal docs and commits.

## Recommended Next Experiments

| Next experiment                                                          | Why                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| FSCRUD tiny local implementation slice                                   | Tests whether local ownership can expand beyond selection without reintroducing domain/UI collapse.    |
| Hybrid reviewer/escalation arm                                           | Tests the user's local-bulk plus frontier-superbrain strategy without contaminating local-only claims. |
| Cross-domain bounded selector batch                                      | Tests whether R40-R45 generalize beyond one FSCRUD task.                                               |
| Senior Pairing Protocol rerun with bounded implementation responsibility | Tests metacognitive supervision as executable structure instead of longer senior prose.                |

The first implementation-slice plan is now predeclared at
[`experiments/fullstack-crud-comparison/docs/tiny-local-implementation-slice-plan.md`](../../experiments/fullstack-crud-comparison/docs/tiny-local-implementation-slice-plan.md).

## Current Bottom Line

Prompt-language is not just "writing prompts better." The proven value is moving
work out of fragile prompt prose into executable control: gates, retries, bounded
outputs, deterministic normalization, protected artifacts, and traceable evidence.

The strongest local-model pattern right now is **local semantic judgment inside a
deterministic PL envelope**, not autonomous local software engineering.
