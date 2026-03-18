# Agent Governance

## Purpose

Rules for AI agents and autonomous workflows operating on this repository.

## Core principles

- Preserve architecture boundaries. Domain has zero external dependencies. Dependency flow is inward only.
- Run CI before claiming work is complete. `npm run ci` is the authority.
- Never bypass hooks, linters, or safety checks (`--no-verify`, `HUSKY=0`, `--force`).

## Required workflow

1. Read current task context and understand the scope.
2. Make changes within the correct architectural layer.
3. Run `npm run test` after changes.
4. Run `npm run ci` before claiming complete.

## Quality contract

- All pull requests must pass `npm run ci`.
- Tests are required for all new logic.
- Coverage must not decrease.
- Mutation testing should be run for critical domain logic.

## Architecture boundaries

```
presentation -> infrastructure -> application -> domain
```

Never import upward. Never add external dependencies to domain.

## Hook integrity

The three hooks (UserPromptSubmit, Stop, TaskCompleted) form the enforcement engine. Changes to hook behavior require review. Never remove or weaken hook enforcement without explicit approval.

## Human handoff

For ambiguous requirements, high-risk refactors, or policy changes, stop and ask for explicit user consent before proceeding.
