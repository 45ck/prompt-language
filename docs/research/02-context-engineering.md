# Report 02: Context Engineering

> Q2: What context engineering techniques improve agent performance?

## Abstract

Context engineering -- the discipline of dynamically assembling the right information, tools, and state into an LLM's context window at the right time -- has replaced prompt engineering as the primary lever for agent reliability. Research from Anthropic, Google DeepMind, Manus, LangChain, and JetBrains Research converges on a stark finding: approximately 80% of agent failures stem from context problems, not model limitations (Schmid/DeepMind, [source 1]). The field has produced a formal taxonomy (Write/Select/Compress/Isolate), identified concrete failure modes (context rot, poisoning, goal drift, tool overload), and established engineering patterns spanning retrieval, tiered memory hierarchies, token budgeting, cache-aware architecture, and multi-agent context isolation. For prompt-language specifically, these findings validate the hook-based injection model while revealing opportunities to improve what we inject, when we inject it, and how much of the context window we consume doing so.

## Architecture Note

As established in [Report 00](00-architecture-position.md), prompt-language orchestrates an existing autonomous agent -- it does not manage the agent's internal context window. Claude Code handles its own compaction, tool output truncation, and conversation history management. prompt-language operates at the "what to inject" layer: we assemble flow state, variable values, gate results, and step instructions via `additionalContext` in the `UserPromptSubmit` hook, and the agent integrates that alongside its own context management. This means the context engineering findings below apply to us at two distinct levels -- the injection layer we control, and the window management layer the agent controls.

## Key Findings

### Finding 1: Context engineering is a systems discipline, not a prompting technique

Andrej Karpathy's canonical definition frames context engineering as "the delicate art and science of filling the context window with just the right information for the next step" ([source 1]). The critical shift from prompt engineering is one of scope: prompt engineering concerns what you say to the model; context engineering concerns everything the model sees when you say it -- retrieved documents, tool definitions, memory, conversation history, and structured state, all assembled programmatically at runtime. Karpathy's analogy -- the LLM is a CPU, the context window is RAM, the context engineer is the operating system -- captures the systems nature of the discipline. Simon Willison noted that the term resonated precisely because it conveys the actual complexity involved, unlike the perception of "prompt engineering" as merely typing into a chatbot ([source 1]).

### Finding 2: 80% of agent failures are context failures, not model failures

Philipp Schmid of Google DeepMind articulated the most consequential finding in the field: "Most agent failures are not model failures anymore -- they are context failures" ([source 1]). The 80% statistic reframes the primary optimization target. As models improve, the bottleneck shifts from model capability to information architecture. Drew Breunig identified four context failure modes that no amount of prompt iteration can fix: poisoning (wrong information injected), distraction (irrelevant context drowning signal), confusion (contradictory information), and clash (conflicting instructions from different sources). BigData Boutique, citing LangChain's 2025 State of Agent Engineering report, found that 57% of organizations have agents in production but 32% cite quality as their top barrier -- and most quality failures trace to context, not models ([source 1]).

### Finding 3: The Write/Select/Compress/Isolate taxonomy provides an actionable framework

LangChain's Lance Martin organized context engineering into four strategic buckets that map onto every practitioner decision ([source 1], [source 2]). **Write** persists information externally (state files, memory stores, progress logs). **Select** pulls relevant information in at the right moment (RAG, agentic search, tool result retrieval). **Compress** reduces token count while preserving signal (summarization, observation masking, compaction). **Isolate** scopes context across agents to prevent cross-contamination (subagent fresh windows, worktree isolation). prompt-language's current architecture touches all four: we write state to `.prompt-language/session-state.json`, select relevant flow context for injection, compress via `renderFlow()` which produces a structured visualization rather than raw state, and isolate via `spawn`/`await` which gives each child its own state directory and agent session.

### Finding 4: Attention budgets and context rot degrade recall as tokens accumulate

