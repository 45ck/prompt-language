# 2026-05-09 Local Model Next Lanes

This note answers the current operating question: should local model work be
marked as a fail, or should we keep testing newer local models under Prompt
Language routing?

Decision: **do not mark local model delegation as failed**. Mark it as
**lane-limited**. Local models are already useful for bounded, oracle-checked
work. They are not yet proven for broad autonomous repair. The next work should
test newer local models against the same narrow harness lanes before expanding
their authority.

## Machine Inventory

Current Ollama inventory includes the three practical candidates:

| Model                  | Local status | Local metadata from `ollama show`              | Current interpretation                                                            |
| ---------------------- | ------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `qwen3.6:27b`          | installed    | 27.8B, Q4_K_M, 262144 context, tools, thinking | Highest-priority new screen candidate, but needs thinking-output containment.     |
| `qwen3-coder:30b`      | installed    | 30.5B MoE, Q4_K_M, 262144 context, tools       | Existing promoted model for H14 implementation-from-tests and H11 refactor lanes. |
| `devstral-small-2:24b` | installed    | 24.0B, Q4_K_M, 393216 context, tools           | Existing H14 fallback and H15 PATCH test-authoring fallback; not H15 repair.      |

`nvidia-smi` is not available on this host. Windows reports an AMD RX 7600 XT
and Intel UHD Graphics 770 adapters. A live `qwen3.6:27b` smoke used a 4096
context and showed `29%/71% CPU/GPU` in `ollama ps` while resident.

Live smoke result: `qwen3.6:27b` answered a trivial "Return exactly OK" prompt
with visible thinking text before `OK`. That is a useful failure signal: do not
use `qwen3.6:27b` in strict-output lanes until the runner either disables
thinking, strips thinking safely, or scores only artifact state.

Follow-up implementation: the native Ollama runner now sends top-level
`think: false` on HTTP and PowerShell chat requests. That matches Ollama's
documented thinking control for chat calls and keeps the runner aligned with its
strict JSON action-envelope contract. The CLI transport already uses
Ollama's CLI flag for hiding thinking output.

Follow-up live smoke: with `PROMPT_LANGUAGE_OLLAMA_TRANSPORT=powershell`,
`PROMPT_LANGUAGE_OLLAMA_NUM_CTX=4096`, `PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=2`,
and `qwen3.6:27b`, a one-prompt flow asking for exactly `OK` completed through
the native runner with status `ok`. During the run, `ollama ps` reported
`qwen3.6:27b` resident at 23GB with `29%/71% CPU/GPU` and 4096 context. This
promotes `qwen3.6:27b` from "blocked by thinking leakage" to "eligible for the
next narrow runner-level smoke", not to a coding-lane promotion.

Follow-up H14 screen: `qwen3.6:27b` then passed the clarified H14
test-authoring route three times with thinking disabled, PowerShell transport,
8192 context, 8 action rounds, private oracle `4/4`, and sampled resident model
evidence on every resource probe. Wall time was stable but slow:
`577.510s`, `573.032s`, and `582.605s`. This promotes `qwen3.6:27b` only as a
slow fallback for H14 standalone test authoring. It remains not promoted for
H14 implementation ownership because the earlier API-preservation screen failed.

Follow-up H15 validation-only screen: `qwen3.6:27b` passed the private H15
validation-only oracle in three think-off runs, but the third run timed out at
the 1200s step boundary after writing the expected artifacts. Outcomes were two
clean passes and one timeout/oracle-pass. This proves qwen3.6 can solve the
micro-flow, but does not promote it under the current wall-clock contract.

## Current Primary-Source Model Notes

- Qwen3-Coder-Next is the most interesting not-yet-installed local candidate.
  Its model card says it is 80B total with 3B active parameters, native 262144
  context, agentic coding training, and reported SWE-bench Verified 70.6 plus
  Terminal Bench 36.2. It is Apache 2.0 and has quantized variants for local
  runtimes.
- Qwen3.6 is already installed. Ollama lists `qwen3.6:27b` as 17GB with 256K
  context and `qwen3.6:35b` as 24GB with 256K context. The page describes the
  release as focused on stability and real-world coding utility.
- Qwen3-Coder 30B is already installed. Ollama describes it as 30B total with
  3.3B active parameters, 256K context, long-horizon agentic coding training,
  and execution-driven reinforcement learning.
