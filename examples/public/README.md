# Proof Examples

Runnable examples that demonstrate verification gates catching false completion. Each folder is self-contained -- clone, install, and run.

## Examples

| #   | Example                                              | What it proves                                          |
| --- | ---------------------------------------------------- | ------------------------------------------------------- |
| 01  | [Stop False Done](01-stop-false-done/)               | Gates block completion when tests still fail            |
| 02  | [Tests Plus Lint](02-tests-plus-lint/)               | Compound gates catch lint failures even when tests pass |
| 03  | [Approval Before Deploy](03-approval-before-deploy/) | Human approval gate blocks destructive actions          |
| 04  | [Grounded Review Loop](04-grounded-review-loop/)     | AI review is grounded in real test output               |
| 05  | [Parallel Review](05-parallel-review/)               | Fan-out review across source files with spawn           |

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) installed
- Node.js >= 22
- prompt-language runtime: `npx @45ck/prompt-language`

## Quick start

```bash
cd 01-stop-false-done
npm install
claude
```

Then paste the flow from the folder's README.

## Back to main

[prompt-language README](../../README.md) | [All examples](../../docs/examples/index.md) | [DSL cheatsheet](../../docs/reference/dsl-cheatsheet.md)
