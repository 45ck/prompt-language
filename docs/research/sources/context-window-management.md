# How AI coding agents manage context windows

**The context window is the fundamental bottleneck of agentic software engineering.** Every AI coding agent — from Claude Code to SWE-agent to Cursor — must solve the same core problem: a 200K-token window fills fast when you're reading files, running commands, analyzing errors, and tracking a multi-step plan. The engineering discipline emerging around this constraint, increasingly called "context engineering," has produced a rich set of patterns spanning pruning, compression, external memory, and multi-agent delegation. This report covers the major approaches in production today, with concrete implementation details, pseudocode, and citations to specific tools and papers.

The stakes are high. When context management fails, agents lose track of their goals, repeat mistakes they've already made, or hallucinate information they never actually read. The best-performing coding agents in 2025–2026 treat context as a scarce resource to be budgeted, compressed, and strategically offloaded — mirroring how operating systems manage physical memory.

---

## What actually fills the context window

Every coding agent follows a layered structure within its context window. Based on analysis of Claude Code, SWE-agent, OpenHands, Manus, and LangChain's agent frameworks, the canonical layout is:

```
[System Prompt]              — Agent identity, behavioral rules, tool documentation
[Tool Definitions]           — JSON schemas for available tools/functions
[Persistent Rules]           — CLAUDE.md, .windsurfrules, .cursor/rules/
[Auto-Memory]                — Learned patterns from previous sessions (first ~200 lines)
[Task Description]           — The user's goal or GitHub issue text
[Conversation History]       — Alternating user/assistant/tool messages
  ├── [Older turns]          — May be summarized or masked
  ├── [Recent turns]         — Kept in full detail (typically last 5–10 turns)
  └── [Current step]         — Latest thought + action + observation
```

The **agent scratchpad** — the growing chain of thought-action-observation triplets — dominates token consumption. In coding agents specifically, observations (file contents, terminal output, test results) often consume **80%+ of all tokens**. A single file read can use 5,000 tokens; 30 file reads plus 20 command outputs in a session easily reaches 150,000 tokens.

Claude Code's 200K-token window illustrates the budget pressure concretely. The system prompt, tool definitions, MCP schemas, and memory files consume **30,000–40,000 tokens** before any user input, leaving roughly 160K tokens of usable capacity. Auto-compaction triggers at 64–75% utilization. Anthropic restricts individual tool responses to **25,000 tokens by default** to prevent any single observation from dominating the window.

The priority hierarchy for what survives when space runs low is consistent across tools. System prompts and tool definitions are never pruned. The task description is always retained. Recent tool outputs (last 5–10 turns) are kept in full. Error messages and stack traces receive high retention priority — Manus specifically advocates keeping failures in context to prevent repeating mistakes. Older tool outputs are the first candidates for removal, followed by intermediate chain-of-thought reasoning. File contents already persisted to disk have the lowest retention priority, since they can be re-read on demand.

---

## Three dominant pruning and compression strategies

Research and production systems have converged on three primary approaches to managing context growth, each with distinct tradeoffs. A December 2025 study from JetBrains Research systematically compared these approaches and found that their combination yields the best results.

**Observation masking** is SWE-agent's signature approach. Observations older than the last M turns (default M=5) are replaced with a single-line placeholder preserving the agent's thoughts and actions but removing verbose output. Once a valid generation follows malformed output, all past error messages except the first are omitted entirely. This is cheap (no LLM call required), fast, and effective — with Qwen3-Coder 480B on SWE-bench Verified, masking improved solve rates while halving costs.

```python
# Pseudocode for SWE-agent observation masking
def mask_history(history, window_size=5):
    for i, turn in enumerate(history):
        if i < len(history) - window_size:
            turn.observation = f"[Output collapsed — {len(turn.observation)} chars]"
    return history
```

**LLM-based summarization** is OpenHands' primary approach. When context exceeds a threshold, an LLM generates a structured summary preserving the user's goals, progress made, remaining work, and critical technical details like failing tests and important file paths. The summary is stored as a `CondensationEvent` in an immutable event log, enabling deterministic replay. OpenHands reports **~50% cost reduction per turn** without measurable accuracy impact, transforming quadratic cost scaling into linear scaling. However, JetBrains found that agents using summarization tend to run **~15% more turns** than those using masking, partially negating savings.

**Compaction** is Anthropic's production approach, available both as Claude Code's `/compact` command and as a first-class API feature. When the threshold is exceeded, a summary prompt is injected, Claude generates a structured summary wrapped in `<summary>` tags, and all message blocks prior to the compaction point are dropped. The default summarization prompt instructs the model to preserve "state, next steps, learnings" for continuity. Claude Code achieves **60–70% token reduction** per compaction cycle.

