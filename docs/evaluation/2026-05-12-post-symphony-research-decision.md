# Post-Symphony GSLR Research Decision: 2026-05-12

Status: research decision record  
Tracking bead: `prompt-language-gslr5`  
Companion Portarium bead: `bead-1230`

## Question

After GSLR-1 and OpenAI's public Symphony write-up, what should we build next,
and why?

## Conclusion

Build GSLR-2, but narrow the claim.

The current evidence does not support "local models replace Codex" or "more
agents equals better engineering". The defensible claim is:

```text
Prompt Language can make a work item executable, inspectable, and measurable.
Portarium can govern that work item before consequential actions happen.
Local models are useful only for bounded lanes with gates, private oracles,
and frontier escalation/review.
```

OpenAI Symphony makes the board-to-agent control-plane pattern real prior art.
That is good news for the direction, but it also means our novelty is not "a
board starts agents". Our useful wedge is governed evidence: route decisions,
budgets, gates, artifacts, review defects, and approval boundaries that an
operator can trust.

## What The Literature Says

### Board orchestration is now table stakes

OpenAI Symphony turns project-management work into isolated coding-agent runs:
one issue can get one workspace, long-running agents are restarted or reconciled,
and humans review the resulting work. The write-up also says this reduced
context switching and increased landed pull requests on some teams.

That validates the Portarium Cockpit/Beads framing. It also removes any easy
claim that an issue-board orchestrator is novel by itself.

The consequence for PL is clear: PL should not become Linear, Beads, or
Symphony. PL should be the executable contract inside the work item.

### Harness engineering beats prompt cleverness

OpenAI's harness-engineering framing says the hard work is agent-friendly repo
design, tests, guardrails, documentation, and feedback loops. That matches our
GSLR-1 lesson: the interesting failure was not that a model failed to edit a
document; it was that the harness could not initially express the final verdict
and cost evidence strongly enough.

This supports the GSLR-2 preflight work already completed: `finalVerdict`,
blocking review defects, and token telemetry need to be machine-readable inputs,
not prose in a report.

### Routing is credible, but naive hybrid routing is weak

FrugalGPT and RouteLLM support the economics of cascades and learned routing:
use cheaper/weaker models when they are likely to be enough, escalate when they
are not. But software engineering is not a plain query-answering task. It has
diffs, tools, tests, private oracles, sandbox policy, and human acceptance.

GSLR-1 is consistent with the literature's warning: routing can save cost only
when the policy is measured. Our first hybrid arm used more frontier work than
the frontier-only control and carried a blocking review defect. That is a useful
negative result, not a disappointment.

### Prompt compression, caching, and compilation matter too

Cost reduction is not only "local model instead of frontier model".

OpenAI prompt caching, LLMLingua, DSPy, SGLang, LMQL, and related systems all
point to a broader lesson: structure the program so repeated static context is
reused, prompts are compact or compiled against metrics, outputs are constrained,
and multi-call workflows avoid redundant work.

For PL, that means GSLR-2 should measure:

- frontier total tokens;
- cached input tokens where available;
- local calls and wall time;
- route decisions and escalation triggers;
- whether static instructions stay stable enough for caching.

### Local model endpoints are practical, but validation is non-negotiable

Ollama, vLLM, llama.cpp, and Hugging Face TGI all support OpenAI-compatible or
near-compatible local inference surfaces. OpenAI also has open-weight `gpt-oss`
models aimed at local and specialized use cases.

This makes the local lane practical as infrastructure. It does not make local
free-form output trustworthy. Local lanes should produce bounded artifacts under
schema checks, tests, private oracles, and frontier review when the work is
consequential.

### Agent orchestration frameworks are complementary, not the thesis

OpenAI Agents SDK, LangGraph, CrewAI, AutoGen, and HumanLayer-style approval
systems show that handoffs, traces, human-in-the-loop, and stateful agent flows
are common product directions.

PL's differentiator should not be "we can orchestrate agents". It should be:

- readable work-item contracts;
- deterministic gates and retry semantics;
- evidence manifests that survive review;
- policy handoff to Portarium;
- honest baselines that can falsify the routing claim.

## What We Just Learned Internally

GSLR-1 taught four concrete things:

1. The safe MC projection and four-arm shape are viable.
2. Local-only can solve a tiny docs projection, so that task was too easy.
3. A hybrid route can be worse than frontier-only if review/escalation is not
   budgeted correctly.
