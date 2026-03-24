# Report 07: Enhancement Opportunities

> Full wishlist with evidence tiers, proposed syntax, and source citations.

## Abstract

This report consolidates enhancement opportunities identified across all research reports (01-06) and source materials. Each enhancement is tagged with an evidence tier (Strong, Moderate, or Speculative), linked to the source reports that support it, and includes proposed DSL syntax. The goal is a prioritized backlog of design ideas with clear evidence trails, not a commitment to implement everything listed.

## How to read this document

- **Strong**: Multiple independent sources confirm the need. High confidence this would be valuable.
- **Moderate**: One detailed source or strong logical inference from multiple sources. Worth prototyping.
- **Speculative**: Logical extension of findings, not directly validated. Worth discussing but not prioritizing.

Each enhancement includes: evidence tier, supporting reports/sources, proposed syntax, problem it solves, and effort estimate (S/M/L).

---

## Strong Evidence (multiple independent sources)

### E1: Approval / Human-in-the-Loop Nodes

**Evidence**: Strong
**Reports**: [03](03-verification-and-gates.md), [05](05-developer-trust.md), [06](06-agentic-tool-landscape.md)
**Sources**: [agent-verification-completion](sources/agent-verification-completion.md) (graduated autonomy model), [developer-trust-crisis](sources/developer-trust-crisis.md) (devs want control over high-risk actions), [agentic-ide-architecture](sources/agentic-ide-architecture.md) (merge confidence scores)

**Problem**: High-risk actions (database migrations, production deployments, destructive operations) need explicit human confirmation before proceeding. Currently, the DSL has no mechanism to pause for human approval — the agent runs autonomously until gates pass or budget exhausts.

**Proposed syntax**:

```
flow:
  prompt: Generate the database migration
  approval "Review migration before applying"
  run: npx prisma migrate deploy
```

The `approval` node would pause flow execution, display a message to the user, and wait for explicit confirmation before advancing. On rejection, the flow could branch to an alternative path or terminate.

**What it solves**: Graduated autonomy — let the agent do autonomous work for safe operations, require human checkpoints for risky ones. Directly addresses the trust crisis finding that 76% of devs won't use AI for deployment.

**Effort**: Medium — new node kind, state persistence for pause/resume, hook integration for user input.

---

### E2: Retry with Configurable Backoff

**Evidence**: Strong
**Reports**: [01](01-agent-workflow-patterns.md), [03](03-verification-and-gates.md)
**Sources**: [retries-recovery-branching](sources/retries-recovery-branching.md) (LangGraph RetryPolicy with exponential backoff, Temporal unlimited retries with backoff), [llm-chaining-patterns](sources/llm-chaining-patterns.md) (iterative refinement best practices)

**Problem**: Current `retry max N` re-enters immediately. For rate-limited APIs, flaky services, or resource contention, immediate retry is counterproductive. LangGraph, Temporal, and Prefect all provide configurable backoff as a first-class primitive.

**Proposed syntax**:

```
flow:
  retry max 5 backoff 2s
    run: curl -s https://api.example.com/deploy
    if command_failed
      prompt: Analyze the error and adjust the request
    end
  end
```

`backoff 2s` would wait 2 seconds before the first retry, doubling each time (2s, 4s, 8s, 16s). Optional `backoff 2s max 60s` to cap the delay.

**What it solves**: Production reliability for external service interactions. Prevents thundering-herd on shared resources.

**Effort**: Small — add optional backoff parameter to retry node, implement delay in advance-flow.

---

### E3: Flow-Level Budget and Timeout

**Evidence**: Strong
**Reports**: [01](01-agent-workflow-patterns.md), [03](03-verification-and-gates.md), [05](05-developer-trust.md)
**Sources**: [agent-verification-completion](sources/agent-verification-completion.md) (SWE-agent per-instance cost caps, turn count limits; 35-minute degradation threshold), [developer-trust-crisis](sources/developer-trust-crisis.md) (death spirals burn tokens without progress)

**Problem**: Agents degrade after ~35 minutes of continuous work. Death spirals consume unlimited tokens. Current `max N` on loops bounds individual loops but not the overall flow. No mechanism to say "this entire workflow should complete within X minutes or N total agent turns."

**Proposed syntax**:

```
flow:
  budget turns 50 timeout 30m

  prompt: Implement the feature
  while not tests_pass max 5
    prompt: Fix the failing tests
    run: npm test
  end
```

