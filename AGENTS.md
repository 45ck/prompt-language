# Agent Governance

This repo is protected by **noslop** quality gates.

## Before every commit

```sh
npm run format:check && npm run lint && npm run spell
```

## Before opening a PR

```sh
npm run typecheck && npm run test
```

## Rules

- Never use `git commit --no-verify`
- Never use `git push --force` without explicit human approval
- Do not weaken quality gates in `.githooks/`, `.github/workflows/`, or `.claude/hooks/`
- Additive changes to infrastructure files (new CI jobs, new checks, new schedules) are allowed
- Fix lint/type errors; do not disable rules
- Never use `[skip ci]`, `skip-checks`, or `SKIP_CI` in commit messages or CI configuration

## Content-aware protection

Infrastructure files (`.githooks/*`, `.github/workflows/*`, `.claude/hooks/*`, `.claude/settings.json`, `AGENTS.md`) use content-aware checking. The pre-commit hook inspects the diff and blocks:

- **Removal of quality commands** (`npm run ci`, `npm run test`, `npm run lint`, etc.)
- **Addition of bypass patterns** (`continue-on-error: true`, `--no-verify`, `[skip ci]`)
- **Net removal of enforcement** (removing `exit 1` without replacement)

Additive changes (new jobs, new schedules, new checks) pass through.

## Core principles

- Preserve architecture boundaries. Domain has zero external dependencies. Dependency flow is inward only.
- Run CI before claiming work is complete. `npm run ci` is the authority.
- Never bypass hooks, linters, or safety checks (`--no-verify`, `HUSKY=0`, `--force`).

## Required workflow

1. Read current task context and understand the scope.
2. Make changes within the correct architectural layer.
3. Run `npm run test` after changes.
4. Run `npm run ci` before claiming complete.
5. Run live smoke tests with `npm run eval:smoke` for any change to hooks, parsing, advancement, or state transitions (see CLAUDE.md "Smoke testing" section).

## Quality contract

- All pull requests must pass `npm run ci`.
- Tests are required for all new logic.
- Coverage must not decrease.
- Mutation testing should be run for critical domain logic.
- **Live smoke tests are mandatory** for changes to application/presentation layers. Unit tests with mocks are not sufficient — the plugin must be built, installed, and validated through Claude's real agent loop. See CLAUDE.md for smoke test commands.

## Architecture boundaries

```
presentation -> infrastructure -> application -> domain
```

Never import upward. Never add external dependencies to domain.

## Hook integrity

The three hooks (UserPromptSubmit, Stop, TaskCompleted) form the enforcement engine. Changes to hook behavior require review. Never remove or weaken hook enforcement without explicit approval.

## If a gate blocks you

1. Read the full error output — it tells you what failed and where
2. Fix the code (do not disable the rule or bypass the hook)
3. Rerun the gate: `npm run format:check && npm run lint && npm run spell`
4. Once it passes, stage and commit normally

## Human handoff

For ambiguous requirements, high-risk refactors, or policy changes, stop and ask for explicit user consent before proceeding.
