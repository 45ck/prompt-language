# Report 01: Agent Workflow Patterns

> Q1: How do people structure agent workflows in production?

## Abstract

This report synthesizes findings from five research sources covering eight architectural chaining patterns, seven framework deep-dives, retry/recovery strategies across five production platforms, always-on agentic organization design, and the original DSL plugin feasibility study. The central finding is that the industry overwhelmingly builds agent workflows by composing raw LLM API calls into deterministic pipelines, starting simple and adding complexity only when measurably justified. prompt-language diverges from this norm in a fundamental way: each "step" in a flow is not an API call but a full autonomous agent session with its own chain-of-thought, tool use, and self-correction. This report maps where industry patterns align with prompt-language's design, where they diverge, and where the divergence is a strength rather than a gap.

## Architecture Note

As established in [Report 00](00-architecture-position.md), prompt-language is an agent meta-orchestrator, not a chaining framework. When this report discusses "sequential chains" or "retry policies" from external research, these patterns operate at the LLM-API-call level in other frameworks but at the agent-session level in prompt-language. A `retry max 3` in prompt-language gives the agent three full autonomous attempts at solving a problem -- each involving potentially dozens of internal tool calls, file edits, and reasoning steps -- rather than three repetitions of a single prompt-response pair.

## Key Findings

### Finding 1: Sequential chains cover 80% of production use cases

The most consistent finding across sources is that simple sequential pipelines handle the vast majority of real-world needs. Anthropic explicitly recommends: "For many applications, optimizing single LLM calls with retrieval and in-context examples is usually enough" ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part III). HockeyStack's production data over 1+ years confirmed that "splitting tasks into smaller, simpler LLM calls reliably improved latency, cost, AND reliability versus monolithic agents" ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part III). The guidance is unambiguous: start with the simplest pattern that works, and add complexity only when it demonstrably improves outcomes ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I).

This aligns with prompt-language's design philosophy. A flow with two `prompt:` nodes and a `done when:` gate is a sequential chain. The DSL makes it trivial to start simple and add control flow incrementally.

### Finding 2: The evaluator-optimizer loop is the most practically useful iteration pattern

Anthropic calls this the "evaluator-optimizer" workflow: generate output, evaluate it against specific criteria, and refine based on the evaluation. Research shows that 2-3 iterations capture most of the improvement, with diminishing returns after that ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I). The key risk is Degeneration-of-Thought -- when the same model critiques itself, it can reinforce errors rather than fix them. Grounded reflection, where the critic cites specific evidence or references external data, mitigates this.

This pattern maps directly to prompt-language's `while`/`until` loops with `run:` nodes as the evaluation step. The external command evaluation (test suites, linters) provides the "grounded" feedback that prevents Degeneration-of-Thought -- the agent does not evaluate itself; an external predicate does.

### Finding 3: Retry strategies differ dramatically across frameworks, from per-node to infrastructure-grade

The five frameworks studied in [sources/retries-recovery-branching.md](sources/retries-recovery-branching.md) reveal a wide spectrum. LangGraph provides declarative per-node `RetryPolicy` with exponential backoff, jitter, and custom exception filtering. CrewAI distributes retries across three layers: LLM API retries, agent execution retries (`max_retry_limit`), and task guardrail retries that feed error messages back to the agent as context. AutoGen uses config-list failover across model endpoints. Temporal provides unlimited-by-default activity retries with event-sourced replay -- the only framework where retries are opt-out rather than opt-in. Prefect offers explicit `retry_condition_fn` for conditional retries.

The most robust production pattern identified is **layered retries**: fast automatic retries for transient infrastructure errors, slower feedback-driven retries for semantic failures, and human escalation as the final fallback ([sources/retries-recovery-branching.md](sources/retries-recovery-branching.md), Production Patterns).

### Finding 4: State management and durable execution separate production from prototype

The most consequential architectural difference among frameworks is how they handle partial failures and preserve state ([sources/retries-recovery-branching.md](sources/retries-recovery-branching.md), Error Recovery). LangGraph saves checkpoint snapshots at superstep boundaries and can resume on a different machine months later. Temporal achieves automatic durable execution via event sourcing -- every activity result is recorded in an append-only Event History, and workers that crash replay history to restore exact pre-failure state without re-executing completed activities. CrewAI and AutoGen have weaker recovery stories: CrewAI's `@persist` is a save point, not durable execution; AutoGen requires explicit `save_state()`/`load_state()` with no automatic checkpointing.

