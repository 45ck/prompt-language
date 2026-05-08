<!-- cspell:ignore ETIMEDOUT unpromoted -->

# Local Model Candidate Plan

Date: 2026-05-08

## Decision

Do not mark local-model delegation as a total failure. Mark the current state as
`not yet promoted`.

The evidence says `qwen3:8b` is good enough for plumbing and smoke tests, but not
good enough to own H14-style TDD work. The next useful test is not more prompt
polishing on `qwen3:8b`; it is a controlled promotion ladder for stronger local
models, starting with `qwen3-coder:30b`.

Update: `qwen3-coder:30b` has now passed the readiness smoke and both locally
promoted H14 subrole refresh runs with sampled `/api/ps` residency evidence. It
is promoted for the narrow implementation-from-tests and API-preservation
subroles only. It is still not promoted for full H14 or standalone test
authoring.

Update: `devstral-small-2:24b` has also passed readiness plus the same two H14
implementation subrole screens at `3/3` each, with sampled `/api/ps` residency
evidence in every subrole sample tick. It is promoted for the same narrow
implementation-from-tests and API-preservation subroles only.

Update: `qwen3.6:27b` passed readiness with sampled residency evidence, but the
first H14 API-preservation subrole run hit the 900s hard timeout and then failed
the private oracle at `3/5`. Stop its API-preservation replicate set at `0/1`;
do not promote it for implementation ownership. Treat it as a lower-priority
reviewer/classifier control unless a future prompt or runtime lane changes the
timeout behavior.

Update: `qwen3-opencode:30b` passed readiness, H14
implementation-from-tests at `3/3`, and H14 API-preservation at `3/3`, with
sampled `/api/ps` residency evidence across both subrole screens. It is promoted
for the same two narrow implementation subroles as `devstral-small-2:24b` and
`qwen3-coder:30b`, but it is lower routing priority because it is much slower:
implementation runs took `354.030s`, `444.608s`, and `444.640s`; API-preservation
runs took `392.278s`, `358.213s`, and `347.989s`.

Update: after the PowerShell stdin transport and socket-reset retry hardening,
`qwen3-coder:30b` passed full H14 local-only TDD at `3/3` with the private oracle
passing `6/6` in every run. It is now promoted for full H14 TDD only under the
hardened H14 flow, PowerShell stdin transport, and a 16 action-round budget.
Fallback local models remain unpromoted for full TDD.

Update: on 2026-05-09 local time, a fresh Prompt Language smoke confirmed
`qwen3-coder:30b` still works through the PowerShell transport. The WSL HTTP
endpoints were not reachable, but `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`
passed smoke case `A` with two Ollama provider records, 679 total tokens, zero
retries, and post-run residency at `19 GB`, `13%/87% CPU/GPU`, `4096` context.
This keeps the local track active; it does not justify rerunning broad local
ownership screens that already have clear decisions.

Update: later 2026-05-09 local smokes tried `gemma4-opencode:e4b` as the cheap
classifier/reviewer candidate. The default-context `A` smoke failed with
`spawnSync node ETIMEDOUT` under a 900s budget while `ollama ps` showed `10 GB`,
`67%/33% CPU/GPU`, and `32768` context. A follow-up run with
`PROMPT_LANGUAGE_OLLAMA_NUM_CTX=4096` proved the new context knob worked because
`ollama ps` showed `4096` context, but the smoke still failed with PLR-007 after
the PowerShell bridge timed out. Do not use this model for route classification
on this host unless a different backend changes the timeout behavior.

Update: a follow-up promoted-model health check ran `qwen3-coder:30b` through the
same PowerShell transport with `PROMPT_LANGUAGE_OLLAMA_NUM_CTX=4096`. Smoke case
`A` passed in 16.382s with artifact
`scripts/eval/results/smoke-2026-05-08T19-44-46-987Z.json`, two Ollama provider
records, 679 total tokens, zero retries, and provider metadata recording
`transport: powershell` plus `numCtx: 4096`. Post-run residency showed
`qwen3-coder:30b`, `19 GB`, `13%/87% CPU/GPU`, and `4096` context. This confirms
the context override is usable on the promoted model path and keeps
`qwen3-coder:30b` as the current local full-H14 worker.

