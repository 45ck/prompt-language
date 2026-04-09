# Examples

Worked flow examples and the larger showcase catalog.

## Representative examples

| Example                                               | Pattern                                            |
| ----------------------------------------------------- | -------------------------------------------------- |
| [Fix Tests](fix-tests.md)                             | Retry loop with test gate                          |
| [Lint and Fix](lint-and-fix.md)                       | Compound gates (`tests_pass` + `lint_pass`)        |
| [Approval Checkpoint](approval-checkpoint.md)         | Human approval gate before destructive action      |
| [Parallel Tasks](parallel-tasks.md)                   | Spawn/await for concurrent work streams            |
| [Parallel Review](parallel-review.md)                 | Fan-out review across changed files                |
| [Review Loop](review-loop.md)                         | Grounded generator-evaluator revision loop         |
| [JSON Capture](json-capture.md)                       | Structured capture for branching                   |
| [Variable Pipeline](variable-pipeline.md)             | Shell transforms and captured state                |
| [Memory and Context](memory-and-context.md)           | Reusing remembered context inside flows            |
| [Using Libraries](using-libraries.md)                 | Reusable prompts, flows, and gate sets             |
| [Producer / Consumer Messaging](producer-consumer.md) | Child-to-child handoff via `send` / `receive`      |
| [Showcase](showcase.md)                               | Large catalog of worked examples across primitives |