- Devstral Small 2 is already installed. Mistral describes it as a 24B local
  coding model with 256K context and Apache 2.0 licensing; Ollama lists the
  local tag as 15GB with 384K context and reports Devstral Small 2 at 65.8 on
  SWE-bench Verified and 32.0 on Terminal Bench.
- DeepSeek V4 is important, but not a free local lane for this PC. DeepSeek's
  official April 24, 2026 preview lists V4-Pro at 1.6T total / 49B active and
  V4-Flash at 284B total / 13B active, with open weights. That makes DeepSeek
  V4 a frontier or separate serving-infrastructure candidate, not a quick
  single-workstation Ollama candidate.

References:

- https://huggingface.co/Qwen/Qwen3-Coder-Next
- https://ollama.com/library/qwen3.6
- https://ollama.com/library/qwen3-coder
- https://ollama.com/library/devstral-small-2
- https://mistral.ai/news/devstral-2-vibe-cli
- https://api-docs.deepseek.com/news/news260424
- https://docs.ollama.com/capabilities/thinking

## Next Experiment Order

1. Completed: `qwen3.6:27b` strict-output containment smoke.
   Result: native runner thinking suppression works for the one-prompt runner
   smoke.

2. Completed: `qwen3.6:27b` H14 standalone test-authoring screen.
   Result: `3/3` clean oracle passes; promote only as a slow fallback for that
   exact H14 subrole.

3. Completed: `qwen3.6:27b` H15 validation-only local screen.
   Result: private oracle passed in all three runs, but one run timed out at the
   step boundary. Keep as slow experimental fallback evidence, not promotion.

4. `qwen3.6:27b` H14 implementation-from-tests, N=3.
   Goal: compare directly with the promoted `qwen3-coder:30b` lane under the
   same oracle, same route profile, and same output/resource capture.

5. `qwen3.6:27b` vs `qwen3-coder:30b` vs `devstral-small-2:24b` on H15 PATCH
   test-authoring, N=3 per model.
   Goal: decide whether the existing Devstral fallback remains best or whether
   Qwen3.6 should replace it.

6. Pull or register a Qwen3-Coder-Next quantization only after the above tests.
   Goal: avoid installing another large model until current installed candidates
   have clean, comparable evidence.

7. Treat DeepSeek V4 as a separate hosted/open-weight frontier comparison.
   Goal: it may be useful as a cheap frontier advisor, but it should not be
   mixed into "free local model" claims.

## Ranked Hypotheses Backlog

