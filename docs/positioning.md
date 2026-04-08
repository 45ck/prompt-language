# Positioning

## One-line position

**prompt-language is a control-flow runtime for Claude Code that enforces real completion gates, persistent state, and deterministic execution for bounded engineering workflows.**

## Short tagline options

- Turn Claude Code into a supervised runtime.
- Bounded execution for Claude Code.
- Verification-gated control flow for coding agents.
- Persistent state and real completion gates for Claude Code.

## Decision memo

### Decision

Position `prompt-language` as an **enforcement-first control-flow runtime for Claude Code**.

Do **not** position it primarily as:

- a generic prompt DSL
- a Markdown workflow language
- a general LLM orchestration framework

The strongest wedge is that `prompt-language` turns Claude from an ad hoc conversational coding agent into a **supervised runtime**. The runtime keeps state, decides what happens next, re-injects exact context, and blocks completion until explicit verification passes.

### Why this is the right positioning

Without a runtime, the engineer becomes the runtime:

- tracking progress manually
- restating context repeatedly
- rerunning checks by hand
- rejecting premature `done`
- recovering poorly after interruption

`prompt-language` exists to make those responsibilities executable.

This is the core difference between:

- **better prompting**
- and **programmable supervision**

### What we should claim

`prompt-language` is best understood as:

- **stateful**
- **resumable**
- **inspectable**
- **bounded**
- **verification-gated**

The product claim is not that it makes Claude smarter.
The product claim is that it makes Claude's work loop **governable**.

### What we should not claim

Avoid positioning that makes the project sound like:

- just another prompt syntax
- just another AI workflow language
- a broad agent framework trying to do everything

Those framings weaken the repo.

### Recommended README opening

```md
**Turn Claude Code into a supervised runtime.**

`prompt-language` is a control-flow runtime for Claude Code that enforces real completion gates, persistent state, and deterministic execution for bounded engineering workflows.

Instead of the engineer manually acting as the runtime — tracking progress, restating context, rerunning checks, and rejecting premature `done` — `prompt-language` moves that supervision into code.
```

## Positioning matrix

| System | Best understood as | Core strength | Weakness relative to prompt-language | Where prompt-language wins |
|---|---|---|---|---|
| **prompt-language** | Enforcement-first control-flow runtime for Claude Code | Real completion gates, persistent state, deterministic context, bounded execution | Narrower scope today than broader orchestration ecosystems | Governs the coding work loop directly |
| **OpenProse** | Markdown-native language for AI sessions | Declarative authoring, contracts, service/session composition | More composition-first than enforcement-first | Better when the goal is supervising Claude's real coding loop with explicit gates |
| **AIDD / SudoLang** | AI-driven development framework with pseudocode-style orchestration | Strong methodology and reusable workflow patterns | Broader framework shape, less sharply centered on one runtime thesis | Stronger as a focused runtime identity |
| **IBM PDL** | Declarative prompt programming language | Clear language-first model | More general prompt programming than coding-loop supervision | Stronger on bounded engineering workflows |
| **LMQL** | LLM programming/query language | Powerful language model programming abstraction | Not centered on repo-native coding-agent supervision | Better for engineering execution control |
| **Guidance** | Control language for LLM generation and structure | Mature model-control framing | General generation control, not coding-agent runtime supervision | Better for terminal-native verification-gated execution |

## Sharp contrast

### OpenProse

OpenProse is closer to:

**program AI sessions as Markdown contracts**

### prompt-language

prompt-language is closer to:

**program Claude's work loop so it cannot finish until the real gates pass**

## Practical message for the repo

If the repo has to choose one sentence to optimize around, it should be:

> `prompt-language` is a control-flow runtime for Claude Code that turns ad hoc agent supervision into explicit, verifiable, bounded execution.

That is the clearest and most defensible identity.
