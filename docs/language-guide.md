# Language Guide

Claude will tell you it's done when it isn't. Not out of malice — it pattern-matches completion from context clues, but it doesn't run your tests unless you tell it to. And when you tell it to, it might run them once, see a failure, and still say "Done! I've fixed the issue" without actually fixing anything.

prompt-language closes that gap. Append two lines to any prompt:

```
done when:
  tests_pass
```

These aren't instructions for Claude. They're a **gate** — a real shell command (`npm test`) that runs when Claude tries to stop. If the exit code is non-zero, Claude gets sent back. It cannot talk its way past an exit code.

That's the entire idea. The rest of this guide is about how far you can take it.

## Two building blocks

The plugin gives you two independent tools:

| Tool      | What it does                                                    | When you need it                                                      |
| --------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Gates** | Run commands before Claude can stop. Block on failure.          | Always. This is the core value.                                       |
| **Flows** | Structure multi-step execution with loops, branches, variables. | When you need iterative fix-test cycles or multi-phase orchestration. |

You can use gates without flows. Most of the time, you should. Gates alone cover the plugin's proven wins — in 45 controlled A/B experiments, every plugin victory came from gate enforcement.

## Gates

A gate is a shell command that must exit 0 before Claude can declare success. Gates go in the `done when:` section at the end of your prompt.

### Built-in predicates

| Predicate            | Runs               | Passes when      |
| -------------------- | ------------------ | ---------------- |
| `tests_pass`         | `npm test`         | exit 0           |
| `tests_fail`         | `npm test`         | exit non-zero    |
| `lint_pass`          | `npm run lint`     | exit 0           |
| `lint_fail`          | `npm run lint`     | exit non-zero    |
| `pytest_pass`        | `pytest`           | exit 0           |
| `pytest_fail`        | `pytest`           | exit non-zero    |
| `go_test_pass`       | `go test ./...`    | exit 0           |
| `cargo_test_pass`    | `cargo test`       | exit 0           |
| `diff_nonempty`      | `git diff --quiet` | diff has changes |
| `file_exists <path>` | `test -f '<path>'` | file exists      |

### Custom gates

For commands not covered by a built-in:

```
done when:
  gate typecheck: npx tsc --noEmit
  gate e2e: npx playwright test
```

Any command that exits 0 passes. Any command that exits non-zero fails.

### Compound gates

Stack multiple predicates. All must pass:

```
done when:
  tests_pass
  lint_pass
  file_exists dist/index.js
```

You said "fix the test failures." The gates also enforce lint and a successful build — requirements the prompt never mentioned.

### Why gates can't be fooled

Gates don't read variables or trust Claude's claims. When Claude tries to stop, the plugin runs the real command and checks the exit code. Even if Claude sets a variable named `tests_pass` to `"true"`, the gate ignores it and runs `npm test` itself. This is a deliberate design asymmetry: flow conditions (like `if command_failed`) trust the variable store for speed; gates never do.

## Flows

A flow structures multi-step execution. It's optional — gates work fine without one.

### Program structure

```
Goal: fix the auth tests

flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the failing tests based on the error output above.
    end
  end

done when:
  tests_pass
```

Three sections: `Goal:` describes the task. `flow:` defines the steps. `done when:` sets the exit criteria. All three are optional and independent.

### What Claude sees

On every turn, the plugin injects a state snapshot into Claude's context. Claude doesn't rely on conversation history to know where it is — it gets a deterministic re-injection from the session state file:

```
[prompt-language] Flow: fix the auth tests | Status: active

> retry max 5 [2/5]
    run: npm test
>   if command_failed
>     prompt: Fix the failing tests.  <-- current
    end
  end

done when:
  tests_pass  [fail]

Variables:
  last_exit_code = 1
  command_failed = true
```

| Annotation    | Meaning                                |
| ------------- | -------------------------------------- |
| `>` prefix    | Node is on the active execution path   |
| `<-- current` | The step Claude should execute now     |
| `[2/5]`       | Loop iteration 2 of 5                  |
| `[fail]`      | Gate has not passed yet                |
| `[= value]`   | Resolved variable value on `let` nodes |

This snapshot is rebuilt from state on every turn. Even if earlier messages are compressed away, the flow state is always accurate.

