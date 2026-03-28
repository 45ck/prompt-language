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

- `tests_pass`, `tests_fail`
- `lint_pass`, `lint_fail`
- `pytest_pass`, `pytest_fail`
- `go_test_pass`, `go_test_fail`
- `cargo_test_pass`, `cargo_test_fail`
- `diff_nonempty`
- `file_exists dist/index.js`
- `gate typecheck: npx tsc --noEmit`

Built-in verification predicates:

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

You can also define custom and composite gates:

```
done when:
  gate typecheck: npx tsc --noEmit
  gate e2e: npx playwright test
  any(tests_pass, pytest_pass)
  all(lint_pass, diff_nonempty)
  2_of(tests_pass, lint_pass, diff_nonempty)
```

Supported gate forms also include direct equality checks such as `tests_pass == true` and negation such as `not tests_pass`.

## Complete feature surface

Everything in this section is part of the shipped runtime. For tracked but unavailable features, see the [Roadmap](https://github.com/45ck/prompt-language/blob/main/docs/roadmap.md).

The README should not make this look smaller than it is. The runtime surface includes:

### Program structure

| Section      | Purpose                                             |
| ------------ | --------------------------------------------------- |
| `Goal:`      | Human-readable task description                     |
| `env:`       | Inject environment variables into command execution |
| `flow:`      | Ordered runtime steps                               |
| `done when:` | Completion criteria                                 |

Example:

```yaml
Goal: deploy the service safely

env: NODE_ENV=production
  API_BASE=https://api.example.com

flow:
  run: npm run build

done when: tests_pass
  lint_pass
```

### Actions

| Feature           | Syntax                              | Purpose                                      |
| ----------------- | ----------------------------------- | -------------------------------------------- |
| Prompt injection  | `prompt: Fix the auth module.`      | Give Claude its next task                    |
| Command execution | `run: npm test`                     | Run a real shell command                     |
| Command timeout   | `run: npm test [timeout 60]`        | Kill long-running commands                   |
| Error handling    | `try ... catch ... finally ... end` | Recover from failures and always run cleanup |

### State and context

| Feature                | Syntax / Example                                       | Purpose                           |
| ---------------------- | ------------------------------------------------------ | --------------------------------- |
| Literal variable       | `let env = "prod"`                                     | Store a static value              |
| Command capture        | `let version = run "node -v"`                          | Store command output              |
| Prompt capture         | `let analysis = prompt "Summarize the failure"`        | Capture Claude's response as data |
| Interpolation          | `${version}`                                           | Reuse captured values             |
| Default values         | `${env:-development}`                                  | Fallback when a variable is unset |
| Inline arithmetic      | `let count = ${count} + 1`                             | Update integers inside the flow   |
| List variables         | `let items = []` and `let items += "value"`            | Build lists incrementally         |
| Pipe transforms        | `let branch = run "git branch --show-current" \| trim` | Clean captured output             |
| Built-in run variables | `last_exit_code`, `command_failed`, `last_stdout`      | Observe the last command exactly  |

Supported transforms: `trim`, `upper`, `lower`, `first`, `last`.

Prompt capture and `ask` conditions use a two-turn capture mechanism. If capture is missed repeatedly, the runtime retries and then continues with an empty value instead of hanging forever.

### Control flow

| Feature                | Syntax / Example                       | Purpose                          |
| ---------------------- | -------------------------------------- | -------------------------------- |
| Conditional branch     | `if tests_fail ... else ... end`       | Choose the next path             |
| Chained branches       | `else if lint_fail` / `elif lint_fail` | Multi-branch decision making     |
| While loop             | `while tests_fail max 5`               | Repeat while true                |
| Until loop             | `until tests_pass max 5`               | Repeat until true                |
| Retry loop             | `retry max 3`                          | Re-run a block on failure        |
| Foreach loop           | `foreach file in ${files}`             | Iterate over a list              |
| Loop exit              | `break`                                | Exit the nearest loop            |
| Loop skip              | `continue`                             | Skip to the next iteration       |
| Labeled loops          | `outer: foreach file in ${files}`      | Name a loop for explicit control |
| Labeled break/continue | `break outer` / `continue outer`       | Target a specific outer loop     |
| Comments               | `# this is ignored by the parser`      | Annotate flows inline            |

`foreach` can iterate JSON arrays, newline-delimited strings, whitespace-delimited strings, or `run "command"` results directly.

### AI-evaluated conditions

`ask` is part of the language and should be surfaced explicitly:

```yaml
while ask "does the code still have performance issues?" grounded-by "node bench.js" max 5
  prompt: Optimize the hottest code path.
  run: node bench.js
end
```

`ask` works with `if`, `while`, and `until`. Use it when the condition is subjective and cannot be reduced to a deterministic shell command.

### Parallelism

| Feature               | Syntax / Example                         | Purpose                                 |
| --------------------- | ---------------------------------------- | --------------------------------------- |
| Spawn child           | `spawn "frontend" ... end`               | Launch an independent child flow        |
| Cross-directory spawn | `spawn "backend" in "packages/api"`      | Run child work in another directory     |
| Selective var passing | `spawn "frontend" with vars branch, sha` | Limit which parent vars enter the child |
| Await all             | `await all`                              | Join all children                       |
| Await one child       | `await "frontend"`                       | Join a specific child                   |
| Child variable import | `${frontend.last_exit_code}`             | Read child results after `await`        |

Each `spawn` launches a separate `claude -p` process with its own state. Parent and child share the filesystem, but not session state.

### Runtime behavior

| Feature                    | What it does                                                 |
| -------------------------- | ------------------------------------------------------------ |
| Persistent session state   | Saves flow progress to `.prompt-language/session-state.json` |
| Natural-language detection | Can translate control-flow intent into DSL scaffolding       |
| Status line                | Shows current step, loop progress, and gate state            |
| Watch mode                 | Live TUI for long-running flows                              |
| Default loop limits        | `while`/`until` default to 5, `retry` to 3, `foreach` to 50  |

## Runtime primitives by name

If you want the flat list, the language includes all of these user-facing primitives and forms:

- `prompt`
- `run`
- `let` / `var`
- `if` / `else if` / `elif` / `else`
- `while`
- `until`
- `retry`
- `foreach`
- `try` / `catch` / `finally`
- `break`
- `continue`
- `spawn`
- `await`
- `ask ... grounded-by ...`
- `done when:`
- `env:`

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
- **[Roadmap](https://github.com/45ck/prompt-language/blob/main/docs/roadmap.md)** — tracked but not yet shipped features from `.beads`
- **[Language Reference](https://github.com/45ck/prompt-language/blob/main/docs/reference/index.md)** — per-feature reference pages for `ask`, `if`, `spawn`, `await`, `let/var`, `done when:`, and more
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