Update: `gemma4-opencode:e2b` was screened as the smaller installed Gemma
OpenCode fallback for cheap classifier/reviewer work. `ollama show` reported a
`5.1B` `gemma4` `Q4_K_M` model. The explicit 4K-context Prompt Language smoke
loaded the model, and `ollama ps` showed `7.7 GB`, `75%/25% CPU/GPU`, and `4096`
context. The smoke still failed before writing a result artifact with PLR-007
from the PowerShell bridge, and the diagnostic included
`model=gemma4-opencode:e2b`, `timeoutMs=300000`, and `numCtx=4096`. Do not route
this model as a cheap classifier or reviewer on the current PowerShell transport.
The Vulkan-tagged `gemma4-opencode-vulkan:e2b` package also loaded at `7.7 GB`,
`75%/25% CPU/GPU`, and `4096` context, but failed the same smoke with PLR-007
after exceeding the default `8` action-round limit. That rejects the current
Vulkan package as the cheap-router fallback too.

## Current Host State

- WSL reports 31 GiB RAM with about 24 GiB available.
- Windows reports about 64 GiB total RAM, but only about 3.9 GiB free during this
  check. Large Windows-hosted Ollama runs should wait until free RAM is higher.
- `ollama version` reports `0.20.5`.
- WSL `http://127.0.0.1:11434` is not reachable. Use the known Windows Ollama
  listener pattern and connect from WSL through the gateway IP.
- `ollama ps` is empty, so no model residency is active right now.
- Installed local candidates include `qwen3-coder:30b`, `qwen3.6:27b`,
  `devstral-small-2:24b`, `qwen3:30b`, `qwen3-opencode:30b`,
  `qwen3-opencode-big:30b`, `gemma4:26b`, and `gemma4:31b` variants.

## Latest Model Read

- DeepSeek latest official release is DeepSeek V4 Preview from 2026-04-24:
  V4-Pro is 1.6T total / 49B active params, and V4-Flash is 284B total /
  13B active params. This is interesting for API or large-server comparison, not
  this workstation's local-only lane.
- DeepSeek V3.2 from 2025-12-01 remains relevant as an open-weight agent model,
  but it is still too large for this host as a practical local-only Ollama target.
- `qwen3-coder:30b` is the best immediate local coding target because Ollama
  ships it, it is already installed here, and the Ollama card identifies it as
  30B total / 3.3B active params with a 19 GB local footprint.
- `GLM-4.7-Flash` is the strongest 30B-class challenger on paper: its model card
  describes a 30B-A3B MoE model and reports 59.2 on SWE-bench Verified. It is not
  currently installed in Ollama here, so it belongs after the installed candidates.
- `Qwen3-Coder-Next`, `GLM-5.1`, `MiniMax-M2.5`, and `Kimi-K2.5` are strong
  server/cloud comparison models, not workstation-local candidates for this box.

## Runtime Knobs To Test

Start all local claim runs with:

- one model loaded at a time;
- one request at a time;
- short context first, then increase context only after `ollama ps` proves
  processor placement;
- `OLLAMA_FLASH_ATTENTION=1` and K/V cache quantization as a separate lane, not
  mixed into baseline claims;
- resource snapshot command attached to every live local step.

Ollama documents that required RAM scales with `OLLAMA_NUM_PARALLEL` times
`OLLAMA_CONTEXT_LENGTH`, and that `ollama ps` should be used to check allocated
context and CPU/GPU offload. That is the measurement contract for this repo.

## Ranked Candidate Tests

| Rank | Candidate              | Why                                                                           | First task                                           |
| ---- | ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1    | `qwen3-coder:30b`      | Best installed local coding model; MoE active params make it plausible        | Readiness smoke, then H14 S2 implementation subrole  |
| 2    | `devstral-small-2:24b` | Installed coding-oriented model with smaller footprint than 30B class         | Readiness smoke, then H14 S2                         |
| 3    | `qwen3-opencode:30b`   | Installed coding-tuned variant; compare against official Qwen coder           | Readiness smoke, then H14 S2                         |
| 4    | `qwen3.6:27b`          | Loads cleanly, but timed out on first H14 API-preservation implementation run | Reviewer/classifier control only                     |
| 5    | `gemma4-opencode:e4b`  | Failed readiness at both 32K and explicit 4K context                          | Different backend only before any classifier use     |
| 6    | `gemma4-opencode:e2b`  | Standard and Vulkan packages loaded at 4K but failed the minimum smoke        | Different backend only before any classifier use     |
| 7    | `gemma4:26b`           | Installed but less obvious coding-agent fit                                   | Smoke only unless the above fail to load             |
| 8    | `GLM-4.7-Flash`        | Strong 30B-class paper candidate; not installed here                          | Install only after installed 30B lanes show capacity |
| 9    | DeepSeek V4 Flash API  | Latest DeepSeek, but too large for local                                      | Frontier/cloud comparison arm only                   |

