# @45ck/prompt-language

Stop telling Claude to run the tests.

A Claude Code plugin that runs real commands before letting Claude stop — so it can't claim "done" until your tests actually pass.

[![npm](https://img.shields.io/npm/v/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)
[![CI](https://github.com/45ck/prompt-language/actions/workflows/quality.yml/badge.svg)](https://github.com/45ck/prompt-language/actions/workflows/quality.yml)
[![license](https://img.shields.io/npm/l/@45ck/prompt-language)](LICENSE)
[![node](https://img.shields.io/node/v/@45ck/prompt-language)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![npm downloads](https://img.shields.io/npm/dm/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)

## The problem

You ask Claude to fix a bug. It makes a change and says "Done!" You say "run the tests." They fail. You say "fix those." It fixes one. You say "run the tests again." Two more fail. Five back-and-forth messages for something that should have been automatic.

Append two lines to any prompt and Claude literally cannot stop until the tests pass:

```
Goal: fix the auth module and clean up the code

done when:
  tests_pass
  lint_pass
```

No DSL to learn. Claude works however it wants, but it cannot stop until both `npm test` and `npm run lint` exit 0. The plugin intercepts Claude's stop signal and re-injects the task if any gate fails.

## Install

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) and Node.js >= 22.

```bash
npx @45ck/prompt-language
```

```bash
npx @45ck/prompt-language status     # check installation
npx @45ck/prompt-language uninstall  # remove
```

**New to the plugin?** Start with the **[Getting Started tutorial](https://github.com/45ck/prompt-language/blob/main/docs/getting-started.md)**.

<details>
<summary>Manual install</summary>

```bash
git clone https://github.com/45ck/prompt-language.git
cd prompt-language
npm install && npm run build
node bin/cli.mjs install
```

</details>

## CLI commands

| Command                                | What it does                             |
| -------------------------------------- | ---------------------------------------- |
| `npx @45ck/prompt-language`            | Install the plugin (default)             |
| `npx @45ck/prompt-language status`     | Check installation status                |
| `npx @45ck/prompt-language uninstall`  | Remove the plugin                        |
| `npx @45ck/prompt-language init`       | Scaffold a starter flow for your project |
| `npx @45ck/prompt-language demo`       | Print an annotated example flow          |
| `npx @45ck/prompt-language statusline` | Configure Claude Code status line        |
| `npx @45ck/prompt-language watch`      | Launch live TUI flow monitor             |

## Slash commands

Zero DSL to learn. Type a slash command and walk away:

| Command         | What it does                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `/fix-and-test` | Retry loop: fix failing tests, re-run, repeat up to 5 times. Gate: tests_pass                      |
| `/tdd`          | Red-green-refactor cycle. Write failing test, implement, refactor. Gate: tests_pass + lint_pass    |
| `/refactor`     | Incremental refactoring with test verification after each change. Gate: tests_pass + lint_pass     |
| `/deploy-check` | Lint, test, build pipeline. Fix failures at each stage. Gate: tests_pass + lint_pass + file_exists |

## Gates

**Gates** are verification checks that run when Claude tries to stop. Each gate is defined by a **predicate** — a named condition that maps to a real shell command. If any gate fails (command exits non-zero), the plugin blocks the stop and forces Claude to keep working. Gates can't be bypassed: they always run the actual command, regardless of what Claude says.

`done when:` is the enforcement section — add it to any prompt to make gates mandatory. `flow:` is optional — it structures iterative steps. You can use `done when:` alone (no `flow:` needed) for simple enforcement:

```
done when:
  tests_pass
```

### Built-in gates

| Predicate          | Runs               | Passes when      |
| ------------------ | ------------------ | ---------------- |
| `tests_pass`       | `npm test`         | exit 0           |
| `tests_fail`       | `npm test`         | exit non-zero    |
| `lint_pass`        | `npm run lint`     | exit 0           |
| `lint_fail`        | `npm run lint`     | exit non-zero    |
| `pytest_pass`      | `pytest`           | exit 0           |
| `pytest_fail`      | `pytest`           | exit non-zero    |
| `go_test_pass`     | `go test ./...`    | exit 0           |
| `go_test_fail`     | `go test ./...`    | exit non-zero    |
| `cargo_test_pass`  | `cargo test`       | exit 0           |
| `cargo_test_fail`  | `cargo test`       | exit non-zero    |
| `diff_nonempty`    | `git diff --quiet` | diff has changes |
| `file_exists path` | `test -f 'path'`   | file exists      |

### Custom gates

For any command not covered by a built-in, define your own in the `done when:` section with `gate name: command`:

```
done when:
  gate typecheck: mypy src/
  gate e2e: npx playwright test
```

Any command that exits 0 passes. Any command that exits non-zero fails.

## Examples

### Fix-test loop

The most common pattern. Retry until tests pass:

```
Goal: fix the auth tests

flow:
  retry max 5
    run: npm test -- auth
    if command_failed
      prompt: Fix the failing tests based on the error output above.
    end
  end

done when:
  tests_pass
```

### Enforce unstated requirements

Claude has no reason to lint unless you tell it to. Gates enforce requirements the prompt doesn't mention:

```
Goal: fix the test failures

done when:
  tests_pass
  lint_pass
  file_exists dist/index.js
```

You said "fix the test failures." The gates also enforce lint and a successful build.

### Force actual code changes

Ask for a review and Claude writes observations without changing code. The `diff_nonempty` gate forces real modifications:

```
Goal: review calculator.js and fix any issues

done when:
  diff_nonempty
  tests_pass
```

### Conditional diagnostics

Branch on error type, apply different fix strategies:

```
Goal: fix all quality issues

flow:
  run: npm test
  if tests_fail
    prompt: Fix the failing tests based on the error output.
    run: npm test
  end
  run: npm run lint
  if lint_fail
    prompt: Fix the lint errors shown above.
    run: npm run lint
  end

done when:
  tests_pass
  lint_pass
```

### Process a list of files

Iterate over command output:

```
Goal: lint all changed TypeScript files

flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    run: npx eslint ${file} --fix
  end

done when:
  lint_pass
```

`foreach` splits the list automatically (JSON arrays, newline-delimited, or whitespace-delimited).

## When to use this

Tested in 300+ controlled A/B runs across 45 hypotheses. Gates win 15/45 — all from enforcement. Flow control wins 0. Expect 2-3x latency overhead.

| Situation                                                          | Use plugin? | Why                                             |
| ------------------------------------------------------------------ | ----------- | ----------------------------------------------- |
| Task has verifiable completion criteria (tests, lint, file exists) | **Yes**     | Gates catch what prompts miss                   |
| You distrust the prompt (generated, copied, adversarial)           | **Yes**     | Gaslighting resistance — gates ignore lies      |
| You need to force code changes, not just review                    | **Yes**     | `diff_nonempty` gate                            |
| Multiple independent criteria must all pass                        | **Yes**     | Compound gates                                  |
| Task is simple and well-specified                                  | **No**      | Vanilla Claude matches correctness, 2-3x faster |
| No verifiable exit condition exists                                | **No**      | No gate to add, overhead without benefit        |
| Speed matters and you'll verify manually                           | **No**      | Plugin adds latency without benefit             |

Full methodology, hypothesis-by-hypothesis results, and latency data: **[Evaluation Results](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md)**

## DSL reference

| Primitive       | Purpose                              | Example                                |
| --------------- | ------------------------------------ | -------------------------------------- |
| `prompt:`       | Inject an instruction for the agent  | `prompt: Fix the auth module.`         |
| `run:`          | Execute a command, capture result    | `run: npm test`                        |
| `let`/`var`     | Store a value for `${interpolation}` | `let ver = run "node -v"`              |
| `while`         | Loop while condition is true         | `while tests_fail max 5`               |
| `until`         | Loop until condition becomes true    | `until tests_pass max 5`               |
| `retry`         | Retry block on failure               | `retry max 3`                          |
| `if`/`else`     | Conditional branching                | `if lint_fail ... else ... end`        |
| `try`/`catch`   | Execute with error recovery          | `try ... catch command_failed ... end` |
| `foreach`       | Iterate over a list                  | `foreach file in ${files} max 10`      |
| `break`         | Exit nearest enclosing loop          | `break`                                |
| `spawn`/`await` | Launch parallel sub-tasks            | `spawn "name" ... end` / `await all`   |
| `done when:`    | Completion gate (blocks stopping)    | `done when: tests_pass`                |

Full syntax, built-in variables, and gate predicates: **[DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md)**

## Monitoring

### Status line

The plugin configures Claude Code's status line to show flow progress — current node, loop iteration, and gate status — in the footer during execution. This is set up automatically on install.

### Watch mode

For a live TUI view of flow execution:

```bash
npx @45ck/prompt-language watch
```

Shows the full flow state updating in real time — useful for watching long-running flows.

## Learn more

- **[Getting Started](https://github.com/45ck/prompt-language/blob/main/docs/getting-started.md)** — see it work in 2 minutes
- **[How prompt-language works](https://github.com/45ck/prompt-language/blob/main/docs/guide.md)** — how it works, variable lifecycle, gate trust model
- **[DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md)** — complete syntax specification
- **[Troubleshooting](https://github.com/45ck/prompt-language/blob/main/docs/troubleshooting.md)** — debugging stuck flows, known issues
- **[Evaluation Results](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md)** — A/B testing methodology and results
- **[CLI Reference](https://github.com/45ck/prompt-language/blob/main/docs/cli-reference.md)** — all CLI commands and slash commands
- **[Use Cases](https://github.com/45ck/prompt-language/blob/main/docs/use-cases.md)** — when the plugin wins, anti-patterns, quick recipes
- **[Documentation Index](https://github.com/45ck/prompt-language/blob/main/docs/index.md)** — full documentation hub

## Contributing

See [CONTRIBUTING.md](https://github.com/45ck/prompt-language/blob/main/CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
