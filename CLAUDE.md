# Project Rules

## Quick reference

Quality gate: `npm run ci` (run before claiming work complete).

## Tests

Run `npm run test` or `npm run test:watch` for feedback. Run `npm run test:coverage` before opening a PR.

## Architecture

Domain-driven design with four layers:

```
src/domain/          Pure types and functions. Zero external deps.
src/application/     Use cases, port interfaces.
src/infrastructure/  Adapters implementing ports.
src/presentation/    Hook entry points.
```

Dependency flow is strictly inward. Domain never imports from other layers.

## Rules

- Domain code must have zero external dependencies.
- Use `type` imports for type-only symbols.
- No `eslint-disable` comments.
- No weakening of ESLint, Prettier, TypeScript, Vitest, or dependency-cruiser rules.
- All node creation goes through factory functions in domain.
- SessionState is immutable; transitions return new objects.

## Naming conventions

- Use cases: `verb-noun.ts` (e.g., `parse-flow.ts`, `advance-step.ts`)
- Adapters: `noun-adapter.ts` (e.g., `file-state-adapter.ts`)
- Ports: `noun-port.ts` (e.g., `state-port.ts`)
- Tests: `*.test.ts` colocated with source

## State file

Runtime state lives in `.prompt-language/session-state.json`. Never hard-code paths; use the infrastructure adapter.

## CI

Full pipeline: `npm run ci`

This runs: typecheck, lint, format check, spell check, dependency cruiser, knip, build, test with coverage, and audit.