## Promotion Ladder

1. Readiness: model loads, answers one prompt, `ollama ps` shows residency, and
   the harness manifest records model, endpoint, wall time, and resource samples.
2. Subrole: model passes H14 S2 or S4 at least two of three times.
3. Full local: model passes full H14 local-only three of three times with no
   frontier input.
4. Hybrid value: hybrid passes at least two of three, uses fewer frontier calls
   than frontier-only, and records lower frontier spend.

Current `qwen3-coder:30b` status:

- readiness: passed with sampled residency evidence;
- H14 implementation-from-tests: passed in the sampled refresh, private oracle
  `6/6`;
- H14 API-preservation: passed in the sampled refresh, private oracle `5/5`;
- H14 test-authoring: promoted after clarified semantics at `3/3`;
- full H14 local-only: promoted after retry-hardened full-TDD screen at `3/3`,
  private oracle `6/6` in each run.

Current `devstral-small-2:24b` status:

- readiness: passed with sampled residency evidence;
- H14 implementation-from-tests: passed `3/3`, private oracle `6/6` in each run;
- H14 API-preservation: passed `3/3`, private oracle `5/5` in each run;
- H14 test-authoring: not tested in this screen and not promoted;
- full H14 local-only: not promoted.

Current `qwen3.6:27b` status:

- readiness: passed with sampled residency evidence;
- H14 API-preservation: stopped at `0/1` after a 900s timeout and private oracle
  `3/5`;
- H14 implementation-from-tests: not run after API-preservation cutoff;
- H14 test-authoring: not promoted;
- full H14 local-only: not promoted.

Current `qwen3-opencode:30b` status:

- readiness: passed with sampled residency evidence;
- H14 implementation-from-tests: passed `3/3`, private oracle `6/6` in each run;
- H14 API-preservation: passed `3/3`, private oracle `5/5` in each run;
- H14 test-authoring: not promoted;
- full H14 local-only: not promoted.

## One Hundred Hypotheses

These are ranked by expected value for this workstation and harness.

1. H001: `qwen3-coder:30b` passes readiness when Windows free RAM is above 24 GiB.
2. H002: `qwen3-coder:30b` fails or CPU-offloads when Windows free RAM is below 16 GiB.
3. H003: short context makes 30B-class models more reliable than default agent context.
4. H004: `ollama ps` processor placement predicts H14 wall time better than model size.
5. H005: `qwen3-coder:30b` beats `qwen3:8b` on H14 S2 implementation.
6. H006: `qwen3-coder:30b` still fails full H14 without a frontier plan. Rejected
   by the retry-hardened full-TDD screen: `3/3` local-only private-oracle passes.
7. H007: H14 S4 API preservation is a better promotion gate than a generic smoke prompt.
8. H008: `devstral-small-2:24b` is the best installed fallback if 30B models do not load.
9. H009: `qwen3.6:27b` is better as a reviewer/classifier than as the main implementer.
10. H010: `gemma4-opencode:e4b` is useful for cheap route classification only.
    Current evidence rejects this hypothesis for the current PowerShell
    transport: the 2026-05-09 `A` smoke timed out at both 32K context and
    explicit 4K context.
    The smaller `gemma4-opencode:e2b` fallback also failed the explicit 4K
    smoke through the same PowerShell bridge, and the Vulkan-tagged package
    exhausted the default action-round budget. The Gemma OpenCode cheap-router
    lane should pause unless a different backend changes the transport behavior.
