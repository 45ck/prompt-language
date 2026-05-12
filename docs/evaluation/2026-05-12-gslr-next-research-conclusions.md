<!-- cspell:words FrugalGPT RouteLLM LLMLingua Qwen Ollama vLLM -->

# GSLR Next Research Conclusions: 2026-05-12

Status: research conclusion record  
Tracking bead: `prompt-language-gslr9`  
Companion Portarium bead: `bead-1234`

## Short Answer

Do not build Portarium runtime ingestion yet.

Do not run another generic hybrid/local/frontier shootout.

Build the GSLR fixture-family ladder:

1. `gslr3-policy-manifest-transform`
2. `gslr4-two-file-validator`
3. `gslr5-raw-payload-adversarial`

The point is to discover a route policy by task shape, not to prove that any one
model or topology is universally best.

## What We Learned

GSLR-2 changed the hypothesis.

The original exciting claim was:

```text
Hybrid local/frontier routing can beat frontier-only on cost while preserving
quality.
```

The live result says something narrower and more useful:

```text
For tiny one-file policy/schema work with strong gates, a local model can be
screened safely enough to avoid frontier work. Hybrid review is not free and
must be justified by risk, not habit.
```

That is a stronger engineering conclusion because it tells us when not to spend
frontier tokens.

## External Evidence Check

### OpenAI / grey literature

OpenAI Symphony makes issue-board-to-agent orchestration credible prior art. It
also says orchestration works by turning issues into isolated workspaces,
watching status, recovering failed runs, and handing humans review packets.
That validates the Cockpit/Beads shape, but removes "board starts agents" as a
novel claim.

OpenAI's harness-engineering write-up points to the deeper lesson: agent
velocity comes from repository-local knowledge, executable feedback loops,
observability, custom lints, tests, and legible architecture. That maps directly
to Prompt Language's value: PL should be the executable work contract and
measurement layer inside the work item.

OpenAI's current model docs now make the frontier/local split sharper:
`gpt-5.5` is positioned as the flagship model for complex reasoning and coding,
while `gpt-oss-20b` is an open-weight model aimed at low-latency, local, or
specialized use cases. That supports a routed stack: frontier for difficult
reasoning and review, open/local models for bounded lanes with gates.

Prompt caching also matters. Cost reduction should not rely only on local
models. Stable prompt prefixes, reusable schemas, and measured `cached_tokens`
are part of the economics.

### White papers

FrugalGPT and RouteLLM support the general idea of cascades and routers:
cheaper models can reduce cost if a measured policy decides when they are
enough. But GSLR-2 shows why software engineering needs stricter routing than
plain query answering: diffs, hidden oracles, review defects, side effects,
privacy boundaries, and human acceptance all change the cost model.

SWE-agent supports the importance of agent-computer interfaces. Agents need a
designed interface to edit, inspect, test, and navigate code. That favors
Prompt Language flows plus harness fixtures over raw prompt strings.

DSPy and LLMLingua support a separate cost lever: prompt programs should be
compiled, compressed, and optimized against metrics instead of hand-tuned as
giant brittle prompts. For PL, that means the experiment should measure whether
stable flow fragments and schemas reduce prompt churn.

### Local-model infrastructure

Ollama and vLLM both support structured output paths. This makes local model
lanes practical for policy/schema work, especially when the output is bounded.
It does not make local free-form implementation trustworthy. The trust comes
from schema checks, public gates, private oracles, resource telemetry, and
escalation.

Qwen3-Coder-Next is also relevant: recent open-weight coding-agent models are
being trained with executable environments and agentic feedback. That supports
continuing local-lane experiments, but it does not replace our evidence. Our
checked-in live evidence is still for `qwen3-coder:30b` on one tiny task.

## Internal Evidence Check

GSLR-1:

- proved the four-arm harness shape can run;
- proved the MC projection can stay sanitized;
- proved the first task was too easy;
- showed hybrid can be worse than frontier-only when review is not budgeted.

GSLR-2:

