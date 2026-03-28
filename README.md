# @45ck/prompt-language

A programmable runtime for Claude Code.

It wraps Claude in a terminal-side state machine so you can define state, context, control flow, parallel work, and completion checks around the agent instead of supervising every turn by hand.

[![npm](https://img.shields.io/npm/v/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)
[![CI](https://github.com/45ck/prompt-language/actions/workflows/quality.yml/badge.svg)](https://github.com/45ck/prompt-language/actions/workflows/quality.yml)
[![license](https://img.shields.io/npm/l/@45ck/prompt-language)](LICENSE)
[![node](https://img.shields.io/node/v/@45ck/prompt-language)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![npm downloads](https://img.shields.io/npm/dm/@45ck/prompt-language)](https://www.npmjs.com/package/@45ck/prompt-language)

## What it is

Without prompt-language, the engineer is the runtime: keep track of the task, restate the right context, decide what happens next, rerun checks, and reject premature "done." prompt-language moves that supervision loop into the terminal.

Claude still does the reasoning, editing, and tool use. prompt-language provides the runtime around it.

## What you get

| Capability            | What it gives you                              | Example                                |
| --------------------- | ---------------------------------------------- | -------------------------------------- |
| Persistent state      | Remember where the task is across turns        | resumable loops and long-running flows |
| Deterministic context | Capture exact values and reuse them later      | `let baseline = run "node bench.js"`   |
| Control flow          | Encode retries, branching, batching, and loops | `retry`, `if`, `while`, `foreach`      |
| Parallel work         | Fan out independent tasks and join them back   | `spawn "frontend"` + `await all`       |
| Verification          | Block completion until real checks pass        | `done when: tests_pass lint_pass`      |

## Why engineers use it

- Less babysitting during long autonomous runs
- Exact context instead of "Claude probably remembers"
- Repeatable workflows instead of ad hoc follow-up prompts
- Parallel work when tasks are independent
- Real verification before completion, not model self-report

## The problem

You ask Claude to fix a bug. It makes a change and says "Done!" You say "run the tests." They fail. You say "fix those." It fixes one. You say "run the tests again." Two more fail. Five back-and-forth messages for something that should have been automatic.

With prompt-language, you can make the runtime own that loop instead of doing it yourself.

## Quick examples

### 1. Enforce real completion

```
Goal: fix the auth module and clean up the code

done when:
  tests_pass
  lint_pass
```

The runtime blocks completion until those checks actually pass.

### 2. Carry exact context through the task

```
Goal: fix all changed TypeScript files without breaking behavior

flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    prompt: Fix issues in ${file} without changing behavior.
  end

done when:
  tests_pass
  lint_pass
```

`let` captures state once. `foreach` turns it into an explicit workflow instead of hoping Claude tracks the list correctly in conversation.

### 3. Fan out independent work in parallel

```
Goal: fix frontend and backend regressions

flow:
  spawn "frontend"
    prompt: Fix the React component and its failing tests.
  end

  spawn "backend"
    prompt: Fix the API handler and its failing tests.
  end

  await all

done when:
  tests_pass
```

Use `spawn`/`await` when the work can be split cleanly.

## Install

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) and Node.js >= 22.

```bash
npx @45ck/prompt-language
```

```bash
npx @45ck/prompt-language status     # check installation
npx @45ck/prompt-language uninstall  # remove
```

**New to prompt-language?** Start with the **[Getting Started tutorial](https://github.com/45ck/prompt-language/blob/main/docs/getting-started.md)**.

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
| `npx @45ck/prompt-language`            | Install the runtime (default)            |
| `npx @45ck/prompt-language status`     | Check installation status                |
| `npx @45ck/prompt-language uninstall`  | Remove the runtime                       |
| `npx @45ck/prompt-language init`       | Scaffold a starter flow for your project |
| `npx @45ck/prompt-language demo`       | Print an annotated example flow          |
| `npx @45ck/prompt-language statusline` | Configure Claude Code status line        |
| `npx @45ck/prompt-language watch`      | Launch live TUI flow monitor             |

## Packaged workflows

prompt-language also ships a few ready-made slash commands built on top of the runtime. They are shortcuts and examples, not the core feature.

| Command         | What it does                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `/fix-and-test` | Retry loop: fix failing tests, re-run, repeat up to 5 times. Gate: tests_pass                      |
| `/tdd`          | Red-green-refactor cycle. Write failing test, implement, refactor. Gate: tests_pass + lint_pass    |
| `/refactor`     | Incremental refactoring with test verification after each change. Gate: tests_pass + lint_pass     |
| `/deploy-check` | Lint, test, build pipeline. Fix failures at each stage. Gate: tests_pass + lint_pass + file_exists |

## Verification

Verification is one capability, not the whole product, but it is the trust anchor. `done when:` runs real checks when Claude tries to finish. If a check fails, the runtime blocks completion and sends Claude back to work.

Start with `done when:` whenever the task has a real exit condition:

```
done when:
  tests_pass
```

Common predicates:

- `tests_pass`
- `lint_pass`
- `diff_nonempty`
- `file_exists dist/index.js`
- `gate typecheck: npx tsc --noEmit`

For the full predicate list and syntax, see the **[DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md)**.

## Runtime primitives

The language is small, but it covers the main runtime concerns:

| Category            | Primitives                                 | Purpose                                |
| ------------------- | ------------------------------------------ | -------------------------------------- |
| Actions             | `prompt`, `run`, `try/catch`               | Tell Claude what to do or run commands |
| State and context   | `let`, `var`                               | Capture values and reuse them later    |
| Control flow        | `if`, `while`, `until`, `retry`, `foreach` | Sequence work explicitly               |
| Parallelism         | `spawn`, `await`                           | Run independent sub-tasks concurrently |
| Completion criteria | `done when:`                               | Enforce real exit conditions           |

Example of a custom verification command:

```
done when:
  gate typecheck: mypy src/
  gate e2e: npx playwright test
```

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

Use prompt-language when you want a runtime around Claude, not just a better prompt.

Verification is where the repo has the clearest measured wins. State, variables, control flow, and parallelism are about programmability, repeatability, and reducing manual supervision.

| Situation                                                          | Use it?       | Why                                                 |
| ------------------------------------------------------------------ | ------------- | --------------------------------------------------- |
| Task has verifiable completion criteria (tests, lint, file exists) | **Yes**       | Verification catches what prompts miss              |
| Task needs explicit state or reusable captured context             | **Yes**       | Variables and re-injection keep the runtime honest  |
| Task benefits from batching or branching                           | **Yes**       | `foreach`, `retry`, and `if` make the flow explicit |
| Task can be split into independent work streams                    | **Yes**       | `spawn` / `await` lets you fan out safely           |
| Task is simple and well-specified                                  | **Maybe not** | Vanilla Claude may be faster                        |
| No verifiable exit condition exists and no runtime structure helps | **Maybe not** | Added machinery may not buy you much                |
| Speed matters and you'll supervise manually                        | **Maybe not** | The runtime adds overhead                           |

Full methodology, hypothesis-by-hypothesis results, and latency data: **[Evaluation Results](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md)**

## Monitoring

### Status line

The runtime configures Claude Code's status line to show flow progress — current node, loop iteration, and gate status — in the footer during execution. This is set up automatically on install.

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