## Primitives

### prompt

Inject text as Claude's next instruction:

```
prompt: Fix the type errors in src/auth.ts
```

### run

Execute a shell command. Captures exit code and output:

```
run: npm test
run: npx eslint . --max-warnings=0
```

Optional timeout in seconds (use bracket syntax):

```
run: npm test [timeout 60]
```

After every `run`, five built-in variables are set automatically:

| Variable            | Type    | Description                   |
| ------------------- | ------- | ----------------------------- |
| `last_exit_code`    | number  | Exit code of the last command |
| `command_failed`    | boolean | `true` if exit code != 0      |
| `command_succeeded` | boolean | `true` if exit code == 0      |
| `last_stdout`       | string  | stdout (max 2000 chars)       |
| `last_stderr`       | string  | stderr (max 2000 chars)       |

### retry

Retry a block on failure. The most common loop pattern for fix-test cycles:

```
retry max 3
  run: npm run build
  if command_failed
    prompt: Fix the build errors shown above.
  end
end
```

`retry max 3` means 3 total attempts: 1 initial + 2 retries. The block always runs once. If the last command fails, it re-enters. If all attempts are exhausted, the flow continues to the next step.

### if / else

Conditional branching based on a variable or predicate:

```
if command_failed
  prompt: Fix the errors shown above.
else
  prompt: Tests pass. Move on to lint.
end
```

Conditions support `not`, `and`, `or`, and comparison operators:

```
if ${count} > 0 and not command_failed
  prompt: Process the results.
end
```

**Multi-branch** — use `else if` or `elif` for chained conditions:

```
if tests_fail
  prompt: Fix the tests.
else if lint_fail
  prompt: Fix the lint errors.
else
  prompt: All checks passed.
end
```

### while / until

Loop with a condition. `while` loops while true, `until` loops until true:

```
while tests_fail max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

```
until tests_pass max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

Both require a `max` iteration limit (default: 5). If the limit is reached, the flow continues past the loop.

**AI-evaluated conditions (`ask`)** — let Claude evaluate a subjective question instead of a command predicate:

```
while ask "does the code still have performance issues?" max 5
  prompt: Optimize the hottest code path.
  run: node bench.js
end
```

Add `grounded-by "command"` to base the verdict on real output:

```
while ask "are there still failing tests?" grounded-by "npm test" max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

`ask` conditions work with `while`, `until`, and `if`. They take one extra turn to evaluate — Claude receives the judge prompt, answers true/false, and the plugin captures the verdict the same way as `let x = prompt`.

**Choosing between loop primitives:**

| Primitive | Use when                                                        |
| --------- | --------------------------------------------------------------- |
| `retry`   | Fix-test cycles. Retries on failure, no condition to get right. |
| `until`   | You want to loop until a condition becomes true.                |
| `while`   | You want to loop while a condition remains true.                |
| `foreach` | You have a list of items to process.                            |

### foreach

Iterate over a list. Splits automatically from JSON arrays, newlines, or whitespace:

```
let files = run "git diff --name-only -- '*.ts'"
foreach file in ${files}
  run: npx eslint ${file} --fix
end
```

With a literal list:

```
foreach env in "dev staging prod"
  run: deploy --target ${env}
end
```

Auto-set variables per iteration: `${file}` (current item), `${file_index}` (zero-based index), `${file_length}` (total count). Default max: 50 iterations.

### try / catch

Execute a block with error recovery:

```
try
  run: npm run deploy
catch command_failed
  prompt: Deploy failed. Investigate and fix the error.