Or as a flow-level directive:

```
flow:
  prompt: Implement the feature

done when:
  tests_pass
  budget: turns 50, timeout 30m
```

**What it solves**: Prevents unbounded resource consumption. Forces decomposition of tasks that exceed the degradation threshold. Directly addresses the death spiral failure mode.

**Effort**: Medium — new flow-level metadata, turn counting in state, timeout tracking.

---

### E4: Compact Flow Rendering with Progress Indicators

**Evidence**: Strong
**Reports**: [02](02-context-engineering.md), [05](05-developer-trust.md)
**Sources**: [context-engineering-discipline](sources/context-engineering-discipline.md) (context as "RAM" — don't waste it on verbose status), [developer-trust-crisis](sources/developer-trust-crisis.md) (devs want visibility into agent progress)

**Problem**: Flow rendering (`renderFlow`) currently shows the full flow tree with execution markers. For complex flows, this consumes significant context tokens. Developers want to see progress, but the agent needs the context window for reasoning.

**Proposed enhancement**: Two rendering modes:

- **Full mode** (current): Complete tree with all nodes, used for initial injection
- **Compact mode**: Only active path and recent history, used for subsequent injections

```
[flow] Step 3/7: retry (attempt 2/3)
  > prompt: Fix the failing tests
  [last] run: npm test → exit 1
  [next] prompt: Fix the failing tests (retry)
[gate] tests_pass: pending
```

**What it solves**: Reduces context consumption on long flows. The "attention budget" concept from Anthropic research — compact rendering preserves tokens for actual reasoning.

**Effort**: Medium — new render mode in render-flow.ts, toggle based on flow length or iteration count.

---

### E5: Persistent Memory Across Sessions

**Evidence**: Strong
**Reports**: [02](02-context-engineering.md), [05](05-developer-trust.md)
**Sources**: [context-engineering-discipline](sources/context-engineering-discipline.md) (tiered memory: buffer → core → recall → archival), [developer-trust-crisis](sources/developer-trust-crisis.md) ("every session creates another brand new hire"), [context-window-management](sources/context-window-management.md) (cross-session knowledge persistence)

**Problem**: Each prompt-language session starts fresh. Variables, gate results, and flow progress are ephemeral. One developer built a "5,276-line bash framework" to prevent context loss between sessions. The research is emphatic: context amnesia is a top-5 failure mode.

**Proposed syntax**:

```
flow:
  let project_context = memory "project-conventions"
  prompt: Follow the conventions in ${project_context}. Implement feature X.
```

Or automatic memory integration:

```
flow:
  memory: project-conventions, recent-failures
  prompt: Implement feature X
```

**What it solves**: Cross-session learning. Agents remember project conventions, previous failures, and user preferences.

**Effort**: Large — new memory subsystem, storage format, retrieval mechanism, integration with context injection.

---

### E6: Self-Reflection on Failure

**Evidence**: Strong
**Reports**: [01](01-agent-workflow-patterns.md), [03](03-verification-and-gates.md)
**Sources**: [agent-verification-completion](sources/agent-verification-completion.md) (Reflexion: +8% from verbal self-reflection; "agents need to articulate WHY they failed"), [llm-chaining-patterns](sources/llm-chaining-patterns.md) (evaluator-optimizer loop, Degeneration-of-Thought risk)

**Problem**: Current `retry` re-enters the body without structured reflection. Research shows that blind retry is significantly less effective than reflection-guided retry. Reflexion achieves 91% pass@1 on HumanEval by storing failure reflections in episodic memory.

**Proposed syntax**:

```
flow:
  retry max 3 reflect
    run: npm test
    if command_failed
      prompt: Fix the failures
    end
  end
```

The `reflect` modifier would inject a reflection prompt before each retry: "The previous attempt failed because: [last_stderr]. Before trying again, analyze what went wrong and what you should do differently."

**What it solves**: Higher success rates on retries by preventing the agent from repeating the same mistake. Addresses the "death spiral" pattern where agents try the same failing approach repeatedly.

**Effort**: Small — inject reflection context into the retry loop's additionalContext, using existing variable capture.

---

## Moderate Evidence (one detailed source)

### E7: Tool Gating Per Node

**Evidence**: Moderate
**Reports**: [03](03-verification-and-gates.md), [06](06-agentic-tool-landscape.md)
**Sources**: [dsl-plugin-deep-research](sources/dsl-plugin-deep-research.md) (PreToolUse hook can gate specific tools), [agent-verification-completion](sources/agent-verification-completion.md) (specification gaming — hiding test files reduces cheating to near zero)

**Problem**: Agents sometimes modify test files instead of fixing code (specification gaming). ImpossibleBench found GPT-5 exploits test cases 76% of the time. Read-only test access is a promising mitigation.

**Proposed syntax**:

```
flow:
  prompt: Fix the code (do not modify tests)
    deny: Write(tests/*), Edit(tests/*)
  end
```

Or flow-level:

```
flow:
  readonly: tests/, package-lock.json
  prompt: Fix the failing code
```

**What it solves**: Prevents specification gaming by structurally preventing the agent from modifying verification artifacts.

**Effort**: Medium — PreToolUse hook integration to block tool calls matching patterns.

---

### E8: Parallel Map with Merge

**Evidence**: Moderate
**Reports**: [01](01-agent-workflow-patterns.md), [06](06-agentic-tool-landscape.md)
**Sources**: [llm-chaining-patterns](sources/llm-chaining-patterns.md) (map-reduce parallelizes independent subtasks), [agentic-ide-architecture](sources/agentic-ide-architecture.md) (Cursor 8 parallel agents, Claude Code Agent Teams)

**Problem**: `foreach` iterates sequentially. For independent items (e.g., fixing tests in separate modules), parallel execution would be faster. Current `spawn`/`await` supports this but requires manual variable management.

**Proposed syntax**:

```
flow:
  foreach module in "auth api billing" parallel
    prompt: Fix failing tests in ${module}
    run: npm test --filter ${module}
  end
```

The `parallel` modifier would spawn child agents for each item and await all before continuing.

**What it solves**: Faster execution of independent parallel work. Maps to the map-reduce pattern that research identifies as one of the eight fundamental orchestration patterns.

**Effort**: Large — combine foreach with spawn/await mechanics, handle variable merge conflicts.

---

### E9: Conditional Done-When Gates

**Evidence**: Moderate
**Reports**: [03](03-verification-and-gates.md)
**Sources**: [agent-verification-completion](sources/agent-verification-completion.md) (layered verification: static → tests → CI → human), [dsl-plugin-deep-research](sources/dsl-plugin-deep-research.md) (gate enforcement architecture)

**Problem**: Current gates are all-or-nothing. Some workflows need conditional completion — "pass if ALL tests pass, OR if the agent has tried 3 times and at least the critical tests pass."

**Proposed syntax**:

```
done when:
  tests_pass
  lint_pass

done when (fallback after 3 attempts):
  gate critical_tests: npm test -- --grep "critical"
  lint_pass
```

**What it solves**: Graceful degradation of completion criteria. Prevents infinite loops on flaky or non-critical failures.

**Effort**: Medium — gate evaluation logic, attempt tracking, fallback gate sets.

---

### E10: Variable Transforms and Filters

**Evidence**: Moderate
**Reports**: [04](04-prompt-frameworks.md)
**Sources**: [prompt-frameworks-survey-2026](sources/prompt-frameworks-survey-2026.md) (template languages with filters: Jinja2, Handlebars), [llm-chaining-patterns](sources/llm-chaining-patterns.md) (output parsing between chain steps)

**Problem**: Variables are raw strings. Common operations (extract first line, count items, check if empty) require `let x = run "echo ... | head -1"` workarounds. Template languages universally provide filters for basic transforms.

**Proposed syntax**:

```
flow:
  let output = run "npm test 2>&1"
  let first_error = ${output | first_line}
  let error_count = ${output | line_count}
  if ${error_count} > 0
    prompt: Fix the first error: ${first_error}
  end
```

Built-in filters: `first_line`, `last_line`, `line_count`, `trim`, `json_get .key`, `lowercase`, `uppercase`.

**What it solves**: Reduces `run` node boilerplate for simple string operations. Makes variable manipulation more ergonomic.

**Effort**: Small — extend interpolation engine with pipe syntax and built-in filter functions.

---

### E11: Flow Composition and Includes

**Evidence**: Moderate
**Reports**: [01](01-agent-workflow-patterns.md), [04](04-prompt-frameworks.md)
**Sources**: [llm-chaining-patterns](sources/llm-chaining-patterns.md) (DAG orchestration, hierarchical composition), [dsl-plugin-deep-research](sources/dsl-plugin-deep-research.md) (subagent isolation for complex flows)

**Problem**: Complex workflows repeat common patterns (e.g., "run tests, if fail, fix, retry"). No mechanism to define reusable sub-flows.

**Proposed syntax**:

```
# In a shared flows file or inline
define fix-and-test:
  retry max 3
    run: npm test
    if command_failed
      prompt: Fix the failing tests
    end
  end

flow:
  prompt: Implement the feature
  include fix-and-test
```

**What it solves**: DRY principle for common workflow patterns. Reduces copy-paste in complex flows.

**Effort**: Medium — flow definition registry, include resolution, variable scoping.

---

## Speculative (logical extensions)

### E12: Typed Captures with Schema Validation

**Evidence**: Speculative
**Reports**: [04](04-prompt-frameworks.md)
**Sources**: [prompt-frameworks-survey-2026](sources/prompt-frameworks-survey-2026.md) (Instructor for validated Pydantic extraction, constrained decoding)

**Problem**: `let x = prompt "..."` captures free-form text. No way to ensure the agent's response matches an expected structure (JSON, number, enum).

**Proposed syntax**:

```
flow:
  let count: number = prompt "How many failing tests are there?"
  let config: json = prompt "Output the configuration as JSON"
  let severity: enum(low, medium, high) = prompt "Rate the severity"
```

**What it solves**: Structured data extraction from agent responses. Enables richer condition evaluation and variable transforms.

**Effort**: Large — capture validation, retry on format mismatch, type system for variables.

---

### E13: Watchdog / Health-Check Nodes

**Evidence**: Speculative
**Reports**: [03](03-verification-and-gates.md), [05](05-developer-trust.md)
**Sources**: [agent-verification-completion](sources/agent-verification-completion.md) (idle detection: "if no new commit in last 5 iterations, break out")

**Problem**: Agents can get stuck in subtle ways — producing output but not making progress. Current `max N` bounds iterations but doesn't detect stalls within an iteration.

**Proposed syntax**:

```
flow:
  watchdog interval 5m check "git diff --stat"
    if stale
      prompt: You appear stuck. Try a different approach.
    end
  end

  prompt: Implement the feature
```

**What it solves**: Detects and intervenes in subtle stalls. Complements `max` iteration bounds with time-based progress detection.

**Effort**: Large — background monitoring, stall detection heuristics, intervention injection.

---

### E14: Cost Budget Per Flow

**Evidence**: Speculative
**Reports**: [01](01-agent-workflow-patterns.md), [03](03-verification-and-gates.md)
**Sources**: [agent-verification-completion](sources/agent-verification-completion.md) (SWE-agent: "without limiting cost, average cost converges to infinity"; Devin ACU units)

**Problem**: No mechanism to limit the total cost of a flow execution. For teams with API budgets, unbounded flows are a financial risk.

**Proposed syntax**:

```
flow:
  budget cost $5.00
  prompt: Implement and test the feature

done when:
  tests_pass
```

**What it solves**: Financial guardrails for autonomous agent work. Maps to SWE-agent's per-instance cost caps and Devin's ACU model.

**Effort**: Large — cost tracking integration (requires API usage data from Claude Code), budget enforcement in advance-flow.

---

### E15: Event-Driven Flow Triggers

**Evidence**: Speculative
**Reports**: [06](06-agentic-tool-landscape.md)
**Sources**: [agentic-ide-architecture](sources/agentic-ide-architecture.md) (Cursor Automations: trigger agents from external events), [mission-centered-ide](sources/mission-centered-ide.md) (event-driven mission orchestration)

**Problem**: Flows only trigger from user prompts. Cursor's March 2026 "Automations" system triggers agents from external events (GitHub webhooks, CI failures, file changes). No equivalent in prompt-language.

**Proposed syntax**:

```
on: github.pull_request.opened
flow:
  let pr_url = ${event.url}
  prompt: Review the PR at ${pr_url}

done when:
  gate review_posted: gh pr review ${pr_url} --approve
```

**What it solves**: Autonomous agent work triggered by external events, not just user prompts.

**Effort**: Large — event system, trigger registration, webhook/file-watch integration.

---

## Priority Matrix

| #   | Enhancement                | Evidence    | Effort | Value  | Priority | Status                                                                                                  |
| --- | -------------------------- | ----------- | ------ | ------ | -------- | ------------------------------------------------------------------------------------------------------- |
| E1  | Approval nodes             | Strong      | M      | High   | **P1**   | Already achievable — `let x = prompt` as checkpoint ([Report 08](08-feature-completeness.md))           |
| E2  | Retry backoff              | Strong      | S      | Medium | **P1**   | Already achievable — `run: sleep N` + variable doubling ([Report 08](08-feature-completeness.md))       |
| E3  | Flow budget/timeout        | Strong      | M      | High   | **P1**   | Host handles — Claude Code `--max-turns`, loop `max N` ([Report 08](08-feature-completeness.md))        |
| E4  | Compact rendering          | Strong      | M      | High   | **P1**   | Host handles — Claude Code context compaction ([Report 08](08-feature-completeness.md))                 |
| E6  | Self-reflection on failure | Strong      | S      | High   | **P1**   | Already achievable — reflection prompt in `retry`/`if` ([Report 08](08-feature-completeness.md))        |
| E5  | Persistent memory          | Strong      | L      | High   | **P2**   | Integration pattern — `let x = run "cat file"` ([Report 08](08-feature-completeness.md))                |
| E7  | Tool gating                | Moderate    | M      | High   | **P2**   | Already achievable — prompt instructions or `PreToolUse` hook ([Report 08](08-feature-completeness.md)) |
| E10 | Variable transforms        | Moderate    | S      | Medium | **P2**   | Already achievable — `let x = run "... \| filter"` ([Report 08](08-feature-completeness.md))            |
| E8  | Parallel foreach           | Moderate    | L      | Medium | **P3**   | Already achievable — `spawn`/`await` per item ([Report 08](08-feature-completeness.md))                 |
| E9  | Conditional gates          | Moderate    | M      | Medium | **P3**   | Already achievable — `if` + `break` + variable tracking ([Report 08](08-feature-completeness.md))       |
| E11 | Flow composition           | Moderate    | M      | Medium | **P3**   | Already achievable — copy-paste recipes or Claude Code skills ([Report 08](08-feature-completeness.md)) |
| E12 | Typed captures             | Speculative | L      | Medium | **P4**   | Already achievable — format instructions in prompt text ([Report 08](08-feature-completeness.md))       |
| E13 | Watchdog nodes             | Speculative | L      | Medium | **P4**   | Genuine gap (niche) — could be host-level hook ([Report 08](08-feature-completeness.md))                |
| E14 | Cost budget                | Speculative | L      | Low    | **P4**   | Host handles — Claude Code session limits ([Report 08](08-feature-completeness.md))                     |
| E15 | Event triggers             | Speculative | L      | Low    | **P4**   | Integration pattern — external `claude -p` invocation ([Report 08](08-feature-completeness.md))         |

## Follow-up

[Report 08: Feature Completeness Assessment](08-feature-completeness.md) re-evaluates all 15 enhancements against existing DSL primitives. Key finding: 10/15 are already achievable with existing node kinds, 2 are handled by the host agent, 2 are integration patterns, and only 1 is a genuine structural gap.

## Sources

All reports in this series:

- [Report 00: Architecture Position](00-architecture-position.md)
- [Report 01: Agent Workflow Patterns](01-agent-workflow-patterns.md)
- [Report 02: Context Engineering](02-context-engineering.md)
- [Report 03: Verification and Gates](03-verification-and-gates.md)
- [Report 04: Prompt Frameworks](04-prompt-frameworks.md)
- [Report 05: Developer Trust](05-developer-trust.md)
- [Report 06: Agentic Tool Landscape](06-agentic-tool-landscape.md)

Primary sources:

- [sources/agent-verification-completion.md](sources/agent-verification-completion.md)
- [sources/developer-trust-crisis.md](sources/developer-trust-crisis.md)
- [sources/retries-recovery-branching.md](sources/retries-recovery-branching.md)
- [sources/llm-chaining-patterns.md](sources/llm-chaining-patterns.md)
- [sources/context-engineering-discipline.md](sources/context-engineering-discipline.md)
- [sources/context-window-management.md](sources/context-window-management.md)
- [sources/prompt-frameworks-survey-2026.md](sources/prompt-frameworks-survey-2026.md)
- [sources/agentic-ide-architecture.md](sources/agentic-ide-architecture.md)
- [sources/mission-centered-ide.md](sources/mission-centered-ide.md)
- [sources/dsl-plugin-deep-research.md](sources/dsl-plugin-deep-research.md)
