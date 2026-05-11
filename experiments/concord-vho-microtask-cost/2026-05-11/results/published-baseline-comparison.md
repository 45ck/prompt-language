---
title: Published-baseline comparison — does v2's 100/100 survive scrutiny?
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11 (evening, post-adversarial review)
purpose: test whether the v2 100/100 micro-task headline is meaningful or just the expected mode of qwen3-coder:30b
---

# Published-baseline comparison

After adversarial review of the 2026-05-11 research synthesis, the
"100/100 at k=10" headline needed comparison against qwen3-coder:30b's
published benchmark numbers. If the model already scores ~95% on
standard small-function benchmarks, our 10/10 is the expected mode,
not a finding.

## Published numbers for qwen3-coder:30b (and nearest siblings)

Sources: Qwen3 tech report (arxiv:2505.09388), llm-stats compare,
Hugging Face model card, artificialanalysis.ai.

| Benchmark            | Number | Variant                                                                                         |
| -------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| HumanEval pass@1     | ~92.7% | Qwen2.5-Coder-32B-Instruct (older sibling; Qwen3-Coder-30B-A3B-Instruct positioned as stronger) |
| EvalPlus aggregate   | 71.45  | Qwen3-30B-A3B base (not Coder)                                                                  |
| MBPP pass@1          | 74.40  | Qwen3-30B-A3B base                                                                              |
| MultiPL-E avg pass@1 | 66.53  | Qwen3-30B-A3B base                                                                              |
| LiveCodeBench v6     | 66.0%  | Qwen3-Coder-30B-A3B-Instruct                                                                    |
| SWE-Bench Verified   | 51.6%  | Qwen3-Coder-30B-A3B-Instruct (OpenHands, 100 turns)                                             |
| CRUX-O               | 67.20  | base                                                                                            |

Qwen has not published clean per-benchmark numbers for the Coder-
30B-A3B-Instruct variant specifically. The closest credible anchor
is Qwen2.5-Coder-32B's HumanEval = 92.7%, with Qwen3-Coder
positioned as stronger.

## Statistical reading

At a true per-task pass rate of:

- **p = 0.92** (Qwen2.5-Coder-32B HumanEval baseline): P(10/10) =
  0.92^10 = **43%**
- **p = 0.95** (estimated Qwen3-Coder-30B-A3B baseline on small
  utilities): P(10/10) = 0.95^10 = **60%**
- **p = 0.97** (plausible Qwen3-Coder on near-canonical lodash-
  style functions): P(10/10) = 0.97^10 = **74%**

**A 10/10 result on a 10-task curated battery is a 43-74%-likely
outcome by chance from a model with published baseline at this
level.** It carries essentially no signal beyond confirming the
published baseline.

## The five tasks that are near-canonical in pretraining

`chunk`, `slugify`, `partition`, `flatten`, `groupBy` are textbook
lodash/underscore reimplementations. They appear in thousands of
public repositories and in the Qwen2.5-Coder / Qwen3-Coder training
corpus. A coder model passing them at temp=0 is the _expected mode_,
not a finding.

The four "novel-spec" tasks (applyDiscountTier, validateConfig,
formatLogEntry, mergeAcl) raise the bar slightly but the prompts
were tutorial-density (algorithm + state shape + return type +
edge cases all dictated). Local was largely transcribing English to
JS.

`parseQuery` is the only task whose expected behavior wasn't
canonical (URL parsing has multiple reasonable interpretations).
The cross-family adversarial review (next file) found a real bug
in qwen's parseQuery that our v2 oracle missed.

## Verdict

**The 100/100 v2 headline is the expected mode of qwen3-coder:30b
on this kind of task battery, not a research finding.**

Specifically:

- The published baseline alone makes 10/10 a 43-74% likely
  outcome by chance.
- 5 of 10 tasks are near-canonical in pretraining corpora;
  passing them is recall, not novel reasoning.
- 4 of the remaining 5 had tutorial-density prompts that
  dictated the algorithm.
- The 1 task with genuine spec ambiguity (parseQuery) had a
  real bug that the v2 oracle missed (caught by cross-family
  review — see `cross-family/cross-family-results.json`).

## What this means for the research synthesis

The original synthesis (`docs/strategy/research-synthesis-2026-05-11.md`)
claimed the 10/10 result was "genuinely novel signal — no published
paper has this." That claim does not survive comparison to the
published baseline. It was overstretched.

The honest revised position is in
`docs/strategy/research-synthesis-challenge-and-defense-2026-05-11.md`.

To produce a defensible "novel" result, the v2 battery would need:

- More tasks (≥50, not 10) so 100% pass requires beating chance
- Adversarial mutants in the EvalPlus / HumanEval+ style
- LiveCodeBench-class difficulty (where qwen sits at ~66%)
- Cross-family oracle authoring (which we tried; see next file)

This pilot's actual contribution is methodological (the routing
runner, the spec-density ablation, the cross-family review
pattern), not the headline pass rate.

## Cross-references

- Original v2 report: [`./report.md`](report.md)
- Cross-family adversarial review: [`../cross-family/cross-family-results.json`](../cross-family/cross-family-results.json)
- Cross-family findings doc: [`../cross-family/findings.md`](../cross-family/findings.md)
- Synthesis challenge-and-defense: [`../../../docs/strategy/research-synthesis-challenge-and-defense-2026-05-11.md`](../../../../docs/strategy/research-synthesis-challenge-and-defense-2026-05-11.md)
- Beads: prompt-language-h48s (this comparison) — close as completed