end
```

The body always runs. If the catch condition is true after the body, the catch block runs. Default catch condition: `command_failed`.

### let / var

Store a named variable. `let` and `var` are interchangeable. Three source types:

**Literal** — store a string:

```
let greeting = "hello world"
```

**Run** — execute a command, store stdout:

```
let version = run "node -v"
```

**Prompt** — ask Claude a question, capture the response:

```
let analysis = prompt "Summarize the test failures"
```

Prompt capture takes two turns: Claude answers and writes the value to a file, then the plugin reads it on the next turn. If the file isn't written after 3 retries, the variable is set to empty string and the flow continues.

**Interpolation** — use `${varName}` in prompt and run text:

```
let module = "auth"
prompt: Refactor the ${module} module for clarity.
run: npm test -- ${module}
```

**Default values** — `${varName:-fallback}` when a variable might be unset:

```
prompt: Deploying to ${env:-development}.
```

**Arithmetic** — inline integer math with `+`, `-`, `*`, `/`:

```
let count = "0"
let count = ${count} + 1
let doubled = ${count} * 2
```

Operators evaluate left-to-right. If any operand is non-numeric, the expression is left as-is.

**List variables** — initialize, append, iterate:

```
let items = []
let items += "first"
let items += run "echo second"
foreach item in ${items}
  prompt: Process ${item}.
end
```

> **Scope gotcha**: Variables are flat — a variable set inside a loop is visible everywhere. There is no block scoping. Auto-variables (`command_failed`, `last_stdout`, etc.) are overwritten after every `run:` — save values you need later: `let saved_code = "${last_exit_code}"`.

### break

Exit the nearest enclosing loop (`while`, `until`, `retry`, `foreach`):

```
while tests_fail max 10
  prompt: Fix the next failing test.
  run: npm test
  if command_succeeded
    break
  end
end
```

### continue

Skip to the next loop iteration. Any remaining statements in the current iteration are skipped:

```
foreach file in ${files}
  run: npx tsc --noEmit ${file}
  if command_succeeded
    continue
  end
  prompt: Fix the type errors in ${file}.
end
```

`continue` works inside `while`, `until`, `retry`, and `foreach`.

### spawn / await (parallel execution)

Launch independent sub-tasks to run in parallel. Each spawn creates a separate Claude process with its own state.

```
spawn "fix-tests"
  run: npm test
  if command_failed
    prompt: Fix the failing tests.
  end
end

spawn "fix-lint"
  run: npm run lint
  if command_failed
    prompt: Fix the lint errors.
  end
end

await all
prompt: Both tasks done. Tests: ${fix-tests.command_failed}. Lint: ${fix-lint.command_failed}.
```

`spawn` advances immediately — the parent doesn't wait. `await all` blocks until every child finishes. Use `await "name"` to wait for a specific child.

After await, child variables are available with a name prefix: `${fix-tests.last_exit_code}`, `${fix-lint.last_stdout}`.

**When to use spawn vs. foreach:**

| Use case                                        | Primitive                     |
| ----------------------------------------------- | ----------------------------- |
| Same operation on each item in a list           | `foreach`                     |
| Different independent operations in parallel    | `spawn`                       |
| Sequential operations that depend on each other | Neither — just list the steps |

Key constraints:

- Children share the filesystem but not session state.
- No sibling-to-sibling variable access.
- No automatic error propagation — check `${child.command_failed}` explicitly.
- No nested spawn support.

> **Warning**: Each spawn creates a separate `claude -p` process. Spawning many children consumes significant resources. Keep spawn count low (2-4 children). For batch operations on a list, use `foreach` instead.

## Composition

All primitives nest freely. A retry can contain an if, a foreach can contain a try/catch, a while can contain another while:

```
Goal: fix tests and lint

flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the test failures.
    end
  end
  run: npm run lint
  if command_failed
    prompt: Fix the lint errors.
  end

done when:
  tests_pass
  lint_pass
```

## Patterns

### Gate-only bug fix

The simplest and most valuable pattern. No flow needed:

```
Goal: fix the auth module and clean up the code

done when:
  tests_pass
  lint_pass
```

### Fix-test loop

Iterative fix with a safety net:

```
Goal: fix the failing tests

flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the failing tests based on the error output above.
    end
  end

done when:
  tests_pass
```

### Baseline comparison

Capture exact values before and after a change:

```
flow:
  let baseline = run "node bench.js"
  prompt: Optimize the hot path in src/api.ts.
  let result = run "node bench.js"
  prompt: Compare baseline (${baseline}) vs current (${result}). Write a summary.

done when:
  tests_pass
```

Variables survive context compression — the exact numbers are re-injected every turn.

### Force real code changes

Prevent Claude from just observing without modifying:

```
Goal: review calculator.js and fix any issues

done when:
  diff_nonempty
  tests_pass
