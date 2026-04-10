# WIP Tooling Proposals

This folder mixes three kinds of material:

- active tooling proposals that are not shipped yet
- imported packs used to shape tooling direction
- shipped tooling context that still lives under `docs/wip/`

Treat only the pages explicitly marked as active proposals as future-facing commitments.

## Active proposals

| Page                                    | Focus                                                         | Status                                       |
| --------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| [Evals and Judges](evals-and-judges.md) | Future eval DSL and quality layer on top of shipped v1 pieces | Proposal extension on partially shipped work |
| [Language Server](lsp.md)               | Editor-agnostic autocomplete and diagnostics                  | Active proposal                              |
| [Web Playground](playground.md)         | Browser-based flow authoring and dry-run simulation           | Active proposal                              |

## Imported packs

These directories are backlog-shaping or positioning material, not product commitments by themselves:

| Page                                      | Focus                                                         | Status                  |
| ----------------------------------------- | ------------------------------------------------------------- | ----------------------- |
| [Ecosystem Pack](ecosystem/README.md)     | Curated comparison pack for adjacent runtimes and tool layers | Imported reference pack |
| [Diagnostics Pack](diagnostics/README.md) | Diagnostics, outcomes, and CLI exit behavior proposal pack    | Imported proposal pack  |

## Shipped context

These pages stay here for transition/history, but the capability itself already exists today:

| Page                                     | Focus                                                                    | Status                    |
| ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------- |
| [GitHub Action](github-action.md)        | CI-oriented flow execution packaging                                     | Shipped now               |
| [VS Code Extension](vscode-extension.md) | Syntax highlighting package; diagnostics/autocomplete remain future work | Basic package shipped now |