The industry is converging on a pattern: OpenAI Codex, Replit Agent, and Retool Agents all run on Temporal in production, wrapping agent frameworks inside infrastructure-grade workflow engines for durability ([sources/retries-recovery-branching.md](sources/retries-recovery-branching.md), Production Patterns).

### Finding 5: The Planner-Worker architecture dominates task decomposition

Multi-agent coordination patterns cluster into four models: hierarchical (manager/worker), peer-to-peer (handoffs), debate/adversarial, and ensemble ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I). The hierarchical planner-worker model dominates in practice. OpenAI's Agents SDK implements this as "agents as tools" -- a central agent orchestrates specialists via tool calls. CrewAI models teams with `role`, `goal`, and `backstory` where tasks chain through explicit `context` parameters ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part II).

However, a 2025 study across 180 experiments found that independent multi-agent systems without shared context sometimes performed worse than single agents (-4.6%), because coordination overhead exceeds collaboration benefits ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I). The recommendation is clear: start single-agent, add agents only when you can measure the improvement.

### Finding 6: DAG orchestration is the dominant graph model, but cycles require special handling

Most production frameworks model workflows as directed acyclic graphs. LCEL and Haystack pipelines are pure DAGs. The critical limitation is that DAGs cannot represent "try again if the output is wrong" -- that requires a back-edge, which violates acyclicity. LangGraph exists precisely to solve this: it extends DAG orchestration with cycle support via conditional back-edges for agent loops, self-correction, and multi-agent coordination ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I and Part II).

LlamaIndex Workflows take an alternative approach: event-driven steps connected by typed events, where loops work naturally because a step can emit an event type that triggers an earlier step ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part II). Haystack supports cycles natively with `max_runs_per_component` safety limits.

### Finding 7: Map-reduce parallelism is the standard for independent subtasks

When work decomposes into independent units, map-reduce fans out to parallel LLM calls and combines results in a reduction step. LangGraph's `Send` primitive enables dynamic map-reduce where the number of parallel branches is determined at runtime ([sources/retries-recovery-branching.md](sources/retries-recovery-branching.md), Conditional Branching). CrewAI's Flows provide `or_()` and `and_()` combinators for fork-join patterns. Temporal and Prefect achieve parallelism through native async constructs (`asyncio.gather`, `.map()`, `.submit()`).

The key challenge is **loss of cross-chunk context**: each parallel branch processes in isolation, so themes spanning branches may be missed or duplicated. When cross-document coherence matters more than speed, iterative refinement preserves continuity at the cost of sequential execution ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I).

### Finding 8: Conditional branching philosophies diverge sharply between graph-native and code-native

LangGraph and AutoGen model branching as explicit graph edges -- `add_conditional_edges()` inspects state and routes to different nodes. CrewAI's Flows use `@router` decorators where the return value determines which `@listen` handlers activate. Temporal and Prefect use native Python `if/else` made durable through their execution models -- no graph DSL to learn ([sources/retries-recovery-branching.md](sources/retries-recovery-branching.md), Conditional Branching).

The "just code" approach (Temporal, Prefect) makes branching logic immediately readable as standard control flow. The graph approach (LangGraph, AutoGen) provides visualization and formal topology inspection at the cost of requiring a separate routing abstraction. prompt-language's approach (`if condition` / `else` / `end`) is closer to the "just code" philosophy, using familiar control-flow syntax rather than graph edge declarations.

### Finding 9: Memory architectures must be explicitly managed across the stateless gap

LLMs are stateless -- memory must be explicitly managed. Five memory types serve different needs: conversation buffer (full history, fills context), summary memory (compressed, 90%+ token reduction), vector store memory (RAG pattern, unlimited recall), episodic memory (temporal metadata, "what happened when?"), and procedural memory (system instructions) ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I).

The always-on agentic organization research reinforces this: the strongest control planes use event-sourced ledgers as their source of truth, with every action recorded as a typed event ([sources/always-on-agentic-org-v1.md](sources/always-on-agentic-org-v1.md), Agent Design Patterns; [sources/always-on-agentic-org-v2.md](sources/always-on-agentic-org-v2.md), Event Sourcing). The design principle is that "memory complexity should scale with model capability" ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I).