4. The manifest had to become the source of truth for final verdict and tokens.

The post-run hardening fixed item 4 for future runs. It did not retroactively
turn GSLR-1 into positive product evidence.

## What GSLR-2 Should Prove

GSLR-2 can prove one narrow, exciting thing:

```text
For a small code/schema task, a governed PL route can use a local model for a
bounded implementation lane, escalate/review through frontier only where needed,
and produce a passing manifest with lower matched frontier token cost than a
frontier-only control.
```

That would be meaningful because it ties together:

- PL as executable contract;
- local models as bounded workers;
- frontier models as reviewer/escalation authority;
- Portarium as evidence and approval consumer;
- cost telemetry as a first-class result.

It would not prove:

- broad local autonomy;
- production school-ops readiness;
- universal cost savings;
- that Symphony/board orchestration is enough by itself;
- that Portarium should ingest live runner events yet.

## GSLR-2 Design Decision

Use a tiny schema/code task, not another docs projection.

Required shape:

- one schema or validator change;
- one implementation file;
- one public test file;
- one private oracle that catches shallow fixes;
- four arms: `local-only`, `frontier-only`, `advisor-only`, `hybrid-router`;
- manifest `finalVerdict.status == "pass"` required for success;
- no unresolved blocking review defects;
- token telemetry required for all frontier steps.

Matched-cost rule:

- If final frontier review is mandatory for the hybrid arm, the frontier-only
  control must include the same final review, or the report must separate
  `implementation frontier tokens` from `mandatory review tokens`.
- Otherwise the experiment will punish the hybrid route for doing safer review
  work and the cost comparison will be ambiguous.

## What Now

1. Implement the GSLR-2 fixture in `experiments/harness-arena/`.
2. Add a route-policy manifest field that records why the hybrid arm chose
   local, frontier, or escalation.
3. Keep prompt prefixes stable enough that OpenAI prompt caching can work when
   frontier calls repeat shared instructions.
4. Run all four arms with no hidden human repair.
5. Only if the hybrid manifest passes and beats the matched frontier baseline,
   create the first Portarium static evidence card.

If GSLR-2 fails, the right next step is not product integration. It is to improve
the route policy, fixture difficulty, local runner protocol, or matched-control
design until the evidence can actually answer the question.

## Sources

- OpenAI, "An open-source spec for Codex orchestration: Symphony":
  <https://openai.com/index/open-source-codex-orchestration-symphony/>
- OpenAI, "Harness engineering: leveraging Codex in an agent-first world":
  <https://openai.com/index/harness-engineering/>
- OpenAI API, Prompt caching:
  <https://platform.openai.com/docs/guides/prompt-caching>
- OpenAI API, Agents SDK:
  <https://platform.openai.com/docs/guides/agents-sdk/>
- OpenAI API, `gpt-oss-20b` model page:
  <https://developers.openai.com/api/docs/models/gpt-oss-20b>
- FrugalGPT:
  <https://arxiv.org/abs/2305.05176>
- RouteLLM:
  <https://openreview.net/forum?id=8sSqNntaMr>
- LLMLingua:
  <https://arxiv.org/abs/2310.05736>
- DSPy:
  <https://arxiv.org/abs/2310.03714>
- SGLang:
  <https://arxiv.org/abs/2312.07104>
- LMQL:
  <https://arxiv.org/abs/2212.06094>
- LangGraph overview:
  <https://docs.langchain.com/langgraph>
- Ollama structured outputs:
  <https://docs.ollama.com/capabilities/structured-outputs>
- vLLM OpenAI-compatible server:
  <https://docs.vllm.ai/en/v0.7.1/serving/openai_compatible_server.html>
- Hugging Face TGI Messages API:
  <https://huggingface.co/docs/text-generation-inference/reference/api_reference>

## Execution Record

2026-05-12:

- Re-read the internal GSLR-1 live result and GSLR-2 preflight records.
- Checked current external work on OpenAI Symphony, harness engineering, prompt
  caching, agent SDKs, model routing, prompt compression, prompt-programming
  systems, and local inference endpoints.
- Recorded the next decision: run GSLR-2 as a tiny code/schema experiment with
  matched frontier-review cost accounting before any Portarium product card.
