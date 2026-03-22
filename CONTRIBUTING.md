# Contributing

## Getting started

1. Fork the repository.
2. Clone your fork and create a branch from `main`.
3. Install dependencies:

```
npm install
```

4. Run the full CI pipeline to verify your setup:

```
npm run ci
```

## Development workflow

1. Make changes in the appropriate architectural layer.
2. Write or update tests for your changes.
3. Run tests:

```
npm run test
```

4. Run the full CI check:

```
npm run ci
```

5. Run smoke tests to verify end-to-end behavior:

```
npm run eval:smoke
```

6. Commit and push to your branch.
7. Open a pull request against `main`.

## Architecture

This project follows domain-driven design with four layers. Dependency flow is strictly inward: presentation -> infrastructure -> application -> domain. The dependency-cruiser enforces this.

```
src/
  domain/           Pure types and logic. Zero external dependencies.
    flow-node.ts      Node types (while, until, retry, if, prompt, run, try, let)
    flow-spec.ts      FlowSpec, CompletionGate, FlowDefaults
    session-state.ts  SessionState, runtime transitions
    resolver.ts       Resolver types, built-in resolver names
    interpolate.ts    Variable interpolation and shell-safe substitution
    evaluate-condition.ts  Condition evaluation against variable state
    format-error.ts   Safe error-to-string with stack trace preservation
    render-flow.ts    Flow visualization with execution markers

  application/      Use cases and port interfaces.
    parse-flow.ts     DSL parser (FlowSpec from text)
    inject-context.ts Node advancement, control-flow evaluation, context injection
    evaluate-completion.ts  Gate evaluation with built-in command resolution
    evaluate-stop.ts  Stop hook use case — blocks stop when flow is active
    ports/            Abstract interfaces for I/O

  infrastructure/   Adapters implementing ports.
    adapters/         File I/O, command execution, condition evaluation

  presentation/     Entry points. Hook handlers.
    hooks/            user-prompt-submit.ts, stop.ts, task-completed.ts, read-stdin.ts

hooks/
  hooks.json        Hook registration for Claude Code

skills/
  flow-executor/    /flow:run skill
  flow-status/      /flow:status skill
  flow-reset/       /flow:reset skill
  fix-and-test/     /fix-and-test skill — retry loop + tests_pass gate
  tdd/              /tdd skill — red-green-refactor cycle
  refactor/         /refactor skill — incremental refactoring with test verification
  deploy-check/     /deploy-check skill — lint + test + build pipeline
```

## Creating skills

Skills are slash commands that provide Claude with a structured flow and instructions. Each skill lives in its own directory under `skills/`.

### Directory structure

```
skills/
  my-skill/
    SKILL.md      # Required — defines the skill
```

### SKILL.md format

Each `SKILL.md` has YAML frontmatter followed by a markdown body:

```yaml
---
name: my-skill
description: One-line description of what the skill does.
argument-hint: '<required arg description>'
---
```

All three frontmatter fields are required:

- **`name`** — Skill name, matches the directory name. Invoked as `/<name>`.
- **`description`** — Short description shown in skill listings.
- **`argument-hint`** — Hint for the argument the user passes (use `''` if none).

### Body content

The markdown body contains instructions Claude follows when the skill is invoked. A typical skill includes:

1. **What to do** — Step-by-step instructions for Claude.
2. **Flow block** — A `flow:` block with prompts, run commands, and control flow (retry, if, etc.).
3. **Done-when gates** — A `done when:` block with completion predicates like `tests_pass`, `lint_pass`, or `file_exists <path>`.
4. **Rules** — Constraints on Claude's behavior during execution.

See `skills/fix-and-test/SKILL.md` and `skills/tdd/SKILL.md` for examples.

### Testing skills

After creating or modifying a skill, test it manually:

```bash
npm run build && node bin/cli.mjs install
claude -p --dangerously-skip-permissions "Goal: <test scenario>" --skill <skill-name>
```

## Testing strategy

### Unit tests

Tests use Vitest and are colocated with source (`foo.ts` and `foo.test.ts` side by side). All new logic requires tests. Coverage must not decrease.

```bash
npm run test           # run once
npm run test:watch     # watch mode
npm run test:coverage  # with coverage report
```

### Smoke tests

Unit tests use mocks and in-memory stores. Smoke tests prove the plugin works end-to-end through Claude's real agent loop. They are **mandatory** before any PR.

```bash
npm run eval:smoke        # full suite (12 tests, ~4 min)
npm run eval:smoke:quick  # fast subset without gate/loop tests (~2 min)
```

See [manual smoke test instructions](docs/manual-smoke-test.md) for one-off validation.

### Mutation testing

Run mutation testing for critical domain logic:

```bash
npm run mutation
```

## Code style

- TypeScript with strict mode.
- ESLint and Prettier are enforced. Run `npm run lint:fix` and `npm run format` before committing.
- Use `type` imports for type-only symbols.
- No `eslint-disable` comments.

## Commit messages

Use clear, descriptive commit messages. One logical change per commit.

## Pull requests

- Keep PRs focused on a single concern.
- Ensure `npm run ci` and `npm run eval:smoke` both pass before requesting review.
- Describe what changed and why in the PR description.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
