# Governed Symphony Routing Synthesis: 2026-05-12

Status: research synthesis and next-step decision record  
Tracking bead: `prompt-language-gslr2`  
Companion Portarium bead: `bead-1227`

## Bottom Line

The promising thesis is narrower and stronger than "local models replace Codex".

The useful thesis is:

```text
Portarium governs work items and action boundaries.
Prompt Language makes each work item an executable contract.
Local models do bounded low-risk work only when gates and escalation paths exist.
Frontier models stay responsible for ambiguity, architecture, root-cause repair,
and final review.
```

GSLR-1 has not proved cost reduction yet. It has proved that the experiment can
be represented as a clean, safe, no-mutation four-arm scaffold with evidence
fields that can be checked before product integration.

Follow-up live result:
`experiments/harness-arena/results/gslr1-live-2026-05-12/report.md`.

That run narrowed the thesis further: the live harness works, and local-only can
handle the safe MC projection task, but the current hybrid arm is not cheaper
than the frontier-only control and had an unresolved blocking review finding.

## External Research Read

| Source family                                    | What it says                                                                                                         | Implication for PL                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI Symphony                                  | Symphony turns board work into isolated autonomous implementation runs.                                              | The board/scheduler is real prior art. PL should not become the board; it should become the work-item contract that runs inside a board lane.                            |
| OpenAI Codex App Server                          | Codex exposes a stable harness surface through JSONL-framed JSON-RPC over stdio and structured notifications.        | If PL later drives Codex directly, structured event ingestion is a better integration surface than terminal scraping.                                                    |
| FrugalGPT and RouteLLM                           | Routing/cascades can reduce LLM cost while preserving or improving task quality under learned or measured policies.  | The cost-routing idea is credible, but software-agent routing must still be tested in our harness because code tasks have gates, diffs, tools, and hidden failure modes. |
| Hybrid LLM routing papers                        | Smaller models can handle easier queries while stronger models handle harder ones.                                   | PL routing should be gate-backed and risk-aware, not a vague "try local first" policy.                                                                                   |
| SWE-agent                                        | Agent-computer interface design materially affects software-engineering agent performance.                           | PL handoffs, file scopes, public gates, and repair prompts are part of model capability, not just orchestration decoration.                                              |
| AutoCodeRover                                    | Structured search, localization, tests, and repair matter for issue resolution and cost.                             | PL should encode localization and validation loops before adding more agents.                                                                                            |
| Agentless                                        | Simple localization, repair, and validation can beat more complex autonomous agents on SWE-bench Lite.               | The hybrid-router arm must beat simple baselines; multi-agent shape alone is not evidence.                                                                               |
| LMQL, SGLang, and DSPy                           | Prompt programming is an active line of work: structured LM calls, assertions, compilation, and optimized pipelines. | PL's differentiator cannot be "prompts as code" alone; it must be execution gates, durable evidence, policy handoff, and operator-readable contracts.                    |
| NIST AI RMF and agent governance grey literature | Auditability, approvals, governance, and action-boundary control are recurring requirements for deployed AI systems. | Portarium's governance boundary is a real product wedge if it is enforced before actions, not only summarized after outputs.                                             |

## Internal Evidence Read

The 2026-05-06 research synthesis still holds:

- PL is strongest as a verification-first supervision runtime.
- Local models are useful for bounded semantic choices under deterministic
  envelopes.
- Local autonomous full-stack engineering is not supported by the evidence.
- Hybrid local/frontier routing is motivated but remains untested.

The 2026-05-11 local-model landscape narrows the local lane:

- `qwen3-coder:30b` remains the practical baseline for this rig.
- larger local models may be worth benchmarking, but they do not change the
  control-plane thesis until measured locally.
- H15-style endpoint ownership remains frontier-only; local lanes should start
  with docs, fixtures, tests-only changes, selectors, rankers, and narrow
  implementation slices.

The GSLR-1 scaffold added on 2026-05-12 adds one new fact:

- the MC projection fixture, public gate, runbook, and manifest shape can be
  materialized across four arms without touching source systems or leaking raw
  vertical data.

