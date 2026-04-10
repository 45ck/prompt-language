# Ecosystem Pack

Curated reference docs from `prompt-language-ecosystem-pack.zip`.

This folder is not a shipped feature surface. It exists so nearby projects are compared deliberately instead of being copied piecemeal from memory.

## Purpose

- keep prompt-language's layer boundaries visible
- compare adjacent projects by primitive rather than by hype
- turn the best ideas into explicit backlog slices
- document non-goals so imports do not blur the product

## Pages

| Page                                     | Focus                                                          |
| ---------------------------------------- | -------------------------------------------------------------- |
| [ecosystem-map.md](ecosystem-map.md)     | Which projects sit near prompt-language and at what layer      |
| [feature-matrix.md](feature-matrix.md)   | Cross-project primitive comparison                             |
| [import-backlog.md](import-backlog.md)   | What to import now, prototype later, or keep as reference only |
| [reference-index.md](reference-index.md) | Reading order for the project cards                            |
| [references/](references/)               | Short cards for each adjacent project                          |

## Operating rule

Use this pack to pressure-test decisions, not to justify copying a whole product.

For any candidate import, answer four questions:

1. Which layer is the source project operating at?
2. What concrete primitive are we actually borrowing?
3. Why does that primitive belong in prompt-language specifically?
4. What evidence would prove the borrowed idea is helping rather than bloating the runtime?

## Current center of gravity

prompt-language's strongest current value is still:

- verification gates
- supervision around an existing coding agent
- deterministic control flow and state
- bounded engineering workflows

Anything imported from the ecosystem should strengthen that center, not replace it.