Anthropic introduced the concept of an "attention budget" to formalize the core constraint: context windows are finite, and their utility follows diminishing returns ([source 1]). As tokens accumulate, the model's ability to accurately recall information degrades -- a phenomenon termed "context rot." The Chroma "Context-Rot" study of 18 models (July 2025) confirmed a "context cliff" around 2,500 tokens of inserted context where retrieval performance degrades sharply ([source 2]). The "lost-in-the-middle" phenomenon (Liu et al., TACL 2024) demonstrated a U-shaped performance curve: LLMs perform best when relevant information sits at the beginning or end of context, with performance degrading by over 30% for information in the middle ([source 2]). Manus combats this by reciting objectives via a `todo.md` file at the end of context. For prompt-language, this directly affects how `renderFlow()` output is positioned within the injected context.

### Finding 5: The "dumb zone" -- performance drops when >40% of context is consumed

Dex Horthy's 12 Factor Agents manifesto identified a performance "dumb zone" triggered when more than approximately 40% of the context window is consumed ([source 1]). Devin's team discovered a subtler failure mode -- "context anxiety" -- where the model takes shortcuts or leaves tasks incomplete when it believes it is approaching the window limit. Their workaround was enabling the 1M-token beta but capping actual usage at 200K, giving the model confidence it has "plenty of runway" ([source 2]). Manus reports an average input-to-output token ratio of 100:1 in agent loops, meaning context grows relentlessly while output remains short ([source 1]). Claude Code's auto-compaction triggers at 64-75% utilization, with the system prompt, tool definitions, and memory files consuming 30,000-40,000 tokens before any user input -- leaving roughly 160K tokens of usable capacity in a 200K window ([source 2]).

### Finding 6: Just-in-time context loading outperforms pre-loading everything

Anthropic advocates "just-in-time context retrieval combined with static context injection" -- loading detailed data on demand rather than pre-loading everything into the window ([source 1]). Agents maintain lightweight identifiers and fetch detail using tools when needed. Claude Code deliberately uses agentic search (grep, file globbing) over vector search because it is more accurate, transparent, and easier to maintain ([source 2]). Nick Pash (Head of AI at Cline) argues RAG is a "seductive trap" for code because code is inherently structured, and breaking it into semantically similar but contextually isolated chunks differs from how engineers actually explore code. The emerging consensus favors agents loading information as needed rather than systems pre-populating the window ([source 2]). prompt-language's variable interpolation (`${last_stderr}`, `${last_stdout}`) is a form of just-in-time injection -- the agent receives specific, recent command output rather than accumulated history.

### Finding 7: Tool masking preserves KV-cache efficiency without reducing the action space

The Manus team considers KV-cache hit rate "the single most important metric for a production-stage AI agent" ([source 1], [source 2]). Their key discovery: masking unavailable tools via logit manipulation rather than removing them from the context preserves the stable prefix required for KV-cache hits. Removing a tool definition changes the prefix, invalidating the entire cache and causing a 10x cost increase for cached versus uncached tokens. Anthropic's prompt caching yields 64-65% latency improvements on stable prefixes ([source 1]). The architectural implication is that context should be append-only with a stable prefix -- system prompts and tool definitions front-loaded, dynamic content appended at the end. Google ADK's `static_instruction` primitive guarantees prefix immutability for this reason ([source 2]).

### Finding 8: Memory hierarchies mirror OS virtual memory management

The Letta/MemGPT framework pioneered a tiered memory architecture: a message buffer for immediate context (main context/Tier 1), core memory blocks the agent can read and write via tool calls, recall memory for searchable conversation history, and archival memory for long-term storage (Tier 2) ([source 1], [source 2]). The key innovation is self-editing memory -- the agent modifies its own state via function calls. Letta's evolution includes "context repositories" (February 2026): git-backed memory filesystems with markdown files, frontmatter metadata, and version-controlled changes ([source 2]). OpenAI's production patterns classify memory by stability (preferences that rarely change), drift (gradual evolution), and contextual variance (situation-dependent preferences). prompt-language's architecture maps partially: `.prompt-language/session-state.json` is working memory (Tier 1), `.prompt-language/vars/` files provide captured values (core memory), and `CLAUDE.md` files provide cross-session persistent memory (archival).