### Finding 10: Always-on systems require proposal-first governance and stage-gated pipelines

The always-on agentic organization research identifies a convergent architecture for reliable continuous operation: a hybrid of triad separation-of-duties (Plan -> Approve -> Execute), ICS-style functional departments (Ops, Planning, Logistics, Finance/Admin), and stage-gated pipelines (Intake -> Triage -> Plan -> Risk -> Gate -> Execute -> Verify -> Publish) ([sources/always-on-agentic-org-v1.md](sources/always-on-agentic-org-v1.md), Recommended Hybrids; [sources/always-on-agentic-org-v2.md](sources/always-on-agentic-org-v2.md), Recommended Hybrids).

The decisive design pressure is that agentic systems ingest untrusted data while possessing real actuators. Safety must be engineered as impact reduction -- compartmentalization, approval gates, and deny-by-default tool exposure -- not merely model alignment ([sources/always-on-agentic-org-v1.md](sources/always-on-agentic-org-v1.md), Executive Summary). This maps directly to prompt-language's `done when:` gate system and `run:` auto-execution model: the DSL enforces structure externally, independent of the agent's self-assessment.

### Finding 11: Programmatic gates between steps are the recommended reliability primitive

Anthropic's documentation emphasizes inserting "programmatic gates" between sequential steps -- validation checks that verify format, length, or required fields before proceeding. This catches errors early rather than letting them cascade ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part I). CrewAI implements this as task guardrails: when a guardrail function returns `(False, "error message")`, the error message is fed back to the agent, creating a self-correcting feedback loop that is semantically different from blind retries ([sources/retries-recovery-branching.md](sources/retries-recovery-branching.md), CrewAI Retries).

The original DSL feasibility research identified quality gates as the highest-value enforcement mechanism: the `TaskCompleted` hook blocks task completion and feeds back failures via exit code 2, creating a high-signal corrective loop ([sources/dsl-plugin-deep-research.md](sources/dsl-plugin-deep-research.md), Safety and Guardrails). This is prompt-language's `done when:` primitive -- the mechanism that distinguishes meta-orchestration from hopeful prompting.

### Finding 12: Framework overhead is negligible; the real cost is in call count and token usage

Benchmark data shows framework overhead ranges from 3-14ms across all major frameworks, dwarfed by API latency of 200-800ms per call ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part III). The real cost difference comes from how many calls and tokens each framework's abstractions generate -- LangChain averaged approximately 2,400 tokens per query in benchmarks versus Haystack's approximately 1,570 for the same task. Caching strategies provide dramatic savings: prompt prefix caching cuts costs up to 50%, and plan caching reduces costs by 50.3% and latency by 27.3% while maintaining 96.6% accuracy ([sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md), Part III).

For prompt-language, this finding is significant because each `prompt:` node invokes a full agent session that may consume thousands of tokens internally. The DSL's overhead is truly negligible (JSON state file reads/writes), but the per-node cost is much higher than a single API call. This makes iteration budgets (`max` parameters on loops) a genuine cost control mechanism, not just a safety valve.

## How prompt-language Compares

