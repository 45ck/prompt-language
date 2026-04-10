# Language Reference

This section documents prompt-language as a language and runtime, not as a tutorial. Use it when you need exact syntax, semantics, defaults, and edge cases for a specific feature.

The reference is the contract for shipped behavior. If a keyword or command is not documented here, treat it as not shipped yet. Tracked future work lives on the [Roadmap](../roadmap.md), proposed syntax and design history live in [WIP Features](../wip/index.md), and the repo-wide interpretation rules live in [Documentation Governance](../documentation-governance.md).

## Reference boundaries

| If you need...                     | Go here                                   | Why                                                             |
| ---------------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| Learn the runtime from scratch     | [Guides](../guides/index.md)              | Tutorials and conceptual walkthroughs                           |
| Check shipped syntax and semantics | This section                              | Authoritative language and runtime contract                     |
| Check CLI commands and flags       | [CLI Reference](cli-reference.md)         | Exact install, run, validate, eval, and utility command surface |
| See worked examples                | [Examples](../examples/index.md)          | Runnable patterns and end-to-end flow snippets                  |
| Check backlog status               | [Roadmap](../roadmap.md)                  | `.beads`-backed shipped, tracked, and exploratory status        |
| Inspect unshipped proposals        | [WIP Features](../wip/index.md)           | Not available today                                             |
| Understand product direction       | [Strategy](../strategy/index.md)          | Positioning, thesis, and long-range bets                        |
| Review the evidence base           | [Research Reports](../research/README.md) | External-source syntheses behind the direction                  |

## Runtime, SDK, and CLI

| Page                                          | Covers                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| [CLI Reference](cli-reference.md)             | Installation, `run`/`ci`/`eval`, validation, and utility tools     |
| [SDK](sdk.md)                                 | Stable programmatic parse/session/advance/gate/render API          |
| [Evals and Judges V1](evals-and-judges-v1.md) | Shipped v1 judge declarations, review integration, and eval runner |

## Program structure

| Page                                          | Covers                                              |
| --------------------------------------------- | --------------------------------------------------- |
| [Program Structure](program-structure.md)     | `Goal:`, `env:`, `flow:`, `done when:`              |
| [Defaults and Limits](defaults-and-limits.md) | Default loop counts, retry attempts, foreach limits |
| [Comments](comments.md)                       | Inline `#` comments                                 |
| [Natural Language](natural-language.md)       | Best-effort NL-to-DSL detection and limits          |

## Core actions

| Page                                          | Covers                              |
| --------------------------------------------- | ----------------------------------- |
| [prompt](prompt.md)                           | `prompt:` task injection            |
| [run](run.md)                                 | `run:`, command execution, timeouts |
| [try / catch / finally](try-catch-finally.md) | Error recovery blocks               |
| [approve](approve.md)                         | Human approval checkpoint           |

## State and context

| Page                                      | Covers                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| [let / var](let-var.md)                   | Literal values, command capture, prompt capture, JSON schema     |
| [Runtime Variables](runtime-variables.md) | `last_exit_code`, `command_failed`, `last_stdout`, `last_stderr` |
| [remember](remember.md)                   | Persistent memory store, `memory:` prefetch section              |

## Control flow

| Page                    | Covers                                        |
| ----------------------- | --------------------------------------------- |
| [if](if.md)             | `if`, `else if`, `elif`, `else`               |
| [ask](ask.md)           | AI-evaluated conditions and `grounded-by`     |
| [while](while.md)       | `while`, `while not`                          |
| [until](until.md)       | `until`                                       |
| [retry](retry.md)       | Retry blocks and attempt budgets              |
| [foreach](foreach.md)   | Iterating arrays, strings, and command output |
| [review](review.md)     | Generator-evaluator critique loop             |
| [break](break.md)       | Exiting loops                                 |
| [continue](continue.md) | Skipping to the next loop iteration           |

## Parallelism

| Page                              | Covers                                              |
| --------------------------------- | --------------------------------------------------- |
| [spawn](spawn.md)                 | Child processes, model selection, conditional spawn |
| [await](await.md)                 | `await all`, `await "name"`, child variable import  |
| [race](race.md)                   | First-to-complete parallel children                 |
| [foreach-spawn](foreach-spawn.md) | Fan-out: one spawn per list item                    |
| [send / receive](send-receive.md) | Inter-agent messaging between children and parent   |

## Completion and verification

| Page              | Covers                                |
| ----------------- | ------------------------------------- |
| [Gates](gates.md) | Built-in, custom, and composite gates |

## Reuse and composition

| Page                                    | Covers                                             |
| --------------------------------------- | -------------------------------------------------- |
| [import](import.md)                     | Inline flow files at parse time                    |
| [prompt-libraries](prompt-libraries.md) | Exported flow blocks, prompts, and gates via `use` |

## Consolidated reference

| Page                                | Covers                  |
| ----------------------------------- | ----------------------- |
| [DSL Reference](dsl-reference.md)   | One-page full reference |
| [DSL Cheatsheet](dsl-cheatsheet.md) | One-page quick lookup   |