### Finding 9: Multi-agent isolation may be more important than compression

Claude Code's subagent pattern -- spawning a fresh context window for an exploratory task and returning only a 200-word summary -- is often more effective than trying to compress everything into one window ([source 2]). If a subagent reads 50 files to find one relevant piece, only the summary enters the parent context. Subagents cannot spawn other subagents, preventing infinite nesting. Multi-agent systems can consume up to 15x more tokens than single-agent interactions, making context isolation essential ([source 1]). Google's ADK controls this with an `include_contents` parameter determining whether sub-agents inherit full or empty context. prompt-language's `spawn`/`await` implements this pattern: parent variables are copied as `let` declarations, each child gets its own state directory, and child results are imported with name-prefixed variables (`childName.varName`), keeping the parent context clean.

### Finding 10: Hybrid compression strategies outperform any single approach

JetBrains Research (December 2025) systematically compared pruning strategies and found that combining observation masking with summarization reduced costs by 7-11% while increasing task success by approximately 2.6% on SWE-bench ([source 2]). SWE-agent uses observation masking (replacing old observations with one-line placeholders), OpenHands uses LLM-based summarization (structured summaries preserving goals, progress, remaining work), and Claude Code uses compaction (LLM summary wrapped in `<summary>` tags, achieving 60-70% token reduction per cycle). No single strategy dominates -- the optimal approach depends on task complexity and cost constraints ([source 2]). LangChain's Deep Agents SDK implements two-phase compression: first offload redundant file write/edit results (content already on disk), then fall back to LLM summarization ([source 2]).

### Finding 11: The file system is the true long-term memory for coding agents

The most effective agents -- Claude Code, Manus, Cursor, Letta Code -- converge on using files as the primary persistence layer ([source 2]). Claude Code's CLAUDE.md hierarchy (user-level, project-level, local, subdirectory) is injected at every session start and survives compaction. Files under 200 lines achieve a rule application rate above 92%, versus 71% beyond 400 lines ([source 2]). Manus maintains a continuously-updated `todo.md`. Letta Code consolidates episodic memory (specific debugging sessions, failed approaches) into semantic memory (reusable skill files in markdown). Anthropic's two-agent relay pattern uses a `claude-progress.txt` file and git commits as the handoff mechanism between sessions ([source 2]). prompt-language fully embraces this pattern: session state, variables, and captured values all persist to the file system, surviving compaction and enabling multi-turn continuity.

### Finding 12: Structured context preserves information better than raw dumps

Factory.ai's evaluation of compression strategies found that structured summarization -- with explicit sections for different information types -- scored highest at 3.70/5 because "structure forces preservation" of critical details ([source 1]). The ACON framework (October 2025) demonstrated 26-54% reduction in peak tokens while preserving task success by structuring context into typed sections ([source 1]). Hard prompt methods like LLMLingua filter low-information tokens for up to 20x compression, while soft prompt methods encode context into continuous embeddings for up to 480x compression ratios, though with fidelity tradeoffs ([source 1]). prompt-language's `renderFlow()` function embodies this principle: rather than injecting raw JSON state, it produces a structured, annotated DSL visualization with execution markers (`<-- current`), progress bars (`[##---] 2/5`), gate results (`[pass]`/`[fail]`), variable values, and warnings -- a purpose-built structured format for agent consumption.

## How prompt-language Compares