| Finding                          | Industry Pattern                                                     | prompt-language Today                                                               | Gap?                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1. Sequential chains as default  | Start simple, chain 2-5 API calls                                    | `prompt:` nodes in sequence, natural starting point                                 | No -- this is the default usage pattern                                                                      |
| 2. Evaluator-optimizer loop      | Generate -> evaluate -> refine with external criteria                | `while`/`until` + `run:` for external evaluation (test suites, linters)             | No -- external command evaluation prevents Degeneration-of-Thought                                           |
| 3. Layered retry strategies      | Infrastructure retries + semantic retries + human escalation         | `retry max N` provides single-layer agent-session retries                           | Partial -- no exponential backoff, no tiered retry (infra vs semantic), no human escalation node             |
| 4. Durable state management      | Event-sourced replay (Temporal), checkpoint recovery (LangGraph)     | JSON state file in `.prompt-language/session-state.json` with advisory file locking | Yes -- no crash recovery, no replay capability, no event history                                             |
| 5. Planner-worker decomposition  | Central planner delegates to specialist workers                      | `spawn`/`await` for parallel child agents; no built-in planner role                 | Partial -- parallelism exists but no hierarchical delegation or role assignment                              |
| 6. DAG with cycle support        | Graph model with conditional back-edges (LangGraph)                  | Tree-structured AST with `while`/`until`/`retry` for cycles                         | No -- cycles supported via structured control flow rather than graph edges; simpler model                    |
| 7. Map-reduce parallelism        | Fan-out to parallel workers, reduce results                          | `foreach` for serial iteration; `spawn`/`await` for parallel                        | Partial -- `foreach` is serial; `spawn` is parallel but lacks structured reduce/merge                        |
| 8. Conditional branching         | Graph edges (LangGraph), decorators (CrewAI), native code (Temporal) | `if`/`else` with variable and command conditions, `and`/`or` operators              | No -- code-native approach, familiar syntax, compound conditions supported                                   |
| 9. Explicit memory management    | Vector stores, summary memory, episodic memory                       | Variables (`let`/`var`) persist across nodes; session state JSON                    | Partial -- simple key-value memory; no semantic search, no summary compression, no cross-session persistence |
| 10. Proposal-first governance    | Stage-gated pipelines with approval gates for high-impact actions    | `done when:` gates enforce completion criteria; no approval/proposal workflow       | Yes -- no human-in-the-loop approval node, no risk classification, no action-class gating                    |
| 11. Programmatic gates           | Validation checks between steps, guardrail feedback loops            | `done when:` predicates (`tests_pass`, `file_exists`, custom `gate` commands)       | No -- this is prompt-language's strongest primitive; external verification is core to the design             |
| 12. Cost-conscious orchestration | Caching, model tiering, token budgets                                | `max` iteration limits on loops; no token tracking or caching                       | Partial -- iteration budgets exist but no per-node token limits, no cost tracking, no model tiering          |

## DSL Examples

### Sequential chain (Finding 1)

The simplest and most common pattern -- two goals in sequence with a completion gate:

```
Goal: Add input validation to the API

flow:
  prompt: Add zod validation schemas for all API request bodies
  prompt: Add integration tests for the new validation

done when:
  tests_pass
```

### Evaluator-optimizer loop (Finding 2)

External test evaluation prevents the agent from deceiving itself about progress:

```
Goal: Fix the failing auth tests

flow:
  while tests_fail max 4
    prompt: Inspect the failing tests, identify the root cause, and apply the smallest fix
    run: npm test -- --filter auth
  end
```

### Layered retry with error feedback (Finding 3)

Using `try`/`catch` with `retry` provides two layers of error handling:

```
Goal: Deploy the database migration

flow:
  retry max 3
    try
      run: npx prisma migrate deploy
    catch
      let error = run "npx prisma migrate status"
      prompt: The migration failed. Status: ${error}. Fix the migration file.
    end
  end

done when:
  command_succeeded
```

### Variable pipeline with conditional branching (Findings 5, 8)

Variables bridge agent output to DSL control flow. The agent reasons; the DSL routes:

```
Goal: Fix the CI failure

flow:
  let status = run "npm run ci 2>&1 | tail -20"
  if command_failed
    let exit_code = run "echo ${last_exit_code}"
    if ${last_stderr} == "lint"
      prompt: Fix the lint errors shown in: ${status}
      run: npm run lint
    else
      prompt: Fix the test failures shown in: ${status}
      run: npm test
    end
  end

done when:
  tests_pass
  lint_pass
```

### Parallel work with spawn/await (Finding 7)

Independent tasks run in parallel as full agent sessions:

```
Goal: Prepare the release

flow:
  spawn "changelog"
    prompt: Generate a changelog from recent git commits
  end
  spawn "docs"
    prompt: Update the API documentation for all changed endpoints
  end
  await all
  prompt: Review ${changelog.last_stdout} and ${docs.last_stdout}, create the release PR
```

### Foreach with list accumulation (Finding 7, serial variant)

```
Goal: Migrate all config files to the new format

flow:
  let files = run "find src -name '*.config.js' -type f"
  let results = []
  foreach file in "${files}"
    prompt: Migrate ${file} from CommonJS to ESM format
    let results += run "node --check ${file} && echo 'OK: ${file}' || echo 'FAIL: ${file}'"
  end
  prompt: Migration summary: ${results}
```

### Gate-only mode for external verification (Finding 11)

