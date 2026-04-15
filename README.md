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

## Hello World

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

The runtime blocks completion until `npm test` and `npm run lint` actually pass. Claude cannot self-report "done" -- the gates enforce it.

## What you get

- **Verification gates** -- block completion until real checks pass (`tests_pass`, `lint_pass`, `file_exists`, custom gates)
- **Persistent state** -- session state survives across turns; resumable loops, long-running flows
- **Deterministic control flow** -- `if`, `while`, `until`, `retry`, `foreach`, `try/catch/finally`, `break`, `continue`
- **Variable capture** -- `let version = run "node -v"`, `let analysis = prompt "Summarize"`, interpolation via `${var}`
- **Parallel execution** -- `spawn`/`await` fan-out, `race`, `foreach-spawn`, inter-process `send`/`receive`
- **Reuse and composition** -- `import`, named libraries, `export flow/prompt/gates`
- **AI-evaluated conditions** -- `ask "is the code clean?" grounded-by "npm run lint"`
- **Memory** -- `remember` key-value storage, `memory:` prefetch
- **Packaged workflows** -- `/fix-and-test`, `/tdd`, `/refactor`, `/deploy-check`
- **Monitoring** -- status line, `watch` TUI, flow validation and linting
- **SDK** -- programmatic `parseFlow`, `advanceFlow`, `evaluateGates`, `renderFlow`

## Quick examples

### Enforce completion with gates

```
Goal: fix the test failures

done when:
  tests_pass
  lint_pass
  file_exists dist/index.js
```

### Carry exact context through a workflow

```
Goal: fix all changed TypeScript files

flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    prompt: Fix issues in ${file} without changing behavior.
  end

done when:
  tests_pass
```

### Fan out parallel work

```
Goal: fix frontend and backend regressions

flow:
  spawn "frontend"
    prompt: Fix the React component tests.
  end
  spawn "backend"
    prompt: Fix the API handler tests.
  end
  await all

done when:
  tests_pass
```

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