```

### Process a dynamic file list

Command output as loop input:

```
flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    run: npx eslint ${file} --fix
  end

done when:
  lint_pass
```

### Error recovery

Graceful handling of expected failures:

```
flow:
  try
    run: npm run deploy
  catch command_failed
    prompt: Deploy failed. Diagnose the error and fix it.
    run: npm run deploy
  end
```

### Selective context injection

Different steps get different context:

```
flow:
  let security_rules = prompt "List the security constraints for this module."
  prompt: Refactor auth.js following: ${security_rules}
  let review_criteria = prompt "What should we check in code review?"
  prompt: Review the refactored code against: ${review_criteria}
```

The security step doesn't see the review criteria. The review step doesn't see the security rules. Each step gets exactly what it needs.

## When not to use this

Be honest about tradeoffs. From 45 controlled A/B experiments (300+ test runs):

- **Gates win 15/45** — all from enforcing criteria the prompt omitted or lied about
- **Flow control wins 0/45** — Claude follows explicit multi-step instructions without scaffolding
- **Variable capture wins 0/45** — at tested distances (2-15 steps), vanilla Claude recalls values accurately
- **Latency overhead: 2-3x** — a 30-second task takes 90+ seconds through the plugin

**Skip the plugin when:**

- The prompt is clear and complete. Vanilla Claude matches correctness at 2-3x less latency.
- There's no verifiable exit condition. No command to run = no gate to add = overhead without benefit.
- Speed matters and you'll verify manually.
- You're adding a flow to improve correctness. Write a better prompt instead — flows are for organizational convenience.

**Use the plugin when:**

- You have a verifiable completion criterion that the prompt omits, understates, or lies about.
- You need compound verification (tests AND lint AND build) enforced mechanically.
- You want to force real code changes, not just observations (`diff_nonempty`).
- You distrust the prompt (generated, copied, adversarial) and want gaslighting resistance.

## Quick reference

### Primitives

| Primitive   | Syntax                                          | Default                |
| ----------- | ----------------------------------------------- | ---------------------- |
| `prompt`    | `prompt: <text>`                                | —                      |
| `run`       | `run: <command> [timeout N]`                    | —                      |
| `let`/`var` | `let x = "val"` / `run "cmd"` / `prompt "text"` | —                      |
| `retry`     | `retry max N ... end`                           | max 3                  |
| `if`        | `if <cond> ... [else ...] end`                  | —                      |
| `while`     | `while <cond> max N ... end`                    | max 5                  |
| `until`     | `until <cond> max N ... end`                    | max 5                  |
| `foreach`   | `foreach x in <list> [max N] ... end`           | max 50                 |
| `try`       | `try ... catch <cond> ... end`                  | catch `command_failed` |
| `break`     | `break`                                         | —                      |
| `spawn`     | `spawn "name" ... end`                          | —                      |
| `await`     | `await all` / `await "name"`                    | —                      |

### Condition syntax

| Form        | Example                                |
| ----------- | -------------------------------------- |
| Variable    | `command_failed`                       |
| Negation    | `not command_failed`                   |
| Conjunction | `tests_pass and lint_pass`             |
| Disjunction | `command_failed or lint_fail`          |
| Comparison  | `${count} > 0`, `${status} == "ready"` |

### Auto-variables (set after every `run`)

`last_exit_code`, `command_failed`, `command_succeeded`, `last_stdout`, `last_stderr`

### Interpolation

`${varName}` in prompt/run text. Unknown variables pass through as-is. Default values: `${varName:-fallback}`.

## Further reading

- **[Getting Started](https://github.com/45ck/prompt-language/blob/main/docs/getting-started.md)** — hands-on tutorial with a working example
- **[How It Works](https://github.com/45ck/prompt-language/blob/main/docs/guide.md)** — enforcement model, variable lifecycle, gate trust mechanics
- **[DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md)** — complete syntax specification
- **[Showcase](https://github.com/45ck/prompt-language/blob/main/docs/showcase.md)** — 140+ worked examples
- **[Evaluation Results](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md)** — full A/B testing methodology and results
- **[Troubleshooting](https://github.com/45ck/prompt-language/blob/main/docs/troubleshooting.md)** — debugging stuck flows, state file inspection, known issues