```python
# Anthropic API compaction configuration
response = client.beta.messages.create(
    betas=["compact-2026-01-12"],
    model="claude-opus-4-6",
    max_tokens=4096,
    messages=messages,
    context_management={
        "edits": [{
            "type": "compact_20260112",
            "trigger": {"type": "input_tokens", "value": 100000},
            "instructions": "Preserve code snippets, variable names, technical decisions."
        }]
    }
)
```

Anthropic also offers lighter-weight strategies that can precede full compaction: `clear_tool_uses` removes older tool results while keeping conversation flow intact, and `clear_thinking` removes extended thinking blocks. LangChain's Deep Agents SDK implements a two-phase version: first offload redundant file write/edit results (since content is already persisted to disk) when context hits 85% capacity, then fall back to full LLM summarization only when offloading is insufficient.

Manus, which handles 50+ tool calls per task on average, uses a multi-layered hierarchy: raw context preferred over compaction, compaction preferred over summarization. Their key innovation is **recoverable compression** — removing content but keeping references (URLs, file paths) so information can be re-fetched. They also continuously update a `todo.md` file, effectively "reciting" objectives at the end of context to combat the lost-in-the-middle attention degradation.

| System                | Trigger Threshold        | Strategy                                |
| --------------------- | ------------------------ | --------------------------------------- |
| Claude Code           | 64–75% of 200K           | Auto-compaction with LLM summary        |
| OpenHands             | Configurable event count | LLM summarization condenser             |
| SWE-agent             | Every turn (last 5 kept) | Observation masking                     |
| LangChain Deep Agents | 85% of model window      | Tool result offloading → summarization  |
| Goose (Block)         | 80% (configurable)       | Auto-compact with summary               |
| Manus                 | ~128K tokens             | Recoverable compression → summarization |
| Strands (AWS)         | 20-message window        | Sliding window or summarization         |

---

## External memory and retrieval as context extension

When the context window is finite, the file system becomes infinite memory. This insight drives the most sophisticated coding agents to treat external storage as a first-class component of their cognitive architecture.

**Claude Code's CLAUDE.md system** exemplifies file-based persistent memory. A hierarchy of markdown files — user-level (`~/.claude/CLAUDE.md`), project-level (`./CLAUDE.md`), local (`./CLAUDE.local.md`), and subdirectory-specific — is injected into the system prompt at every session start. These files survive compaction, session termination, and machine restarts. Since v2.1.59, Claude Code also maintains auto-memory: it autonomously decides what's worth remembering (build commands, debugging insights, architecture notes, code style preferences) and stores these in `~/.claude/projects/<project-hash>/`. Files under **200 lines achieve a rule application rate above 92%**, versus 71% beyond 400 lines.

**Aider's repository map** takes a different approach to what enters context. Rather than embedding-based retrieval, Aider uses **tree-sitter** for AST parsing and **PageRank** for importance ranking. It constructs a NetworkX graph where source files are nodes and edges represent symbol definition-reference relationships. PageRank with personalization identifies which functions and classes matter most — a function called by 20 other functions gets higher rank than a private helper called once. The resulting map fits within a configurable token budget (default **1,024 tokens**), expanding to ~8K when no specific files are in the chat. This gives the model a birds-eye view of repository structure without consuming significant context.

**Cursor and Windsurf use embedding-based RAG pipelines** optimized for code. Cursor automatically indexes projects using AST-aware chunking (not arbitrary fixed-size chunks), generates embeddings emphasizing comments and docstrings, and stores them in a Turbopuffer vector database. Retrieval is two-stage: vector search for candidates, then AI-based re-ranking for relevance. Windsurf's proprietary "M-Query" retrieval method reportedly outperforms basic cosine similarity. Both tools use Merkle trees for efficient incremental reindexing as files change.

A notable debate has emerged around **RAG versus agentic search** for code. Claude Code deliberately uses `grep` and file globbing rather than vector search — Anthropic advocates "agentic search over semantic search" because it's more accurate, transparent, and easier to maintain. Nick Pash (Head of AI at Cline) argues RAG is a "seductive trap" for coding because code is inherently logical and structured, and breaking it into semantically similar but contextually isolated chunks differs from how engineers actually explore code. The emerging consensus favors hybrid approaches: vector retrieval for initial discovery, agentic exploration for precise understanding.

