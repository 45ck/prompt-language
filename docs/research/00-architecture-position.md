# Report 00: Architecture Position Paper

**prompt-language is not a chaining framework. It is a meta-orchestration layer for an existing autonomous agent.**

## Abstract

This document establishes the foundational architectural distinction that every other report in this series references. prompt-language occupies a unique position in the AI tooling landscape: it orchestrates Claude Code, an agent that already possesses chain-of-thought reasoning, tool use, file manipulation, error recovery, and iterative problem-solving. The DSL provides structure, sequencing, variable management, and gate enforcement — it does not provide reasoning. Understanding this distinction is essential for evaluating external research against our design.

## The spectrum of LLM orchestration

External research (see [sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), [sources/retries-recovery-branching.md](sources/retries-recovery-branching.md)) reveals a spectrum of orchestration approaches:

| Layer                       | What it does                                                                      | Examples                     |
| --------------------------- | --------------------------------------------------------------------------------- | ---------------------------- |
| **Chaining framework**      | Sequences raw LLM API calls, manages prompt templates, parses outputs             | LangChain, Haystack          |
| **Optimization compiler**   | Treats prompts as parameters, auto-tunes via training examples                    | DSPy                         |
| **Multi-agent platform**    | Coordinates multiple LLM instances with role assignments                          | CrewAI, AutoGen, Agent Teams |
| **Workflow orchestrator**   | Provides durable execution, retry policies, state persistence for any computation | Temporal, Prefect            |
| **Agent meta-orchestrator** | Structures and gates an existing autonomous agent's work                          | **prompt-language**          |

prompt-language sits in the last row. No other tool occupies this exact position.

## What prompt-language IS

prompt-language is a **workflow definition language** that tells an existing autonomous agent **what to do next** and **verifies it did it**. It is analogous to BPMN (Business Process Model and Notation) for human workers: a BPMN diagram tells a skilled worker which task to perform next, what conditions must hold before proceeding, and when the overall process is complete. It does not teach the worker how to think.

Each `prompt:` node is a **goal injection** into a full agent session. When Claude Code receives "Fix the failing auth tests", it brings to bear:

- Chain-of-thought reasoning across the full context window
- File reading, writing, and searching via dedicated tools
- Shell command execution with output analysis
- Multi-step planning and backtracking
- Error recognition and self-correction

The DSL contributes none of this. It contributes:

- **Sequencing**: First do X, then do Y
- **Repetition**: Keep doing X until condition Z
- **Branching**: If condition A, do path B; otherwise path C
- **Variable management**: Store this result, interpolate it later
- **Gate enforcement**: Do not declare "done" until these predicates pass
- **Parallelism**: Spawn child agents for independent work

## What prompt-language is NOT

### Not a chaining framework (LangChain, Haystack)

Chaining frameworks sequence **raw LLM API calls**. Each step is a single prompt-response pair, and the framework handles template rendering, output parsing, and passing data between steps. The LLM has no agency within a step — it receives a prompt, produces a response, and the framework decides what happens next.

In prompt-language, each `prompt:` node invokes a **full agent loop**. Claude Code may make dozens of tool calls, read files, execute commands, backtrack, and self-correct — all within a single node. The DSL waits for the agent to finish its autonomous work, then evaluates whether to advance.

```
Chaining framework:     prompt → LLM → parse → prompt → LLM → parse
prompt-language:        goal → [agent loop: think → act → observe → repeat] → gate check
```

### Not an optimization compiler (DSPy)

DSPy treats prompts as parameters to be optimized against training data. It compiles typed signatures into effective prompts and few-shot examples via Bayesian optimization. This is fundamentally about making individual LLM calls more effective.

prompt-language does not optimize individual calls. It does not modify how Claude Code reasons. It structures the **sequence of goals** the agent pursues and **verifies outcomes** at each step. The agent's reasoning quality comes from the underlying model and Claude Code's own architecture.

### Not a multi-agent platform (CrewAI, AutoGen)

Multi-agent platforms coordinate multiple LLM instances with distinct roles, shared message buses, and negotiation protocols. Each agent is typically a thin wrapper around an LLM API call with a role prompt.

prompt-language's `spawn`/`await` provides basic parallelism, but the spawned children are full Claude Code instances, not role-playing LLM wrappers. The primary mode is single-agent orchestration: one skilled agent, guided through a structured workflow.

### Not a workflow orchestrator (Temporal, Prefect)

Infrastructure workflow orchestrators provide durable execution, activity-level retries with backoff, and state persistence for arbitrary computation. They are language-agnostic and model-agnostic.

prompt-language provides workflow semantics (`while`, `retry`, `try/catch`, `foreach`) but is specifically designed for agent orchestration. Its primitives map to agent interactions (prompt, run, gate), not arbitrary function calls. State is lightweight (JSON file), not distributed.

## The BPMN analogy

The most precise analogy is **BPMN for an autonomous agent**:

