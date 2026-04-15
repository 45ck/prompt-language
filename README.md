# @45ck/prompt-language

A verification-first supervision runtime for coding agents. It wraps Claude Code in a persistent state machine with deterministic control flow, verification gates, and state management -- so the runtime handles supervision instead of you.

[![npm](https://img.shields.io/npm/v/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)
[![CI](https://github.com/45ck/prompt-language/actions/workflows/quality.yml/badge.svg)](https://github.com/45ck/prompt-language/actions/workflows/quality.yml)
[![license](https://img.shields.io/npm/l/@45ck/prompt-language)](LICENSE)
[![node](https://img.shields.io/node/v/@45ck/prompt-language)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![npm downloads](https://img.shields.io/npm/dm/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)

## Install

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) and Node.js >= 22.

```bash
npx @45ck/prompt-language
```

## What it does

You write a short flow. The runtime executes it deterministically -- loops, branches, variable capture, and verification gates all happen without AI involvement. The AI only runs when it hits a `prompt` node. **~85% of execution is deterministic; ~15% is AI.**

```
Goal: fix the auth module

flow:
  retry max 5
    run: npm test -- auth
    if command_failed
      prompt: Fix the failing tests.
    end
  end

done when:
  tests_pass
  lint_pass
```

Claude cannot self-report "done." The gates run `npm test` and `npm run lint` and block until they pass.

## Examples

### Capture variables, loop over them

```
flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    prompt: Fix lint issues in ${file}. Do not change behavior.
    run: npx eslint ${file} --fix
  end

done when:
  lint_pass
```

`let x = run "cmd"` captures stdout into a variable. `foreach` splits it into items and loops. All deterministic -- the AI only sees the `prompt` node.

### Full SDLC in a flow

```
flow:
  let requirements = prompt "Write detailed requirements for the login page."
  let design = prompt "Design the component architecture based on: ${requirements}"
  let tasks = prompt "Break the design into numbered tasks: ${design}"

  foreach task in ${tasks}
    prompt: Implement ${task}. Follow the design in ${design}.
  end

  retry max 3
    run: npm test
    if command_failed
      prompt: Fix the failing tests.
    end
  end

done when:
  tests_pass
  file_exists src/pages/login.tsx
```

Each phase feeds into the next via `${variables}`. The `foreach` loop implements tasks one by one. The `retry` loop fixes tests until green. Gates enforce the result.

### Parallel fan-out with spawn/await

```
flow:
  spawn "frontend"
    prompt: Fix the React component tests.
  end
  spawn "backend"
    prompt: Fix the API handler tests.
  end
  await all

  if ${frontend.test_result} contains "FAIL"
    prompt: The frontend still has failures. Fix them.
  end

done when:
  tests_pass
```

`spawn` launches parallel child processes. `await all` blocks until they finish. Child variables import with a prefix (`frontend.var_name`).

### AI-evaluated conditions with grounding

```
flow:
  until ask "Is the code production-ready?" grounded-by "npm run lint && npm test" max 3
    prompt: Improve the code quality. Focus on error handling and edge cases.
  end
```

`ask` lets the AI evaluate a subjective condition, but `grounded-by` runs a real command first so the judgment is informed by actual test/lint output.

### Error recovery with try/catch

```
flow:
  try
    run: npm run migrate
    run: npm run seed
    prompt: Verify the database schema matches the models.
  catch
    prompt: Migration failed. Read the error and fix the migration files.
    run: npm run migrate:rollback
  finally
    run: npm run db:status
  end
```

`try/catch/finally` works like you'd expect. If any `run` in the body fails, execution jumps to `catch`. `finally` always runs.

### Digital factory with named agents

```
agents:
  architect:
    model: "opus"
    skills: "system-design", "adr-writing"
  builder:
    model: "sonnet"
    skills: "backend-engineer", "unit-test-writer"
  reviewer:
    model: "opus"
    skills: "code-review", "security-review"

flow:
  let spec = prompt "Write a technical spec for: ${goal}"

  spawn "designer" as architect using profile "senior-dev"
    prompt: Design the architecture based on: ${spec}
  end
  await "designer" timeout 120

  foreach component in ${designer.components}
    spawn "impl-${item}" as builder
      prompt: Implement ${item} following ${designer.architecture}
    end
  end
  await all timeout 300

  spawn "review" as reviewer
    prompt: Review all code changes for quality and security.
  end
  await "review" timeout 120

done when:
  all(tests_pass, lint_pass)
```

Named agents define reusable roles with model, skills, and profile bindings. `spawn "name" as agentRef` creates a child with that configuration. Skills are injected as structured directives into the agent's context. `await` has configurable timeouts so crashed children don't block the factory.

## Feature overview

| Category          | Features                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **Control flow**  | `if`/`else if`/`else`, `while`, `until`, `retry`, `foreach`, `try`/`catch`/`finally`, `break`, `continue` |
| **Variables**     | `let x = "literal"`, `let x = run "cmd"`, `let x = prompt "..."`, `${x}` interpolation, lists, arithmetic |
| **Verification**  | `tests_pass`, `lint_pass`, `file_exists`, custom `gate name: command`, `all()`/`any()` composition        |
| **Parallelism**   | `spawn`/`await`, `race`, `foreach-spawn`, `send`/`receive` messaging                                      |
| **Agents**        | Named `agents:` definitions, `spawn as` agent refs, skill directives, `using profile`, await `timeout`    |
| **AI conditions** | `ask "question" grounded-by "command"` for subjective evaluation                                          |
| **Composition**   | `import`, named libraries, `include`, `export flow/prompt/gates`                                          |
| **Resilience**    | Persistent state, compaction survival, `snapshot`/`rollback`, `remember`/`memory`                         |
| **Tooling**       | CLI validation, dry-run, `watch` TUI, VS Code syntax highlighting                                         |

## CLI commands

| Command                               | What it does                                 |
| ------------------------------------- | -------------------------------------------- |
| `npx @45ck/prompt-language`           | Install the runtime                          |
| `npx @45ck/prompt-language status`    | Check installation                           |
| `npx @45ck/prompt-language validate`  | Parse, lint, score, and preview a flow       |
| `npx @45ck/prompt-language run`       | Execute a flow via Claude or headless runner |
| `npx @45ck/prompt-language ci`        | Run a flow in headless CI mode               |
| `npx @45ck/prompt-language watch`     | Live TUI flow monitor                        |
| `npx @45ck/prompt-language init`      | Scaffold a starter flow                      |
| `npx @45ck/prompt-language demo`      | Print an annotated example                   |
| `npx @45ck/prompt-language uninstall` | Remove the runtime                           |

Full CLI documentation: [docs/reference/cli-reference.md](docs/reference/cli-reference.md)

## Documentation

| Topic                   | Link                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| Getting started         | [docs/guides/getting-started.md](docs/guides/getting-started.md)         |
| Language reference      | [docs/reference/index.md](docs/reference/index.md)                       |
| DSL cheatsheet          | [docs/reference/dsl-cheatsheet.md](docs/reference/dsl-cheatsheet.md)     |
| How the runtime works   | [docs/guides/guide.md](docs/guides/guide.md)                             |
| Architecture and design | [docs/architecture.md](docs/architecture.md)                             |
| Security model          | [docs/security.md](docs/security.md)                                     |
| Examples                | [docs/examples/index.md](docs/examples/index.md)                         |
| Experiments             | [docs/experiments.md](docs/experiments.md)                               |
| Troubleshooting         | [docs/operations/troubleshooting.md](docs/operations/troubleshooting.md) |
| Roadmap                 | [docs/roadmap.md](docs/roadmap.md)                                       |
| Full doc index          | [docs/index.md](docs/index.md)                                           |

## Tooling

- **VS Code extension** -- syntax highlighting for `.flow`, `.prompt`, and inline flow blocks. Source in `vscode-extension/`.
- **GitHub Actions** -- run flows in CI with [`45ck/prompt-language-action`](https://github.com/45ck/prompt-language-action).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