**Episodic versus semantic memory** is an increasingly important distinction. Episodic memory captures specific events (this debugging session, that failed approach), while semantic memory captures general knowledge (this API's conventions, that module's architecture). Letta Code implements explicit episodic-to-semantic consolidation: agents process task trajectories (episodic) and consolidate reusable patterns into markdown skill files (semantic). Claude Code's auto-memory performs a similar function implicitly. A February 2025 position paper argues episodic memory is "the missing piece for long-term LLM agents," noting that most current systems only record inputs and outputs without rich contextual detail.

---

## How multi-agent architectures distribute context burden

The orchestrator/subagent pattern has become the dominant approach for managing context in complex coding tasks. The core principle: **one agent holds the plan, subagents get narrow context slices and return only summaries**.

Claude Code implements this natively with specialized built-in subagents. The **Explore agent** is read-only, optimized for codebase search and analysis — keeping exploration out of the main context. The **Plan agent** gathers codebase context before presenting a plan. A **general-purpose agent** handles complex multi-step tasks requiring both exploration and modification. Each subagent gets its own fresh, isolated context window. If a subagent reads 50 files to find one relevant piece, only a ~200-word summary enters the parent context. Critically, **subagents cannot spawn other subagents**, preventing infinite nesting.

```
# WITHOUT subagents:
Parent context: [user prompt] + [50 file reads] + [actual work]
└── context window nearly exhausted ──┘

# WITH subagents:
Parent context: [user prompt] + [agent result: ~200 words] + [actual work]
└── context window mostly available ──┘
Child context: [task prompt] + [50 file reads] + [summary]
└── separate context, discarded after ──┘
```

Model routing adds a cost/speed dimension: Claude Code can route subagent tasks to Haiku for simple searches, Sonnet for code analysis, and Opus for complex architectural decisions.