11. H011: `qwen3-opencode:30b` improves command following but not hidden-oracle pass rate.
12. H012: `qwen3-opencode-big:30b` has no practical advantage over `qwen3-coder:30b`.
13. H013: `gemma4:31b` is too heavy for reliable Windows Ollama on this host.
14. H014: `gemma4:26b` can pass small code-edit tasks but not H14 full.
15. H015: GLM 30B class is worth installing only after one installed 30B model passes readiness.
16. H016: DeepSeek V4 Flash should be an API comparison arm, not a local arm.
17. H017: DeepSeek V4 Pro is too large even as a hybrid local candidate.
18. H018: frontier planning plus local implementation beats local-only on H14.
19. H019: frontier repair after local failure beats repeated local repair.
20. H020: local-only cost savings vanish if the local lane needs multiple retries.
21. H021: local route classification can reduce frontier calls on low-risk docs changes.
22. H022: local route classification is unsafe for security or persistence changes.
23. H023: local models are cost-effective for fixture setup and artifact packaging.
24. H024: local models are not yet cost-effective for final review.
25. H025: public gate output is enough for local repair on narrow failures.
26. H026: public gate output is not enough for local repair on semantic API failures.
27. H027: hidden oracle failures will remain common until subrole prompts are narrower.
28. H028: no-edit local attempts should trigger immediate escalation.
29. H029: one local repair attempt is the correct cap for 8B models.
30. H030: one or two local repair attempts are acceptable for promoted 30B models.
31. H031: H14 S1 test authoring is easier for local models than S2 implementation.
32. H032: H14 S2 implementation predicts full H14 success better than S1.
33. H033: H14 S4 API preservation catches the failure mode that hurt earlier runs.
34. H034: local models can generate tests that pass but do not kill mutants.
35. H035: mutation score is a better promotion gate than test count.
36. H036: full H14 should not run until S2 and S4 pass at least two of three.
    Supported: full H14 promotion came only after implementation, API
    preservation, and test-authoring subroles had clean evidence.
37. H037: repeated local H14 failures are model failures, not prompt-language failures.
38. H038: endpoint failures are harness failures and must not count against model quality.
39. H039: missing model residency is an evidence failure even if the oracle passes.
40. H040: resource snapshot summaries reduce review time for local runs.
41. H041: before/after snapshots miss short-lived model residency.
42. H042: sampled resource snapshots catch more useful evidence than edge snapshots.
43. H043: direct `/api/ps` probes will be more reliable than shelling out to `ollama ps`.
44. H044: Windows-side probes will be more reliable than WSL-side probes.
45. H045: WSL `localhost` should never be assumed for Windows Ollama.
46. H046: the gateway-IP listener should be treated as test infrastructure, not default config.
47. H047: long context improves repository understanding but hurts load reliability.
48. H048: 8k context is the right first baseline for 30B-class local smoke.
49. H049: 32k context is the first meaningful coding-agent target after readiness.
50. H050: 64k context is only worth testing after GPU residency is proven.
51. H051: 256k context is not practical on this host for 30B local models.
52. H052: Flash Attention lowers memory enough to promote one additional context tier.
53. H053: K/V cache quantization helps long-context local runs more than short prompts.
54. H054: K/V cache quantization may change behavior enough to need separate claim lanes.
55. H055: speculative decoding helps rewrite-heavy code tasks more than reasoning tasks.
56. H056: n-gram speculative decoding is more relevant than draft-model speculation here.
57. H057: Ollama is the simplest runner for claim-grade local evidence.
58. H058: llama.cpp server is worth testing only if Ollama cannot expose needed knobs.
59. H059: vLLM is not the first choice on this AMD Windows/WSL setup.
60. H060: SGLang is not the first choice unless testing GLM server candidates.
61. H061: CPU fallback invalidates speed claims but can still produce quality claims.
62. H062: split CPU/GPU inference is acceptable for correctness tests but not cost tests.
63. H063: model load time should be separated from generation time in cost accounting.
64. H064: wall time alone will over-penalize models that load cold.
65. H065: warm-run benchmarks need explicit residency evidence.
66. H066: cold-run benchmarks are better for user-realistic local workflows.
67. H067: frontier-only remains the baseline for task quality.
68. H068: local-only remains the baseline for cost and privacy.
69. H069: hybrid value requires fewer frontier calls than frontier-only.
70. H070: hybrid should be marked failed if frontier rewrites most of the local diff.
71. H071: local output is still useful if frontier repair can preserve most of it.
72. H072: route labels must record whether frontier advice touched model-visible files.
73. H073: advisor-only lanes are weak unless advice is converted into executable constraints.
74. H074: static classify/local/review is weaker than failure-aware repair.
75. H075: local review is useful for style and obvious omissions, not hidden semantics.
76. H076: frontier review should remain mandatory for promoted local lanes at first.
77. H077: local agents should never receive private oracle output.
78. H078: public gate leaks are acceptable only when intentionally part of repair.
79. H079: oracle command text in model-visible artifacts invalidates the run.
80. H080: process-tree cleanup is required before running parallel local experiments.
81. H081: one local run at a time is the only safe initial concurrency.
82. H082: concurrent local runs will distort wall time and memory measurements.
83. H083: disk usage from model pulls should be tracked before adding new candidates.
84. H084: installing GLM is lower value than testing installed models first.
85. H085: installing another DeepSeek local quant is lower value than API comparison.
86. H086: an 8B local model can own docs-only tasks after two clean repetitions.
87. H087: a 30B local model can own bounded implementation only after subrole promotion.
88. H088: no local model should own cross-layer architecture yet.
89. H089: local model temperature should be fixed during claim runs.
90. H090: model options belong in the manifest, not only in shell commands.
91. H091: actual model IDs must be captured from the runtime, not inferred from command text.
92. H092: provider substitution should invalidate strict local-vs-frontier comparisons.
93. H093: prompt-language specialist flows can improve local reliability on narrow subroles.
94. H094: specialist flows will not turn a weak base model into a senior engineer.
95. H095: smaller prompts improve local execution reliability more than longer instructions.
96. H096: examples from passing diffs help local models more than generic senior-engineer prose.
97. H097: local models need explicit file ownership to avoid scope drift.
98. H098: local models need explicit stop conditions to avoid looping.
99. H099: harness evidence should rank model-task pairs, not models globally.
100. H100: the winning system is likely frontier-orchestrated local specialists, not local-only autonomy.

