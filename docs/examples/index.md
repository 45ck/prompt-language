# Examples

Worked flow examples and the larger showcase catalog.

**Runnable proof examples**: Self-contained repos that demonstrate verification gates catching false completion. See [examples/public/](../../examples/public/).

## Representative examples

| Example                                                       | Pattern                                             |
| ------------------------------------------------------------- | --------------------------------------------------- |
| [Fix Tests](fix-tests.md)                                     | Retry loop with test gate                           |
| [Lint and Fix](lint-and-fix.md)                               | Compound gates (`tests_pass` + `lint_pass`)         |
| [Approval Checkpoint](approval-checkpoint.md)                 | Human approval gate before destructive action       |
| [Parallel Tasks](parallel-tasks.md)                           | Spawn/await for concurrent work streams             |
| [Parallel Review](parallel-review.md)                         | Fan-out review across changed files                 |
| [Generator / Evaluator Debate](generator-evaluator-debate.md) | Parent-authored spawn/await revision debate         |
| [Review Loop](review-loop.md)                                 | Grounded generator-evaluator revision loop          |
| [JSON Capture](json-capture.md)                               | Structured capture for branching                    |
| [Bounded Semantic Choice](bounded-semantic-choice.md)         | Local/cheap model chooses; PL validates and renders |
| [Variable Pipeline](variable-pipeline.md)                     | Shell transforms and captured state                 |
| [Memory and Context](memory-and-context.md)                   | Reusing remembered context inside flows             |
| [Using Libraries](using-libraries.md)                         | Reusable prompts, flows, and gate sets              |
| [Producer / Consumer Messaging](producer-consumer.md)         | Child-to-child handoff via `send` / `receive`       |
| [Showcase](showcase.md)                                       | Large catalog of worked examples across primitives  |