No flow block needed -- the gate alone constrains when the agent can declare completion:

```
Goal: Fix the broken build

done when:
  tests_pass
  lint_pass
```

## Enhancement Opportunities

The following opportunities emerge from gaps identified in the comparison table. These should be evaluated against the design principle from Report 00: "The DSL should never duplicate agent capabilities."

- **Backoff and retry policy configuration** (Finding 3): Add optional backoff semantics to `retry`, e.g., `retry max 5 backoff exponential`. Currently all retries are immediate. LangGraph's per-node `RetryPolicy` with `backoff_factor` and `jitter` is the cleanest model. Cross-reference Report 07 for prioritization.

- **Human approval gate node** (Findings 3, 10): Add an `approval "message"` node that pauses execution and requires explicit human confirmation before proceeding. The original DSL feasibility research included this in the proposed grammar ([sources/dsl-plugin-deep-research.md](sources/dsl-plugin-deep-research.md), Minimal Grammar). This directly addresses the always-on governance research's emphasis on proposal-first workflows for high-impact actions.

- **Structured merge/reduce for spawn** (Finding 7): Currently `spawn`/`await` imports child variables with name prefixes, but there is no structured merge strategy (concat, de-dup, summarize). Adding a reduce mode to `await` would enable map-reduce patterns: `await all reduce "summarize"`.

- **Durable state and crash recovery** (Finding 4): The current JSON state file provides persistence but no crash recovery or replay capability. An event-sourced approach -- recording node entry, variable changes, and gate results as append-only events -- would enable resume-after-crash and post-hoc debugging. The always-on research strongly recommends this pattern ([sources/always-on-agentic-org-v1.md](sources/always-on-agentic-org-v1.md), Messaging Bus Patterns).

- **Per-node token and cost budgets** (Finding 12): Add optional `budget` constraints to nodes, e.g., `prompt: Fix the tests [max_tokens: 50000]`. Each `prompt:` node invokes a full agent session that could consume significant resources. Explicit budgets give the DSL cost control without duplicating the agent's reasoning.

- **Parallel foreach** (Finding 7): Add a `foreach ... parallel` mode that spawns items concurrently rather than iterating serially. The current `foreach` processes items sequentially; for independent items, parallelism could dramatically reduce wall-clock time.

- **Cross-session memory** (Finding 9): Consider a `memory` or `context` directive that loads variables from a previous session, enabling multi-session workflows. The always-on research emphasizes event-sourced ledgers that persist across sessions and support replay ([sources/always-on-agentic-org-v2.md](sources/always-on-agentic-org-v2.md), Definitions).

- **Action classification and risk gating** (Finding 10): For always-on or continuous-operation scenarios, add risk classification to `run:` nodes (reversible vs. high-impact) with different approval requirements. This maps to the always-on research's Class R / Class L / Class H action taxonomy ([sources/always-on-agentic-org-v1.md](sources/always-on-agentic-org-v1.md), Proposal-First Governance).

## Sources

- [sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md) -- Eight architectural chaining patterns (sequential, branching, map-reduce, DAG, iterative refinement, agent loops, multi-agent, memory), seven framework deep-dives (LangChain, LangGraph, DSPy, CrewAI, AutoGen, LlamaIndex Workflows, Haystack), cost/latency analysis, and production guidance
- [sources/retries-recovery-branching.md](sources/retries-recovery-branching.md) -- Detailed comparison of retry policies, error recovery, state persistence, and conditional branching across LangGraph, CrewAI, AutoGen, Temporal, and Prefect
- [sources/always-on-agentic-org-v1.md](sources/always-on-agentic-org-v1.md) -- Organizational models for always-on agentic systems: hub-and-spoke, triad separation-of-duties, ICS-style functional departments, mission pods, stage-gated pipelines, and federated micro-agents
- [sources/always-on-agentic-org-v2.md](sources/always-on-agentic-org-v2.md) -- Extended organizational taxonomy (18 models), governance patterns, policy-as-code, event sourcing, formal methods, and 12-month implementation roadmaps
- [sources/dsl-plugin-deep-research.md](sources/dsl-plugin-deep-research.md) -- Original feasibility research for the inline control-flow DSL plugin: reference architecture, minimal grammar, execution semantics, context management, Claude Code hook integration, and MVP implementation plan