## Next Commands

Only run these when Windows free RAM is high enough and the experiment needs the
WSL-reachable HTTP listener:

```sh
HOST=$(ip route | awk '/default/ {print $3; exit}')
export PROMPT_LANGUAGE_OLLAMA_BASE_URL="http://$HOST:11435"
curl -sS --max-time 5 "$PROMPT_LANGUAGE_OLLAMA_BASE_URL/api/version"
curl -sS --max-time 5 "$PROMPT_LANGUAGE_OLLAMA_BASE_URL/api/ps"
```

For the current host state, prefer the PowerShell transport:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
  PROMPT_LANGUAGE_OLLAMA_NUM_CTX=4096 \
  EVAL_MODEL=ollama/qwen3-coder:30b \
  EVAL_TIMEOUT_MS=900000 \
  node scripts/eval/smoke-test.mjs --harness ollama --quick --only A
```

For low-context candidate screens, pin the Ollama context explicitly through the
Prompt Language Ollama adapter:

```sh
PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell \
  PROMPT_LANGUAGE_OLLAMA_NUM_CTX=4096 \
  EVAL_MODEL=ollama/gemma4-opencode:e4b \
  EVAL_TIMEOUT_MS=900000 \
  node scripts/eval/smoke-test.mjs --harness ollama --quick --only A
```

The Ollama adapter records the configured `numCtx` value in provider telemetry,
so low-context evidence should preserve both the requested context and the
observed `ollama ps` residency.

Then run only claim-bearing screens that answer a new question:

- H15 PATCH test-authoring replay only as a promoted tests-only health lane;
- budgeted H15 hybrid with explicit `--frontier-call-limit`;
- no further `gemma4-opencode:e4b` classifier/reviewer control on the current
  PowerShell transport;
- GLM-4.7-Flash install/readiness only after installed local candidates stop
  answering the current routing questions.

## Sources

- DeepSeek V4 Preview Release:
  <https://api-docs.deepseek.com/news/news260424>
- DeepSeek V3.2 Release:
  <https://api-docs.deepseek.com/news/news251201>
- Ollama `qwen3-coder` model card:
  <https://ollama.com/library/qwen3-coder>
- Qwen3-Coder-30B-A3B model card:
  <https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct>
- GLM-4.7-Flash model card:
  <https://huggingface.co/zai-org/GLM-4.7-Flash>
- Qwen3-Coder-Next model card:
  <https://huggingface.co/Qwen/Qwen3-Coder-Next>
- Ollama FAQ for concurrency, memory, Flash Attention, and K/V cache:
  <https://docs.ollama.com/faq>
- Ollama context length documentation:
  <https://docs.ollama.com/context-length>
- Ollama hardware support:
  <https://docs.ollama.com/gpu>
- llama.cpp speculative decoding:
  <https://github.com/ggml-org/llama.cpp/blob/master/docs/speculative.md>