That is scaffold evidence, not model-performance evidence.

## What We Learned

### The exciting part

The interesting research object is a controlled software-engineering loop, not a
larger pile of agents. The loop is:

1. classify the bead by risk, ambiguity, and local fit;
2. route bounded work to local lanes only when gates exist;
3. escalate ambiguity or failed gates to frontier lanes;
4. record every route decision, model, command, gate, artifact, and review;
5. let Portarium render and govern the evidence.

If this works, the value is not just lower token cost. The value is that agentic
engineering becomes inspectable, budgeted, and governable.

### The hard truth

The research does not justify broad local autonomy. It also does not justify
building Portarium runtime ingestion before a live four-arm run exists.

The next experiment has to preserve four controls:

- same task across all arms;
- same public gate and private oracle;
- locked budget and frontier-call counters;
- no hidden human repair in the hybrid arm.

Without those controls, a "hybrid worked" claim would be weak.

## What GSLR-1 Can Prove

A positive GSLR-1 live result would prove:

- PL can express and run a local/frontier contract with evidence;
- hybrid routing can use fewer frontier calls than frontier-only on this task;
- local work can be bounded and escalated cleanly;
- Portarium can consume a trustworthy engineering-bead evidence packet.

It would not prove:

- universal cost savings;
- local-only autonomy;
- safety without sandboxing and policy enforcement;
- better performance than simple localization/repair on real code issues;
- production readiness for MacquarieCollege school operations.

## Decision

Do not add product integration from GSLR-1 alone.

The next build/research sequence is now:

1. add a manifest-level final verdict that fails on blocking review defects;
2. parse frontier token/cost telemetry into manifest cost fields;
3. run a harder GSLR-2 task where local-only is not already sufficient;
4. make the hybrid route cheaper than the frontier baseline by design, or change
   the success metric from call count to verified cost/tokens if final review is
   mandatory;
5. only after a positive hybrid result, create a Portarium static Cockpit
   evidence card from the manifest.

Follow-up implementation:
`docs/evaluation/2026-05-12-gslr-2-preflight.md`.

The first two prerequisites are now implemented for new harness runs:
`finalVerdict` fails unresolved blocking review defects, and Codex-style token
telemetry is promoted into `steps[].cost.totalTokens`. GSLR-2 should use these
fields as hard acceptance inputs, not post-hoc report prose.

Follow-up research decision after current Symphony/harness/routing review:
`docs/evaluation/2026-05-12-post-symphony-research-decision.md`.

That decision narrows GSLR-2 further: use a tiny code/schema task, compare
against a matched frontier-review control, require manifest-level verdict and
token telemetry, and keep Portarium product-card work blocked until the hybrid
manifest is positive.

## Sources

- OpenAI Symphony repository:
  <https://github.com/openai/symphony>
- OpenAI, "Unlocking the Codex harness: how we built the App Server":
  <https://openai.com/index/unlocking-the-codex-harness/>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://arxiv.org/abs/2406.18665>
- SWE-agent:
  <https://arxiv.org/abs/2405.15793>
- AutoCodeRover:
  <https://arxiv.org/abs/2404.05427>
- Agentless:
  <https://arxiv.org/abs/2407.01489>
- DSPy:
  <https://arxiv.org/abs/2310.03714>
- SGLang:
  <https://arxiv.org/abs/2312.07104>
- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>

## Execution Record

2026-05-12:

- Recorded the external and internal synthesis after the initial GSLR-1
  scaffold.
- Kept live model execution as the next evidence step.
- Preserved the proof boundary: current work proves experiment shape, not cost
  savings or local-model autonomy.
- Added the GSLR-1 live result. It proves harness execution and bounded local
  docs-task capability, but not hybrid cost reduction.
- Added GSLR-2 preflight hardening: manifest final verdict plus provider token
  telemetry extraction for future frontier cost comparisons.
- Added the post-Symphony research decision: Symphony validates board-level
  orchestration, but PL's remaining claim is governed, measurable work-item
  contracts with honest local/frontier routing economics.
