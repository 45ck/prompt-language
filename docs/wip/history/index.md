# WIP History

`docs/wip/history/` is the archive for pages that started life under `docs/wip/` and are no longer active proposals.

These pages are useful for design rationale and change history, but they are not the source of truth for current behavior. Use the [Language Reference](../../reference/index.md) for shipped language behavior, and use [Design](../../design/index.md) for accepted architecture and boundary decisions that still matter.

For the repo-wide docs cleanup:

- Do not put new planned work here. Active proposals belong in `docs/wip/` and should be marked clearly as WIP, proposed, or in progress.
- Move pages here only after the feature has shipped or the proposal has been superseded and the history is still worth keeping.
- If a historical page no longer adds useful rationale, retire it instead of letting the archive become another source of ambiguity.

## Archived pages

| Page                                        | Status              | Focus                                                               |
| ------------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| [approve](approve.md)                       | Shipped WIP history | Human approval checkpoints before they graduated into the reference |
| [Structured Capture](structured-capture.md) | Shipped WIP history | Early design notes for JSON capture via `let ... as json`           |
| [import](import.md)                         | Shipped WIP history | Reusable sub-flow composition before the reference split            |
| [Prompt Libraries](prompt-libraries.md)     | Shipped WIP history | Exported flows, prompts, and gates via `use`                        |
| [Conditional Spawn](conditional-spawn.md)   | Shipped WIP history | Spawn guards and the feature framing before shipment                |
| [Spawn Model Selection](spawn-model.md)     | Shipped WIP history | Spawn-time model override rationale                                 |
| [Deterministic ask](deterministic-ask.md)   | Shipped WIP history | `grounded-by` decision framing                                      |
| [review](review.md)                         | Shipped WIP history | Generator-evaluator loop design history                             |
| [race](race.md)                             | Shipped WIP history | Competitive parallel execution design history                       |
