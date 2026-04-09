# Source Notes

This bundle was shaped by two kinds of source material:

1. Prompt Language repo docs examined during the discussion
2. Current public docs on agent memory, Markdown-based agent guidance, and retrieval patterns

## Prompt Language repo docs examined

These repo docs were used to ground the critique in the current project surface:

- `README.md`
- `docs/roadmap.md`
- `docs/reference/remember.md`
- `docs/reference/ask.md`
- `docs/reference/review.md`
- `docs/wip/index.md`
- `docs/wip/tooling/evals-and-judges.md`
- `docs/wip/history/structured-capture.md`
- `docs/strategy/thesis-roadmap.md`

## Public docs examined

### Anthropic

- Claude Code memory docs:
  - project, user, and enterprise memory files
  - `CLAUDE.md` imports
  - recursive discovery of memory files
  - `/memory` command and memory best practices

### LangGraph / LangChain

- LangGraph memory docs:
  - short-term memory as thread-scoped state persisted through checkpoints
  - long-term memory stored separately and recalled across threads

- LangChain long-term memory docs:
  - namespaces and keys for persistent memory

- Deep Agents memory docs:
  - filesystem-backed memory
  - agent-scoped and user-scoped memory
  - on-demand loading of skills and memory
  - read-only vs writable memory
  - security considerations for shared writable memory
  - concurrent write considerations

### OpenAI

- File Search docs:
  - hosted retrieval with semantic + keyword search
  - useful as a model for abstract retrieval that does not expose low-level backend semantics in the language

## Why this matters

The recommendations in this bundle are not only theoretical. They were shaped by:

- the actual Prompt Language docs and shipped surface
- current public patterns in agent memory design
- current public patterns in Markdown-based agent guidance
- current public patterns in hybrid / structure-aware retrieval

## Interpretation rule

This bundle is not arguing that Prompt Language should copy any single external system.

It is arguing that Prompt Language should:

- learn from current agent-memory patterns
- stay honest about what the current runtime already does
- preserve its identity as a deterministic runtime
- adopt only the memory and Markdown features that strengthen that identity
