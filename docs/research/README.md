# Research Reports

Internal research reports synthesizing findings from 20+ external sources on prompt engineering, context engineering, agent verification, developer trust, and agentic IDE architecture. These reports inform prompt-language's design decisions and enhancement roadmap, but they are not the product contract.

## Before you read this section

| If you need...                 | Go here                              | Why                                                                     |
| ------------------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| To use prompt-language today   | [Guides](../guides/index.md)         | Product-first onboarding for the shipped runtime                        |
| Exact shipped behavior         | [Reference](../reference/index.md)   | The authoritative syntax and runtime contract                           |
| Current evidence and caveats   | [Evaluation](../evaluation/index.md) | Public evidence for what works now and where the limits still are       |
| Near-term tracked product work | [Roadmap](../roadmap.md)             | `.beads`-backed shipped-vs-tracked status                               |
| The longer-range thesis        | [Strategy](../strategy/index.md)     | Product positioning plus the broader bet the repo is trying to validate |

## Key insight

prompt-language is **not** a chaining framework (LangChain), an optimization compiler (DSPy), or a multi-agent platform (CrewAI). It is a **meta-orchestration layer** for an existing autonomous agent (Claude Code). The DSL provides structure, sequencing, and gate enforcement — the agent provides reasoning. This distinction shapes how all external research applies to our design, but it remains research framing rather than the canonical shipped feature list. See [Report 00](00-architecture-position.md) for the full argument.

## Reports

| #   | Report                                                       | Abstract                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | [Architecture Position](00-architecture-position.md)         | Establishes prompt-language's unique position as a meta-orchestration layer for an autonomous agent. Defines what the DSL is and is not, the BPMN analogy, and implications for each primitive. All other reports reference this.                                                                                    |
| 01  | [Agent Workflow Patterns](01-agent-workflow-patterns.md)     | How people structure agent workflows in production. Covers the eight architectural patterns (sequential, branching, map-reduce, DAG, iterative refinement, agent loops, multi-agent, memory), retry/recovery across frameworks, and the evaluator-optimizer loop.                                                    |
| 02  | [Context Engineering](02-context-engineering.md)             | Context engineering techniques that improve agent performance. Covers the Write/Select/Compress/Isolate taxonomy, attention budgets, context rot, memory hierarchies, and how prompt-language's hook-based injection relates.                                                                                        |
| 03  | [Verification and Gates](03-verification-and-gates.md)       | How agents verify work and what gate patterns enforce quality. Covers the ReAct verification loop, specification gaming, the verification gap (50% of benchmark-passing PRs wouldn't merge), premature stopping, and how `done when:` gates provide external verification.                                           |
| 04  | [Prompt Frameworks](04-prompt-frameworks.md)                 | Template languages and structured output techniques. Covers constrained decoding (LMQL, Guidance, Outlines), DSPy's compilation approach, and why most prompt framework concerns don't apply to prompt-language's agent orchestration model.                                                                         |
| 05  | [Developer Trust](05-developer-trust.md)                     | Why developers don't trust AI agents and how prompt-language addresses the trust gap. Covers the five failure modes (fake completion, lazy placeholders, stopping early, death spirals, context amnesia), the 84% adoption / 29% trust paradox, and how gates and flow structure directly address each failure mode. |
| 06  | [Agentic Tool Landscape](06-agentic-tool-landscape.md)       | How current agentic coding tools handle orchestration. Covers Copilot, Cursor, Devin, Claude Code, Codex architectures, the merge problem, MCP/ACP protocols, and where prompt-language fits as the only user-facing workflow DSL.                                                                                   |
| 07  | [Enhancement Opportunities](07-enhancement-opportunities.md) | Full wishlist with evidence tiers (Strong/Moderate/Speculative), proposed DSL syntax, and priority matrix. Top items: approval nodes, retry backoff, flow budgets, compact rendering, self-reflection on failure.                                                                                                    |
| 08  | [Feature Completeness](08-feature-completeness.md)           | Re-evaluates all 15 enhancements from Report 07 against existing primitives. Finds 10/15 already achievable, 2 handled by host agent, 2 integration patterns, 1 genuine gap (niche). Concludes the DSL is feature-complete; forward work is documentation, hardening, and eval coverage.                             |

## Tracked Research Plans

| Doc                                                                       | Purpose                                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Context-Adaptive Rendering Research Plan](context-adaptive-rendering.md) | Defines hypotheses, metrics, fixtures, and rejection criteria for the render-mode program |

## Sources

All source materials are archived in [`sources/`](sources/) with descriptive filenames. Reports cite these using relative links. Sources include compass artifacts, deep-research reports, and project documentation spanning context engineering, agent verification, developer trust, retry/recovery patterns, chaining architectures, agentic IDE design, and autonomous operations research.

| Source                                                                          | Topic                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [context-engineering-discipline](sources/context-engineering-discipline.md)     | Context engineering as the successor to prompt engineering  |
| [context-window-management](sources/context-window-management.md)               | Context window management techniques                        |
| [prompt-frameworks-survey-2026](sources/prompt-frameworks-survey-2026.md)       | Prompt template languages and structured output survey      |
| [agent-verification-completion](sources/agent-verification-completion.md)       | How AI coding agents verify work and know when to stop      |
| [developer-trust-crisis](sources/developer-trust-crisis.md)                     | Why developers don't trust AI coding agents                 |
| [retries-recovery-branching](sources/retries-recovery-branching.md)             | Retry, recovery, and branching across production frameworks |
| [llm-chaining-patterns](sources/llm-chaining-patterns.md)                       | LLM chaining patterns and framework comparisons             |
| [agentic-ide-architecture](sources/agentic-ide-architecture.md)                 | Next-generation agentic IDE architecture                    |
| [mission-centered-ide](sources/mission-centered-ide.md)                         | Mission-centered IDE design                                 |
| [dsl-plugin-deep-research](sources/dsl-plugin-deep-research.md)                 | DSL plugin feasibility research                             |
| [always-on-agentic-org-v1](sources/always-on-agentic-org-v1.md)                 | Always-on agentic organization design (v1)                  |
| [always-on-agentic-org-v2](sources/always-on-agentic-org-v2.md)                 | Always-on agentic organization design (v2)                  |
| [vaop-orchestration-ecosystem](sources/vaop-orchestration-ecosystem.md)         | VAOP orchestration ecosystem                                |
| [vaop-modular-platform](sources/vaop-modular-platform.md)                       | VAOP modular platform                                       |
| [vaop-mvp-research](sources/vaop-mvp-research.md)                               | VAOP MVP research                                           |
| [multi-agent-orchestration-career](sources/multi-agent-orchestration-career.md) | Multi-agent orchestration career analysis                   |
| [openclaw-docs-combined](sources/openclaw-docs-combined.md)                     | OpenClaw documentation                                      |
| [openclaw-hardening](sources/openclaw-hardening.md)                             | OpenClaw security hardening                                 |
| [openclaw-extending](sources/openclaw-extending.md)                             | OpenClaw capability extension                               |
