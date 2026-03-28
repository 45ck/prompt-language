# Language Reference

This section documents prompt-language as a language and runtime, not as a tutorial. Use it when you need exact syntax, semantics, defaults, and edge cases for a specific feature.

If a keyword or command is not documented here, treat it as not shipped yet. Tracked future work lives on the [Roadmap](../roadmap.md).

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

## State and context

| Page                                      | Covers                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| [let / var](let-var.md)                   | Literal values, command capture, prompt capture                  |
| [Runtime Variables](runtime-variables.md) | `last_exit_code`, `command_failed`, `last_stdout`, `last_stderr` |

## Control flow

| Page                    | Covers                                        |
| ----------------------- | --------------------------------------------- |
| [if](if.md)             | `if`, `else if`, `elif`, `else`               |
| [ask](ask.md)           | AI-evaluated conditions and `grounded-by`     |
| [while](while.md)       | `while`, `while not`                          |
| [until](until.md)       | `until`                                       |
| [retry](retry.md)       | Retry blocks and attempt budgets              |
| [foreach](foreach.md)   | Iterating arrays, strings, and command output |
| [break](break.md)       | Exiting loops                                 |
| [continue](continue.md) | Skipping to the next loop iteration           |

## Parallelism

| Page              | Covers                                             |
| ----------------- | -------------------------------------------------- |
| [spawn](spawn.md) | Child processes, `in "path"`, `with vars`          |
| [await](await.md) | `await all`, `await "name"`, child variable import |

## Completion and verification

| Page              | Covers                                |
| ----------------- | ------------------------------------- |
| [Gates](gates.md) | Built-in, custom, and composite gates |

## Consolidated reference

| Page                                   | Covers                  |
| -------------------------------------- | ----------------------- |
| [DSL Reference](../dsl-reference.md)   | One-page full reference |
| [DSL Cheatsheet](../dsl-cheatsheet.md) | One-page quick lookup   |