- moved from docs projection to tiny code/schema work;
- added public gate, private oracle, final verdict, and token telemetry;
- showed all four arms can pass;
- showed local-only was best on this exact task;
- showed advisor-only is the cheaper first escalation candidate;
- showed hybrid-router is not cost-effective for tiny validators.

The new route policy is therefore correct:

```text
gslr2-policy-schema -> local-screen
```

It is not yet:

```text
all schema work -> local-promoted
all governed engineering work -> local-first
all risky work -> hybrid-router
```

## Conclusion

The thing we are building is not "a cheaper Codex".

The thing we are building is:

```text
a governed engineering control plane where each bead carries an executable
contract, route decision, evidence budget, gates, artifacts, and approval
boundary.
```

Prompt Language supplies the executable contract and measurable lanes.
Portarium supplies policy and approval at the action boundary.
Local models supply cheap bounded attempts.
Frontier models supply difficult reasoning, repair, and review when evidence
says they are needed.

## What Now

Build `gslr3-policy-manifest-transform` first.

Why: it is the closest neighbor to GSLR-2 but changes the task from validation
to schema-to-schema transformation. If local-only passes, we have evidence that
the local-screen rule is not a one-off validator fluke.

Then build `gslr4-two-file-validator`.

Why: file-count and contract coupling are where local lanes usually start to
drift. The hypothesis should be advisor-only, not local-only. If local-only
passes anyway, that is useful; if it fails and advisor-only passes cheaply, that
teaches the escalation boundary.

Then build `gslr5-raw-payload-adversarial`.

Why: privacy-sensitive ambiguity is the product-critical risk. The expected
route should be frontier-baseline or mandatory review. If local-only passes
public tests but fails the private oracle, that is valuable negative evidence
and should shape Portarium's approval defaults.

After those three, build only a static Portarium evidence-card shape. Do not
connect runtime ingestion until the static card can represent:

- task shape;
- route decision;
- selected model;
- public gate result;
- private oracle result;
- final verdict;
- review defects;
- local resource telemetry;
- frontier token and cached-token telemetry;
- explicit reason product action is blocked or approved.

## Product Boundary

Portarium runtime ingestion remains blocked.

MC connector observation remains blocked.

The next product-facing artifact is a static evidence-card schema, not a live
action path.

## Sources

- OpenAI, "An open-source spec for Codex orchestration: Symphony":
  <https://openai.com/index/open-source-codex-orchestration-symphony/>
- OpenAI, "Harness engineering: leveraging Codex in an agent-first world":
  <https://openai.com/index/harness-engineering/>
- OpenAI API, Models:
  <https://developers.openai.com/api/docs/models>
- OpenAI API, `gpt-oss-20b` model page:
  <https://developers.openai.com/api/docs/models/gpt-oss-20b>
- OpenAI API, Prompt caching:
  <https://developers.openai.com/api/docs/guides/prompt-caching>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://openreview.net/forum?id=8sSqNntaMr>
- SWE-agent:
  <https://arxiv.org/abs/2405.15793>
- DSPy:
  <https://arxiv.org/abs/2310.03714>
- LLMLingua:
  <https://arxiv.org/abs/2310.05736>
- Ollama structured outputs:
  <https://docs.ollama.com/capabilities/structured-outputs>
- vLLM structured outputs:
  <https://docs.vllm.ai/en/v0.18.1/features/structured_outputs/>
- Qwen3-Coder-Next technical report:
  <https://arxiv.org/abs/2603.00729>

## Execution Record

2026-05-12:

- Re-checked OpenAI Symphony, harness engineering, current OpenAI model docs,
  prompt caching, routing/cascade papers, agent-interface papers, prompt-program
  papers, and local structured-output endpoint docs.
- Re-read internal GSLR-1, GSLR-2, and route-policy receipts.
- Recorded the next conclusion: build the fixture-family ladder before any
  Portarium runtime ingestion or MC connector observation.
- Added the first ladder rung, `gslr3-policy-manifest-transform`, as a
  deterministic fake-live scaffold. This proves the manifest-to-card fixture,
  public gate, private oracle, token aggregation checks, and raw-payload leak
  checks work before spending live local/frontier model tokens.