| Finding                        | Industry Pattern                                               | prompt-language Today                                                                          | Gap?                                                                 |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Systems discipline             | Dynamic context assembly at runtime                            | `injectContext()` assembles flow state + variables + gates per turn                            | Partial -- assembly is deterministic, not adaptive to context budget |
| 80% context failures           | Invest in context architecture over model tuning               | Gates verify externally; flow rendering provides structure                                     | Low -- our verification layer addresses the output side              |
| Write/Select/Compress/Isolate  | Four-strategy framework                                        | Write: state files. Select: variable interpolation. Compress: renderFlow. Isolate: spawn/await | Medium -- no active compression or budget-aware selection            |
| Attention budget / context rot | Position critical info at boundaries; minimize total injection | `renderFlow()` output prepended to prompt; size grows with flow complexity                     | Yes -- no budget cap on injected context size                        |
| Dumb zone (>40%)               | Monitor context utilization; reserve capacity                  | No awareness of current context utilization                                                    | Yes -- no integration with compaction hooks                          |
| Just-in-time loading           | Load on demand, not pre-load                                   | Variables interpolated at use time; `${last_stderr}` is recent                                 | Low -- variables are already just-in-time                            |
| KV-cache efficiency            | Stable prefix, append-only context                             | Injected context changes every turn (flow position moves)                                      | Medium -- no prefix stability optimization                           |
| Memory hierarchies             | Tiered: buffer, core, recall, archival                         | State file (buffer), vars/ files (core), CLAUDE.md (archival)                                  | Medium -- no recall memory or cross-session consolidation            |
| Multi-agent isolation          | Subagent with fresh window, return summary only                | spawn/await with state directory isolation                                                     | Low -- pattern is implemented; summary import works                  |
| Hybrid compression             | Combine masking + summarization                                | Single strategy: structured rendering via renderFlow                                           | Medium -- no adaptive compression based on context pressure          |
| File system as memory          | Persist to files, survive compaction                           | session-state.json, vars/ directory                                                            | Low -- already file-first                                            |
| Structured context             | Typed sections preserve info under compression                 | renderFlow produces annotated, structured output                                               | Low -- already structured                                            |

## DSL Examples

### How `additionalContext` injection works in our hook system

The `UserPromptSubmit` hook in `src/presentation/hooks/user-prompt-submit.ts` is the entry point. It calls `injectContext()`, which assembles the full context string and returns it as the modified prompt. Claude Code receives this as the user's message, meaning our injected context occupies the most recent position in the conversation -- the high-attention boundary identified by the lost-in-the-middle research.

```typescript
// From src/application/inject-context.ts — active flow injection
const ctx = renderFlow(toSave);
const interpolated = interpolate(input.prompt, toSave.variables);
return { prompt: `${ctx}\n\n${interpolated}` };
```

The injected prompt takes the form:

```
[prompt-language] Flow: fix failing auth tests | Status: active

> while tests_fail max 5 [##---] 2/5
>   prompt: Fix the tests.  <-- current
    run: npm test
  end

done when:
  tests_pass  [fail — exit 1: "npm test": FAIL src/auth.test.ts]

Variables:
  last_exit_code = 1
  command_failed = true
  last_stderr = Error: expected 200, got 401

[User's actual prompt text with ${variables} interpolated]
```

### Variable interpolation as context injection

Variables bridge the DSL and agent layers. `${varName}` substitution injects specific, relevant context into each prompt and run command -- a form of just-in-time context loading:

```
Goal: fix module errors

flow:
  let module_name = "auth"
  let info = run "npm test -- --grep ${module_name} 2>&1 | tail -20"
  prompt: Fix ${module_name}. The test output was: ${info}
  run: npm test -- --grep ${module_name}

done when:
  tests_pass
```

The agent receives exactly the context it needs for the current step -- the module name and its recent test output -- rather than a dump of all project state. The `interpolate()` function in `src/domain/interpolate.ts` handles substitution, with `shellInterpolate()` providing injection-safe escaping for `run:` commands.

### Flow rendering as progress context

`renderFlow()` in `src/domain/render-flow.ts` produces a structured visualization that serves as the agent's "situational awareness" -- where it is in the workflow, what has succeeded, what has failed, and what comes next. This is written to stderr for user visibility and prepended to the prompt for agent consumption:

