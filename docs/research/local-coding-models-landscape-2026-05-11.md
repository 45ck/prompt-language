---
title: Local coding-model landscape for the dev rig (2026-05-11)
status: external research synthesis — not benchmarked locally yet
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM / Ollama AMD-Vulkan path
---

# Local coding-model landscape (2026-05-11)

External-research synthesis of the local-coding-LLM space against this
specific rig (16 GB AMD VRAM, 64 GB RAM, Vulkan inference). Generated
from a focused web-research pass to confirm or refute the working
assumption that `qwen3-coder:30b` is the local-rig leader as of
mid-2026.

## Verdict

**Confirmed: Qwen really is it for this rig class.** The only credible
candidate to displace `qwen3-coder:30b` on this hardware is
`qwen3-coder-next:80b-a3b` from the same family. Everything stronger on
benchmarks (GLM-4.6, DeepSeek-V3.2, Qwen3-Coder 480B-A35B) does not fit
locally; everything that fits and is not a Qwen-Coder variant scores
materially lower on agentic / SWE-bench tests.

## Candidates and fit-check

| Model                              | Total / Active params | Q4_K_M size | Fits this rig? | Status                                                               |
| ---------------------------------- | --------------------- | ----------- | -------------- | -------------------------------------------------------------------- |
| `qwen3-coder:30b` (A3B MoE)        | 30B / 3B              | ~18 GB      | Yes (87/13 split) | **Current baseline.** Released 2025-07-31.                           |
| `qwen3-coder-next:80b` (A3B MoE)   | 80B / 3B              | ~52 GB      | Yes, heavy CPU spill; throughput drops to ~15-20 tok/s vs current 44 | **Only credible challenger.** +7 pts SWE-bench Verified per Alibaba. |
| GLM-4.6                            | 355B / 32B            | 200 GB+     | **No**         | Cloud-only via Ollama (`glm-4.6:cloud`). ~68% SWE-bench Verified.    |
| GLM-4.5-Air                        | 106B / 12B            | ~63 GB      | Marginal, CPU-heavy | HF only, no Ollama tag; GGUF-importable.                             |
| DeepSeek-V3.2 / V3.x               | 671B / 37B            | ~400 GB     | **No**         | Enterprise-only.                                                     |
| Codestral 25.01                    | 22B dense             | ~13 GB      | Yes, fully VRAM | Strong FIM; weaker SWE-bench. Worth pulling as fast sidekick.        |
| Qwen2.5-Coder 32B                  | 32B dense             | ~19 GB      | Yes (similar spill profile) | Pre-dates Qwen3-Coder; benchmarks lower.                             |
| DeepSeek-Coder-V2-Lite 16B         | 16B / 2.4B            | ~10 GB      | Yes            | 2024 model; behind Qwen3-Coder.                                      |
| Yi-Coder, OpenCoder, StarCoder2    | ≤9B / ≤15B            | ≤9 GB       | Yes            | All sub-Qwen3-Coder.                                                 |

## Benchmark anchors

Numbers here are from public model cards / vendor announcements as of
2026-05-11. They are vendor-reported; treat as indicative, not
independent.

- **Qwen3-Coder 30B-A3B:** 51.6% SWE-bench Verified; ~66 LiveCodeBench
  v6 ([HF model card](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct),
  [Artificial Analysis](https://artificialanalysis.ai/models/qwen3-coder-30b-a3b-instruct))
- **Qwen3-Coder-Next 80B-A3B:** ~58.7% SWE-bench Verified
  ([Qwen blog](https://qwen.ai/blog?id=qwen3-coder-next),
  [VentureBeat](https://venturebeat.com/technology/qwen3-coder-next-offers-vibe-coders-a-powerful-open-source-ultra-sparse))
- **Qwen3-Coder 480B-A35B:** 55.4% SWE-bench Verified
  ([GitHub](https://github.com/QwenLM/Qwen3-Coder)) — does not fit locally
- **GLM-4.6:** ~68% SWE-bench Verified
  ([HF model card](https://huggingface.co/zai-org/GLM-4.6)) — cloud-only
- **DeepSeek-V3.2:** 56.1% SWE-bench Verified per third-party summary
  — does not fit
- **Codestral 25.01:** 86.6% HumanEval; weaker on agentic SWE
  ([Mistral](https://mistral.ai/news/codestral-2501))

## Best benchmark to run on this rig

In priority order:

1. **EvalPlus** (https://github.com/evalplus/evalplus) — adversarial
   HumanEval+ / MBPP+ test expansion specifically designed to defeat
   hardcoded-fit hacks (the same failure mode our 2026-05-11 strict-
   format-fit smoke caught: qwen3-coder produced a hardcoded-prime hack
   that passed textbook test cases but fails on `n=1517` etc.). Built-in
   Ollama backend via OpenAI-compatible API. Cheap to run (~1-2 hours).
   ```
   evalplus.evaluate --model "qwen3-coder:30b" --dataset humaneval \
     --backend ollama --base-url http://localhost:11434/v1
   ```
2. **BigCodeBench** (https://bigcode-bench.github.io) — broader function-
   call benchmark with stronger task realism. Overnight on this rig.
3. **LiveCodeBench Pro** (https://livecodebenchpro.com) — contamination-
   resistant (problems dated post-training). Useful for catching training-
   data-leakage in any model claim.
4. **SWE-bench Lite** (https://www.swebench.com) — strongest signal for
   agentic capability. Needs Docker, takes hours per run, but produces
   the most defensible numbers.

## Recommended actions (ranked)

1. **Pull and benchmark `qwen3-coder-next:q4_K_M`** against the current
   baseline using EvalPlus. This is the only model with a credible chance
   of moving the needle. Honest tradeoff: ~2-3x slower per token (CPU
   spill), +7 pts SWE-bench Verified.
2. **Run EvalPlus on the current `qwen3-coder:30b`** to get a real
   benchmark anchor. Our local strict-format-fit smoke is too small
   (5 tasks, k=3) and uses textbook problems that hardcoded hacks pass.
   EvalPlus solves both.
3. **Pull `codestral:22b` as a fast sidekick** — fits fully in VRAM,
   higher throughput than current, useful for FIM and non-agentic edits
   where speed matters more than SWE-bench score. Not a baseline
   replacement.
4. **Stop chasing.** GLM-4.6 (cloud-only) is the practical ceiling
   reference — run EvalPlus against the cloud variant once to know how
   far the local rig is from frontier open-weights. If within ~5 points,
   stop optimising.

## What this changes for the §2a tracker

Nothing yet — these are external claims, not measurements on this
hardware. But it sets the next concrete measurement:

- Run EvalPlus on `qwen3-coder:30b` and `qwen3-coder-next:80b` as a
  matched comparison. The delta on HumanEval+/MBPP+ is the real evidence
  for whether to swap the harness-arena promoted local model.
- If `qwen3-coder-next:80b` wins EvalPlus by ≥5 pts and slowdown is
  ≤3x, propose updating H11/H14/H15 routing-policy files to use it as
  the promoted local for next sweep.

## Sources

All claims above cited inline. Generated 2026-05-11 by web research
agent against ollama.com, huggingface.co, vendor blogs, and benchmark
leaderboards. Not independently verified.
