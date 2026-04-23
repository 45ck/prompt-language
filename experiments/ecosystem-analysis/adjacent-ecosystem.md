# Adjacent Ecosystem Analysis: Coding-Agent Harnesses and Orchestrators

**Date:** 2026-04-20
**Scope:** Open-source projects adjacent to prompt-language (PL). Excludes pi-mono, hermes-agent, openclaw (covered separately).
**Frame:** PL is a verification-first DSL orchestrator (state machine + gates + retries + spawn/race/await) that wraps coding-agent harnesses. This survey situates PL against the surrounding landscape so positioning, integration, and threat calls are explicit.

## 1. Project Catalogue (verified knowledge; website check not required for these widely documented projects)

| Project                  | One-line                                      | Category                            | Local/Ollama                        | Relation to PL                                       |
| ------------------------ | --------------------------------------------- | ----------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| aider                    | Terminal pair-programmer with git-aware edits | Harness                             | Yes (Ollama, llama.cpp via LiteLLM) | Complementary (wrap)                                 |
| opencode (sst)           | OSS Claude Code-style TUI; multi-provider     | Harness                             | Yes (Ollama, LM Studio)             | Complementary (wrap)                                 |
| OpenHands (All-Hands-AI) | Sandboxed dev agent with browser/shell tools  | Mixed harness+internal orchestrator | Yes (LiteLLM)                       | Complementary (wrap)                                 |
| Cline                    | VS Code extension agent with plan/act modes   | Harness (IDE)                       | Yes (Ollama, LM Studio)             | Complementary but IDE-bound                          |
| Roo Code                 | Cline fork with multi-mode personas           | Harness (IDE)                       | Yes                                 | Complementary but IDE-bound                          |
| Continue                 | IDE autocomplete/chat with custom agents      | Harness (IDE)                       | Yes                                 | Complementary but IDE-bound                          |
| Claude Code              | Anthropic first-party CLI harness             | Harness                             | No (Anthropic API only)             | Complementary (wrap)                                 |
| Codex CLI                | OpenAI first-party CLI harness                | Harness                             | Limited (OpenAI-compatible)         | Complementary (wrap)                                 |
| smol-developer           | Early single-shot scaffold generator          | Harness (legacy)                    | Limited                             | Low priority                                         |
| gpt-engineer             | Iterative scaffold+clarify generator          | Harness                             | Via OpenAI-compatible               | Low priority                                         |
| SWE-agent                | Research agent for SWE-bench                  | Harness + benchmark runner          | Via LiteLLM                         | Complementary                                        |
| AutoGen / Magentic-One   | Multi-agent conversation framework            | Orchestrator (framework)            | Yes (via OAI-compatible)            | Partial competitor                                   |
| LangGraph                | Graph-based agent state machine library       | Orchestrator (library)              | Yes                                 | Direct competitor (same niche: deterministic graphs) |
| CrewAI                   | Role-based multi-agent framework              | Orchestrator (framework)            | Yes                                 | Partial competitor                                   |
| DSPy                     | Prompt program compiler/optimizer             | Prompt compiler (not orchestrator)  | Yes                                 | Orthogonal                                           |
| Mirascope                | Typed LLM call library                        | SDK                                 | Yes                                 | Orthogonal                                           |
| Inspect AI (UK AISI)     | Eval framework for LLM capability/safety      | Evaluator                           | Yes                                 | Complementary (use for PL gates)                     |

## 2. Positioning Grid: Harness-vs-Orchestrator × Local-first-vs-Cloud

```
                 LOCAL-FIRST ^
                             |
     aider, opencode,        |     AutoGen, LangGraph,
     OpenHands, Cline,       |     CrewAI, Inspect AI,
     Continue, Roo            |     [PL]
     (harnesses)             |     (orchestrators)
                             |
  HARNESS  -------------------+-------------------> ORCHESTRATOR
                             |
     Claude Code,             |     (none mainstream;
     Codex CLI,               |      most orchestrators
     smol-developer,          |      are model-agnostic)
     gpt-engineer             |
                             |
                       CLOUD-ONLY v
```

PL occupies the **orchestrator + local-first** quadrant alongside LangGraph, AutoGen, CrewAI, and Inspect AI. The distinguishing angle inside that quadrant is _verification-first_ (gates, retries on failed gate) and _harness-wrapping_ (treats external CLIs as first-class units of work), neither of which is the central concern of those neighbours.

## 3. PL's Unique Value vs Closest Three Competitors

Closest three by niche overlap: **LangGraph**, **AutoGen**, **CrewAI**.