```
[prompt-language] Flow: deploy pipeline | Status: active

  let env = "staging"  [= staging]
> try
>   run: npm run build  <-- current
    run: npm run deploy -- --env ${env}
  catch command_failed
    prompt: Build failed. Fix the error and try again.
  finally
    run: npm run cleanup
  end

done when:
  tests_pass  [pass]
  lint_pass   [fail — exit 1: "npm run lint": Unexpected token]

Variables:
  env = staging
  last_exit_code = 0
  command_succeeded = true
```

### Capturing agent output for later context with `let x = prompt`

`let x = prompt "summarize"` uses the dual-strategy capture system in `src/domain/capture-prompt.ts` to extract the agent's response into a variable for later interpolation. The meta-prompt instructs the agent to wrap its answer in capture tags and write to a file as fallback:

```
Goal: analyze and fix

flow:
  let analysis = prompt "Analyze the test failures and identify the root cause"
  let fix_plan = prompt "Based on: ${analysis}, propose a fix plan"
  prompt: Implement the fix plan: ${fix_plan}
  run: npm test

done when:
  tests_pass
```

Each `let x = prompt` node pauses the flow, injects the capture meta-prompt, and waits for the agent to respond. The captured value becomes available for `${analysis}` and `${fix_plan}` interpolation in subsequent nodes -- chaining agent reasoning outputs through the DSL's variable system.

## Enhancement Opportunities

The following opportunities emerge from the gap analysis. Detailed designs should be tracked in Report 07 when it is written.

1. **Context budget awareness**: Integrate with `PreCompact`/`PostCompact` hooks to detect when our injected context contributes to compaction pressure. Consider a compact rendering mode that omits completed nodes and collapses resolved variables.

2. **Adaptive flow rendering**: Implement a tiered rendering strategy -- full detail for the current node and its immediate ancestors, collapsed summaries for completed sections, omitted detail for nodes not yet reached. This mirrors the observation masking strategy from SWE-agent.

3. **Stable prefix optimization**: Restructure injected context to place stable content (DSL reference, flow structure) before dynamic content (current position, variable values, gate results). This would improve KV-cache hit rates across turns.

4. **Post-compaction re-injection**: Use the `PostCompact` hook to re-inject a minimal flow state summary after Claude Code compacts the conversation, preventing flow awareness from being lost during long sessions.

5. **Cross-session memory consolidation**: After flow completion, extract reusable patterns (which gate predicates were useful, which retry strategies worked, common error patterns) into project-level CLAUDE.md entries, implementing a form of episodic-to-semantic memory consolidation.

6. **Variable-scoped context loading**: For `foreach` loops over large lists, inject only the current item's context rather than the full list, reducing per-iteration token consumption.

7. **Gate diagnostic compression**: Gate failure diagnostics (`last_stderr` snippets) currently include raw command output. Structured summarization of gate failures could reduce token usage while preserving actionable information.

## Sources

- [sources/context-engineering-discipline.md](sources/context-engineering-discipline.md) -- Context engineering as the successor to prompt engineering. Covers Karpathy's canonical definition, Schmid's 80% statistic, LangChain's Write/Select/Compress/Isolate taxonomy, Anthropic's attention budget concept, Manus team's production lessons, and the Dex Horthy "dumb zone" finding. [source 1]
- [sources/context-window-management.md](sources/context-window-management.md) -- How coding agents manage context windows in production. Covers pruning strategies (observation masking, summarization, compaction), external memory (CLAUDE.md, Aider's repo map, vector RAG), multi-agent isolation patterns, token budgeting, memory architectures (MemGPT/Letta), and the lost-in-the-middle phenomenon. [source 2]
- [sources/dsl-plugin-deep-research.md](sources/dsl-plugin-deep-research.md) -- DSL plugin feasibility research covering Claude Code hook integration points, `additionalContext` injection via `UserPromptSubmit`, compaction hooks (`PreCompact`/`PostCompact`), context isolation strategies, and the session state architecture that prompt-language implements. [source 3]