**LangGraph manages multi-turn context through checkpointing.** Every graph execution step saves state to a configurable backend (in-memory, SQLite, Redis, Couchbase). Thread-scoped short-term memory persists within a conversation; cross-thread long-term memory uses `Store` objects with custom namespaces and optional semantic search. This enables time-travel debugging (replay from any checkpoint) and fault tolerance (if a node fails, successful nodes' writes are preserved). LangGraph also supports explicit summarization nodes that condense long histories and `trim_messages` utilities for token-based truncation.

**CrewAI takes a cognitive approach** to shared memory. When `memory=True`, a unified Memory instance backed by LanceDB is shared across all agents. After each task, discrete facts are extracted and stored; before each task, relevant context is recalled and injected. Their newest "Cognitive Memory" uses an LLM to analyze content on save — inferring scope, categories, and importance — with consolidation logic that detects contradictions between old and new memories and resolves them. Different agents can weight the same memory differently: planning agents weight importance, execution agents weight recency.

**AutoGen treats context as conversation itself.** Agents maintain internal context based on sent and received messages. For multi-agent workflows, a `summary_method` parameter controls how context passes between sequential chats — either the last message or an LLM-generated summary becomes the "carryover" for the next conversation.

For tasks exceeding a single context window entirely, Anthropic developed a **two-agent relay pattern**: an initializer agent sets up the environment, creates a `claude-progress.txt` file and initial git commit, then a coding agent makes incremental progress each session, reading the progress file and git history to understand state. Each agent leaves the environment clean and documented for its successor.

---

## Token budgeting and the engineering of failure prevention

Production token budget allocation follows a consistent pattern across frameworks. A recommended split allocates **10–15%** to system instructions, **15–20%** to tool definitions, **30–40%** to retrieved knowledge and context, **10–20%** to conversation history, and reserves **25–50%** of the total window for output generation. Claude 4.5+ models have built-in context awareness — after each tool call, they receive a system warning like `Token usage: 35000/1000000; 965000 remaining`, enabling the model to pace its work.

Manus identifies the **KV-cache hit rate** as the single most important optimization metric for production agents. They rebuilt their framework four times to optimize for cache-friendly context patterns: append-only context with stable prefixes, deterministic JSON serialization, and tool masking via logit manipulation (rather than removing tool definitions, which would break the cache prefix). Google ADK similarly divides context into stable prefixes (system instructions, agent identity) and variable suffixes (latest turn, new tool outputs), using a `static_instruction` primitive that guarantees immutability.

LangChain's newest autonomous context compression (March 2026) represents an emerging pattern: rather than developers configuring when compression triggers, the framework exposes a tool that lets the agent trigger compression itself. The agent identifies optimal compression moments: task boundaries, after extracting conclusions from research, and before starting lengthy multi-file edits.

**When context management fails, the failure modes are specific and well-documented.** Context poisoning occurs when incorrect information enters the context and persists — "even GPT-5 will repeat an incorrect fact if provided an incorrect fact." In multi-agent systems, a minor hallucination from a research agent becomes established fact for an execution agent. Goal drift happens when the original task gets buried under accumulated context — "fix this bug" gradually becomes "fix bug + refactor function + update imports + reorganize file." Repeated mistakes occur when agents lack memory of failed approaches and retry the same thing. Devin's team discovered a subtler failure: **"context anxiety,"** where the model takes shortcuts or leaves tasks incomplete when it believes it's approaching the window limit. Their workaround — enabling the 1M-token beta but capping actual usage at 200K — gives the model confidence it has "plenty of runway."

---

## Memory architectures and research frontiers

**MemGPT** (Packer et al., 2023) introduced the foundational metaphor: virtual context management inspired by OS memory paging. Main context (Tier 1) holds the system prompt, persona, core memory blocks, and recent messages in a fixed-size buffer. External context (Tier 2) includes archival memory (vector database for long-term storage) and recall memory (dynamic search results). The key innovation is **self-editing memory** — the agent modifies its own instructions and knowledge via function calls, with all communication happening through tools rather than direct text output.

Letta (MemGPT's evolution) has pushed this further with **context repositories** (February 2026): git-backed memory filesystems where agents store context as markdown files with frontmatter (description, character limit, read-only status). Every memory change is git-versioned with informative commits, enabling concurrent multi-agent memory writes through branching and merging. Their "sleep-time compute" concept has background subagents reflect on experience during offline periods, processing recent trajectories and updating memory — a form of memory consolidation analogous to biological sleep.

**A-MEM** (Xu et al., NeurIPS 2025) draws from the Zettelkasten note-taking method. Each memory note has LLM-generated keywords, tags, and contextual descriptions. Links between notes are generated via embedding similarity plus LLM reasoning. Notes can exist in multiple "boxes" simultaneously, and memory evolves as new knowledge retroactively refines existing notes. **MemoryOS** (EMNLP 2025) implements a multi-tier architecture — short-term, mid-term, and long-term persistent memory — with heat-score-based segment selection.

The **lost-in-the-middle problem** remains a fundamental constraint even with longer windows. Liu et al. (TACL 2024) demonstrated a U-shaped performance curve: LLMs perform best when relevant information is at the beginning or end of context, with performance degrading by **>30%** when information sits in the middle. Chroma's July 2025 "Context-Rot" study of 18 models confirmed that retrieval performance degrades as context length increases, identifying a "context cliff" around 2,500 tokens of inserted context. This finding directly motivates strategies like Manus's `todo.md` recitation at the end of context and the general practice of placing the most critical information at context boundaries.

Longer context windows (200K → 1M → 2M tokens) change tradeoffs but don't eliminate the need for context engineering. Processing 1M tokens costs significantly more and adds 800ms–2+ seconds of latency versus 50–150ms for optimized RAG retrieval. RAG remains **8–82× cheaper** than long-context approaches for typical workloads. The emerging consensus is that longer windows are best used as expanded working memory for immediate tasks, combined with selective retrieval for precision — what Anthropic calls "just-in-time context retrieval combined with static context injection."

---

## Conclusion

Context management in coding agents has rapidly matured from ad hoc truncation into a disciplined engineering practice with clear patterns. Three insights stand out as particularly important for practitioners.

First, **the file system is the true long-term memory**. The most effective agents — Claude Code, Manus, Cursor, Letta Code — all converge on using files as the primary persistence layer, whether through CLAUDE.md, progress logs, skill files, or git-backed memory repositories. The context window is working memory; the file system is everything else.

Second, **no single compression strategy dominates**. JetBrains' systematic comparison shows that hybrid approaches (observation masking plus selective summarization) outperform either technique alone. The optimal strategy depends on the agent scaffold, the task complexity, and cost constraints. The trend toward agent-initiated compression — letting the model decide when to compress — suggests the field is moving away from fixed thresholds toward adaptive context management.

Third, **subagent isolation may be more important than compression**. Spawning a subagent with a fresh context window to handle a context-expensive subtask (reading 50 files, running a test suite) and returning only a summary is often more effective than trying to fit everything into one window. This pattern — already central to Claude Code, OpenHands, and Google ADK — effectively gives agents access to multiple context windows worth of processing capacity while keeping any single window clean and focused.

The limiting factor for long-running coding agents is increasingly not raw model capability but memory architecture. As the ICLR 2026 MemAgents workshop framed it: "Agents that can carry their memories across model generations will outlast any single foundation model."