| Capability                                                                      | LangGraph              | AutoGen            | CrewAI                  | PL                |
| ------------------------------------------------------------------------------- | ---------------------- | ------------------ | ----------------------- | ----------------- |
| Graph/state-machine control flow                                                | Yes                    | Partial            | No                      | Yes               |
| First-class verification gates between steps                                    | No (user builds nodes) | No                 | No                      | Yes (declarative) |
| Retry on gate failure with bounded budget                                       | Manual                 | Manual             | Manual                  | Declarative       |
| Wraps external coding-agent CLIs (claude, aider, codex, opencode) as primitives | No                     | No                 | No                      | Yes               |
| spawn/race/await parallel primitives                                            | Emerging               | Conversation-level | Sequential/hierarchical | Yes, as DSL       |
| DSL purpose-built for coding agents                                             | No (general)           | No (general)       | No (general)            | Yes               |

Three things PL does that none of those three offer simultaneously:

1. **Harness-as-primitive.** PL addresses the reality that most OSS coding capability lives in _harnesses_ (aider/opencode/claude-code), not in SDK calls. LangGraph/AutoGen/CrewAI treat the LLM call as the primitive; PL treats the agent session as the primitive.
2. **Declarative verification gates.** Retry-until-gate-passes is a language-level construct, not a pattern the user reimplements per graph.
3. **Race/spawn semantics for coding work specifically** (e.g., race two harnesses on the same ticket, accept the first whose gate passes). Closest analogue is AutoGen group chat, which is dialogue-centric, not verification-centric.

## 4. Integration Priority List (build adapters soonest)

1. **aider** - highest ROI. Mature, git-aware, strong local-model support via LiteLLM, large user base, clean CLI surface. Wrapping aider gives PL immediate credibility and a verification layer aider itself deliberately lacks.
2. **opencode (sst)** - second. Actively developed, provider-agnostic, TUI/headless modes, already used with Ollama/LM Studio. Natural counterpart to Claude Code for users who want an OSS Anthropic-compatible harness.
3. **OpenHands** - third. Sandboxed execution, browser/shell tools, and a runtime API make it a strong primitive for tasks requiring environment isolation. Wrapping OpenHands lets PL offload sandboxing rather than build it.

Deprioritised: IDE-bound tools (Cline, Roo, Continue) are coupled to VS Code and therefore awkward for a headless orchestrator. smol-developer and gpt-engineer are largely legacy. Inspect AI is worth integrating _as a gate provider_ rather than as a harness.

## 5. Threat Assessment: Direct Competitors to "Deterministic Orchestrator Above Harnesses"

1. **LangGraph** - biggest threat. Graph-based control flow, checkpointing, human-in-the-loop, and a large ecosystem. If LangGraph ships opinionated "coding agent nodes" that wrap aider/claude-code plus verification subgraphs, the niche overlap becomes near-total. PL's defensibility is DSL ergonomics and harness-first framing; LangGraph's is ecosystem.
2. **AutoGen / Magentic-One** - secondary threat. Microsoft backing, active multi-agent research, and Magentic-One already composes coding-capable agents. If Magentic-One adds retry-until-verified semantics it compresses PL's gap.

Lower-tier threats: CrewAI (role-centric, less state-machine rigor), OpenHands (could grow an orchestrator layer internally but currently single-agent).

## 6. Three Experiments to Showcase PL's Local-First Edge

1. **Gate-driven retry on a local 7B vs single-shot cloud call.** Same ticket; PL wraps aider+Ollama with a unit-test gate and up to 5 retries. Measure pass rate and total wall cost vs a single Claude Code run. Hypothesis: bounded retry with a small local model closes most of the quality gap at a fraction of the cost.
2. **Harness race under a shared gate.** PL spawns aider+Ollama and opencode+Ollama on the same failing test. First to pass the gate wins; the other is cancelled. Compare to LangGraph equivalent (hand-written). Measure lines-of-orchestration-code and success rate.
3. **Verification-first refactor loop using Inspect AI as the gate.** PL runs a local model through a refactor DSL flow where Inspect AI scores each attempt against behavioural and style evals. Compare to CrewAI role-based equivalent on the same task. Measure regressions caught and iterations to convergence.

## Evidence Quality Notes

- Project categorisations based on public documentation, READMEs, and well-established reputation as of early 2026.
- No quantitative benchmark claims are made here; the experiments section is hypothesis-generating, not validating.
- LangGraph/AutoGen roadmaps change quickly; threat ranking should be reviewed quarterly.
- "Local/Ollama" column reflects documented support, not performance or ergonomics at that support level.