1. Local models save money only when the lane has a deterministic oracle.
2. Local models save more money as reviewer or test-authoring agents than as full implementers.
3. Prompt Language helps most when the model is already above the valid-code floor.
4. `qwen3.6:27b` may beat `qwen3-coder:30b` on short agent tasks.
5. `qwen3-coder:30b` may remain better on tool-call-heavy coding tasks.
6. `devstral-small-2:24b` may remain best for PATCH test-authoring.
7. `qwen3.6:27b` thinking output may break strict JSON and exact-output lanes.
8. Thinking output may not matter when scoring filesystem artifacts only.
9. Frontier repair should stay default for H15 validation repair.
10. H15 validation-only screen can be local even when validation repair cannot.
11. Local model failures are cheaper when caught before workspace mutation.
12. Local model failures are more useful when classified as model, harness, or resource failure.
13. Resource sampling is mandatory for claims about single-machine local viability.
14. Command output caps prevent local runtime failures from corrupting evidence.
15. Process-tree cleanup makes timeout evidence trustworthy.
16. `qwen3.6:27b` needs a non-thinking mode before strict structured lanes.
17. Smaller active-parameter MoE models may fit this PC better than dense 30B models.
18. Large context is less useful than reliable tool calls for these fixtures.
19. A 4096 context smoke is not enough evidence for repo-scale lanes.
20. A 32768 context lane may be the practical ceiling for stable local runs.
21. `qwen3-coder:30b` should stay promoted only where it has N=3 evidence.
22. `devstral-small-2:24b` should stay demoted for H15 repair despite broad benchmark strength.
23. Qwen3-Coder-Next is worth testing only if a practical quantization runs without heavy CPU spill.
24. DeepSeek V4 is likely useful as a hosted advisor, not as a local Ollama lane.
25. Local screen-plus-frontier-repair can reduce cost while preserving quality.
26. Frontier classify-plus-local-bulk works only if classify is specific enough to route away hard tasks.
27. Local-only lanes need stricter no-edit and artifact-completion guards than frontier lanes.
28. Prompt Language should route by subrole, not by model brand.
29. Model benchmarks should influence candidate choice, not promotion.
30. Promotion should require clean local evidence in this repo's harness.
31. H14 implementation-from-tests is the best local promotion test.
32. H15 PATCH test-authoring is the best local specialist test.
33. H11 multi-file refactor remains a stress test for local context handling.
34. H15 validation repair remains a stress test for over-broad edits.
35. Short exact-output prompts are good smoke tests for instruction discipline.
36. Exact-output smokes should not be used as coding-quality evidence.
37. CLI runner behavior can differ from API runner behavior for the same model.
38. Ollama template defaults can change model behavior enough to require capture.
39. Each local run should record `ollama show` metadata at the start.
40. Each local run should record `ollama ps` before, during, and after local steps.
41. A model can pass public tests and still fail product preservation.
42. A model can pass hidden checks but fail artifact-completion gates.
43. Artifact-completion failures should block promotion even when code is correct.
44. Missing summary artifacts are model failures, not harness successes.
45. Seed-data rewrites should be treated as broad-edit failures.
46. Missing-ID response changes should be treated as API-preservation failures.
47. Local models need explicit "do not change public tests" instructions.
48. Local models need narrower writable file scopes than frontier models.
49. Local models benefit from one file or one contract per turn.
50. Local models degrade when asked to plan, implement, test, and summarize in one turn.
51. Local reviewer lanes should produce findings only, not patches.
52. Local planner lanes should produce bounded file ownership, not architecture rewrites.
53. Local test-authoring lanes should be mutation-tested before promotion.
54. Local implementation lanes should start from public tests when possible.
55. Local repair lanes should require diff-size limits.
56. Local repair lanes should require API-surface assertions.
57. Local repair lanes should require seed-data preservation assertions.
58. Local repair lanes should require missing-ID behavior assertions.
59. Local lanes should fail fast on no-edit loops.
60. Local lanes should fail fast on repeated invalid tool actions.
61. Local lanes should count action rounds and expose exhaustion.
62. Local lanes should record model substitution explicitly.
63. Local lanes should reject provider substitution unless declared.
64. Local lanes should not share private oracle paths with model prompts.
65. Local lanes should not expose oracle commands in public manifests.
66. Local lanes should use minimal environment when possible.
67. Minimal environment may break operator commands that rely on inherited shell state.
68. Command safety policy should default to deny high-risk commands.
69. Shell wrappers should require an explicit unrestricted claim.
70. Resource probes that need shell wrappers should be marked as weaker containment.
71. Output truncation should preserve original byte counts for debugging.
72. Timeout cleanup should be visible before treating a run as contained.
73. Frontier calls should be reserved for classify, repair, and final review.
74. Local calls should be used for bulk draft, tests, and focused screens.
75. Advisor-only lanes may not help weak local implementers.
76. Local models may follow frontier advice but still violate hidden invariants.
77. A better local model may reduce repair calls more than it improves first-pass success.
78. A faster local model may beat a stronger one on total cost if retry succeeds.
79. Slow local lanes can cost more wall time than cheap frontier calls.
80. Wall time must be part of the cost model, not only dollars.
81. Single-GPU local parallelism is mostly failure isolation, not speed.
82. Multi-agent local races can serialize and waste time on one Ollama server.
83. Specialist local agents are useful only when each has a bounded oracle.
84. Prompt Language should avoid spawning multiple heavy local agents on one model.
85. Local model context floods reduce tool reliability.
86. Skill catalog size can harm local agent behavior.
87. Local agents need smaller system prompts than frontier agents.
88. Context summarization may help local models more than frontier models.
89. Retrieval should feed local models only the files needed for the lane.
90. Whole-repo prompts should stay frontier until local context behavior improves.
91. Qwen3.6 should be tested first because it is already installed.
92. Qwen3-Coder-Next should be tested second because it is not installed but benchmarks well.
93. DeepSeek V4 should be watched for hosted cost, not local feasibility.
94. Devstral Small 2 should remain in fallback roles where it has evidence.
95. Qwen3-Coder 30B should remain the default promoted local coding model for now.
96. Local model promotion should be reversible when newer evidence regresses.
97. Every promotion should state the exact route, fixture, model tag, and commit.
98. Every demotion should state whether the cause was model, harness, or resource.
99. The repo should prefer conservative routing over broad local optimism.
100. The thesis is viable only if local lanes stay narrow, measured, and reversible.