| BPMN Concept        | prompt-language Equivalent | What it means                      |
| ------------------- | -------------------------- | ---------------------------------- |
| User Task           | `prompt:` node             | Agent works on a goal autonomously |
| Service Task        | `run:` node                | Deterministic command execution    |
| Script Task         | `let x = run "cmd"`        | Capture output for later use       |
| Exclusive Gateway   | `if`/`else`                | Branch based on condition          |
| Loop                | `while`/`until`/`retry`    | Repeat until condition or budget   |
| Parallel Gateway    | `spawn`/`await`            | Fork and join agent work           |
| Error Boundary      | `try`/`catch`/`finally`    | Handle failures gracefully         |
| End Event Condition | `done when:` gates         | Process-level completion criteria  |
| Process Variable    | `let`/`var`                | Store and interpolate values       |

The worker (Claude Code) is already skilled. The process definition (the flow) provides structure. This separation of concerns is the core design insight.

## Implications for each DSL primitive

| Primitive               | What the agent harness handles                                            | What the DSL enforces                                    |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `prompt:`               | Full reasoning, tool use, file ops, self-correction                       | When to present the goal, what text to inject            |
| `run:`                  | Nothing — deterministic execution                                         | Command execution, exit code capture, variable setting   |
| `let`/`var`             | (literal) Nothing; (prompt) full agent reasoning; (run) command execution | Variable storage, interpolation, list operations         |
| `while`/`until`         | Agent reasoning within each iteration                                     | Loop condition evaluation, iteration budget, termination |
| `retry`                 | Full agent work on each attempt                                           | Re-entry on failure, max attempts, when to give up       |
| `if`/`else`             | Agent reasoning in the taken branch                                       | Condition evaluation, branch selection                   |
| `try`/`catch`/`finally` | Agent work in each block                                                  | Error detection, control transfer, guaranteed cleanup    |
| `foreach`               | Agent work per iteration                                                  | Item splitting, variable binding, iteration              |
| `break`                 | Nothing                                                                   | Loop exit, control flow transfer                         |
| `spawn`/`await`         | Each child is a full agent session                                        | Process creation, variable passing, completion polling   |
| `done when:`            | Agent's full session after flow completes                                 | Gate predicate evaluation, stop-hook enforcement         |

## Why this distinction matters for research evaluation

When external research discusses "agent verification" ([Report 03](03-verification-and-gates.md)), the findings apply differently to prompt-language than to chaining frameworks:

1. **Specification gaming** (agents modifying tests instead of fixing code) is an agent-level problem. prompt-language cannot prevent it within a `prompt:` node, but gates can detect it externally (e.g., `tests_pass` runs the actual test suite, not the agent's claim).

2. **Context engineering** ([Report 02](02-context-engineering.md)) findings about token management apply to what we inject via `additionalContext`, but the agent handles its own internal context management.

3. **Retry patterns** ([Report 01](01-agent-workflow-patterns.md)) from frameworks like LangGraph operate at the API-call level. Our `retry` operates at the **agent-session level** — each retry gets a full autonomous agent attempt, not a single LLM call.

4. **Developer trust** ([Report 05](05-developer-trust.md)) findings about "fake completion" directly motivate our gate system. Gates are external verification, not agent self-assessment.

5. **Prompt frameworks** ([Report 04](04-prompt-frameworks.md)) for structured output are irrelevant to our core loop — Claude Code already handles structured interaction. They may be relevant for `let x = prompt` capture formatting.

## Design principles derived from this position

1. **The DSL should never duplicate agent capabilities.** If Claude Code can already do something (e.g., decide which file to edit), the DSL should not try to control it.

2. **Gates are the highest-value primitive.** External verification of agent work is the primary mechanism for reliability. Every other primitive is structure; gates are trust.

3. **Simplicity over expressiveness.** The DSL needs just enough control flow to express common agent workflows. Complex logic belongs in the agent's reasoning, not the DSL.

4. **Fail loudly, not cleverly.** When the agent fails, the DSL should surface the failure clearly (try/catch), not attempt sophisticated recovery that competes with the agent's own error handling.

5. **Variables bridge agent and DSL.** Variables (`let`/`var`) are the mechanism for the DSL to observe agent work and for the agent to receive DSL-computed context. They are the API between the two layers.

## Sources

- [sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md) — Eight architectural patterns, seven framework comparisons
- [sources/retries-recovery-branching.md](sources/retries-recovery-branching.md) — Retry/recovery mechanisms across LangGraph, CrewAI, AutoGen, Temporal, Prefect
- [sources/dsl-plugin-deep-research.md](sources/dsl-plugin-deep-research.md) — Original feasibility research for the DSL plugin concept
- [sources/agentic-ide-architecture.md](sources/agentic-ide-architecture.md) — How current agentic IDEs are built
- [sources/agent-verification-completion.md](sources/agent-verification-completion.md) — Verification patterns across Copilot, Cursor, Devin, Claude Code, SWE-agent
