# DSL Reference

The prompt-language DSL defines control-flow programs using thirteen primitives: `prompt`, `run`, `while`, `until`, `retry`, `if`, `try/catch`, `foreach`, `let/var`, `break`, `continue`, `spawn`, and `await`. Programs are composed by nesting these primitives. Blocks use indentation with explicit `end` keywords.

If you want per-feature reference pages instead of one long document, start at the [Language Reference index](index.md).

## Quick syntax reference

| Primitive   | Syntax                                         | Purpose                         |
| ----------- | ---------------------------------------------- | ------------------------------- |
| `prompt`    | `prompt: text`                                 | Inject instruction for Claude   |
| `run`       | `run: command timeout N` or `[timeout N]`      | Execute shell command           |
| `let`/`var` | `let x = "val"` \| `run "cmd"` \| `prompt "q"` | Store a variable                |
| `while`     | `while condition max N` … `end`                | Loop while condition is true    |
| `until`     | `until condition max N` … `end`                | Loop until condition is true    |
| `retry`     | `retry max N` … `end`                          | Repeat body on `command_failed` |
| `if`        | `if condition` … `else` … `end`                | Conditional branch              |
| `try`       | `try` … `catch` … `finally` … `end`            | Error recovery                  |
| `foreach`   | `foreach x in ${list} max N` … `end`           | Iterate over a list             |
| `break`     | `break`                                        | Exit nearest loop               |
| `continue`  | `continue`                                     | Skip to next loop iteration     |
| `spawn`     | `spawn "name"` … `end`                         | Launch parallel child process   |
| `await`     | `await all` \| `await "name"`                  | Wait for spawned children       |

Scroll down for full syntax, parameters, examples, and built-in resolvers.

## Program structure

A flow program has three sections:

```
Goal: <description>

flow:
  <statements>

done when:
  <predicates>
```

## Primitives

### prompt

Inject text as the agent's next instruction. The agent must act on this prompt before continuing.

```
prompt: Fix the type errors in src/auth.ts
```

The text can reference state variables. The agent sees the prompt as its next task.

### run

Execute a shell command. Capture exit code and output.

```
run: npm test
run: npx eslint . --max-warnings=0
run: git diff --name-only
```

Optional timeout (in seconds) to kill long-running commands. Use bracket syntax:

```
run: npm test [timeout 60]
run: node build.js [timeout 120]
```

If the command exceeds the timeout, it is killed and treated as a failure (non-zero exit code).

After every `run`, built-in resolvers automatically update state variables based on the exit code and command output. See the Resolvers section below.

### while

Loop while a condition is true. Requires a `max` iteration limit to prevent infinite loops.

```
while tests_fail max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

Use `while not <condition>` to negate:

```
while not tests_pass max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

Parameters:

- condition: A resolver variable name. Evaluated as a boolean.
- max: Maximum iterations (default: 5).
- body: One or more DSL statements (indented).

The loop evaluates the condition before each iteration. If the condition is false, the loop exits. If max iterations are reached, the loop exits and the flow continues with the next step.

### until

Loop until a condition becomes true. Inverse of `while`.

```
until tests_pass max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

Parameters:

- condition: A resolver variable name. The loop exits when this is true.
- max: Maximum iterations (default: 5).
- body: One or more DSL statements (indented).

The loop evaluates the condition before entering the body and again after each iteration. If the condition is true, the loop exits. If the condition is already true at the start, the body is never entered. If max iterations are reached, the loop exits and the flow continues with the next step.

### retry

Retry a block up to N times. The block is re-executed if the last command in it fails.

```
retry max 3
  run: npm run build
end
```

Parameters:

- max: Total number of attempts (default: 3). `retry max 3` means 3 total attempts: 1 initial + 2 retries.
- body: One or more DSL statements (indented).

The block always runs once. If the last command fails, it re-enters the body. This repeats until the command succeeds or the attempt limit is reached. If all attempts are exhausted, the retry exits and the flow continues with the next step.

Example: `retry max 1` runs the body exactly once with no retries.

### if

Conditional branching. Execute one branch or the other based on a condition.

```
if lint_fail
  prompt: Fix the lint errors shown above.
  run: npm run lint
else
  prompt: Lint is clean. Proceed to tests.
end
```

Parameters:

- condition: A resolver variable name. Evaluated as a boolean.
- then: One or more DSL statements executed if condition is true.
- else: (Optional) One or more DSL statements executed if condition is false.

**Multi-branch conditionals** — use `else if` or `elif` for chained conditions:

```
if tests_fail
  prompt: Fix the tests.
else if lint_fail
  prompt: Fix the lint errors.
else
  prompt: All checks passed. Continue.
end
```

`else if` and `elif` are identical aliases. The parser desugars them into nested `if/else` blocks.

### let/var

Store a named variable for later use via `${varName}` interpolation. `let` and `var` are interchangeable. All `let`/`var` nodes auto-advance — no agent interaction required.

Three source types:

**Literal** — store a string value directly.

```
let greeting = "hello world"
var name = auth module
```

**Prompt** — store prompt text as named context.

```
let context = prompt "Summarize the test failures"
```

**Run** — execute a command and store its stdout.

```
let output = run "npm test 2>&1 | tail -5"
var version = run "node -v"
```

Stored variables are available via `${varName}` in `prompt:` and `run:` text:

```
let module = "auth"
prompt: Refactor the ${module} for clarity.
run: npm test -- ${module}
```

Unknown `${varName}` tokens are left as-is (no error).

**Default values**: Use `${varName:-default}` to provide a fallback when a variable is unset:

```
prompt: Running on ${env:-development}.
run: node deploy.js --target ${env:-local}
```

If `env` is not set, the default value is used. If `env` is set, the default is ignored.

**Inline arithmetic** — `let` supports integer arithmetic with `+`, `-`, `*`, `/`:

```
let count = "0"
let count = ${count} + 1
let half = ${count} / 2
```

Operators are evaluated left-to-right on integers. If any operand is non-numeric, the expression is left as-is.

**List variables** — initialize an empty list, append values, and iterate:

```
let items = []
let items += "first"
let items += run "echo second"
foreach item in ${items}
  prompt: Process ${item}.
end
```

The auto-variable `${items_length}` is updated on every append.

### foreach

Iterate over a collection of items. The list is split automatically from a variable or literal: JSON arrays, newline-delimited strings, or whitespace-delimited strings.

```
let files = run "find src -name '*.ts'"
foreach file in ${files}
  run: npx tsc --noEmit ${file}
end
```

With a literal list:

```
foreach env in "dev staging prod"
  run: deploy --target ${env}
end
```

Parameters:

- variableName: The loop variable name, set to the current item on each iteration.
- listExpression: A `${varName}` reference or quoted literal. Parsed as: (1) JSON array, (2) newline-delimited, or (3) whitespace-delimited.
- max: Maximum iterations (default: 50).
- body: One or more DSL statements (indented).

Auto-set variables per iteration:

- `${variableName}` — the current item value
- `${variableName_index}` — zero-based iteration index
- `${variableName_length}` — total number of items

If the list is empty, the body is skipped entirely.

### try/catch/finally

Execute a block. If the catch condition triggers, run the catch block. An optional `finally` block always executes regardless of success or failure.

```
try
  run: npm run deploy
catch command_failed
  prompt: Deploy failed. Investigate the error and retry manually.
end
```

With a `finally` block for cleanup that always runs:

```
try
  run: npm run deploy
catch command_failed
  prompt: Deploy failed. Roll back.
finally
  run: cleanup.sh
end
```

Parameters:

- body: One or more DSL statements.
- catchCondition: A resolver variable name. If true after body execution, the catch block runs. Defaults to `command_failed`.
- catchBody: One or more DSL statements.
- finallyBody: (Optional) One or more DSL statements. Always executes after the body (and catch, if triggered), whether or not an error occurred.

### break

Exit the nearest enclosing loop (`while`, `until`, `retry`, `foreach`). Execution advances past the loop's `end`.

```
break
```

Example:

```
while tests_fail max 10
  prompt: Fix the next failing test.
  run: npm test
  if command_succeeded
    break
  end
end
```

`break` outside a loop is a lint warning (detected by `lintFlow()`). It has no effect when there is no enclosing loop to exit.

### continue

Skip to the next iteration of the nearest enclosing loop (`while`, `until`, `retry`, `foreach`). Any remaining statements in the current iteration are skipped.

```
continue
```

Example — skip already-passing files:

```
foreach file in ${files}
  run: npx tsc --noEmit ${file}
  if command_succeeded
    continue
  end
  prompt: Fix the type errors in ${file}.
end
```

`continue` outside a loop is a lint warning. It has no effect when there is no enclosing loop.

### spawn

Launch a named sub-task as a separate Claude process. The body runs in an independent child process with its own isolated state. The parent flow advances immediately without waiting for the child to finish.

```
spawn "fix-auth"
  prompt: Fix the authentication bug
  run: npm test -- auth
end

spawn "add-cache"
  prompt: Add caching to the API layer
end
```

**Cross-directory spawn** — use `in "path"` to launch the child in a different directory:

```
spawn "backend" in "packages/api"
  run: npm test
end
```

Parameters:

- name: A quoted string identifying the child. Must be unique within the flow.
- in: (Optional) A quoted path. The child process runs in that directory.
- body: One or more DSL statements. These run in the child process, not the parent.

**Execution model:** Each `spawn` launches a separate `claude -p` process. This is process-level parallelism, not thread-level concurrency. Each child gets:

- Its own state directory: `.prompt-language-{name}/`
- Its own session state file: `.prompt-language-{name}/session-state.json`
- A copy of all parent variables at spawn time as `let` declarations

The parent does not enter the spawn body. It records the child's PID and state directory, then immediately advances past the `spawn` block.

**Variable scoping:**

- **Parent to child (at spawn time):** All parent variables are copied into the child as `let` literals. The child receives a snapshot — subsequent parent changes are not visible to the child.
- **Child to parent (at await time):** After `await`, child variables are imported with a `{child-name}.` prefix. For example, the child's `last_exit_code` becomes `${fix-auth.last_exit_code}`.
- **No sibling visibility:** Two spawned children cannot see each other's variables.

### await

Block the parent flow until one or more spawned children complete.

```
await all           # wait for every spawned child
await "fix-auth"    # wait for a specific child by name
```

Parameters:

- target: Either `all` (wait for every spawned child) or a quoted child name.

After await completes, child variables are imported with a name prefix: `${child-name.varName}`. All child variables are imported — including built-in auto-variables (`{name}.last_exit_code`, `{name}.command_failed`, etc.).

**Error semantics:** A failed child does NOT throw or trigger try/catch in the parent. The parent receives the child's final variables (including `command_failed: true`). To detect child failure, check the imported variables after await.

**Limitations:**

- No nested spawn support. Children run as `claude -p` without the plugin's process spawner.
- Name collisions: spawning two children with the same name overwrites the first entry.
- No cancellation mechanism for running children.
- Child state directories (`.prompt-language-{name}/`) are not automatically cleaned up.

### ask conditions (AI-evaluated)

Use the `ask` prefix on `while`, `until`, or `if` conditions to let Claude evaluate whether a condition is true or false. This is useful when the loop or branch exit depends on subjective judgment rather than a deterministic variable or command exit code.

```
while ask "does the code still have performance issues?" max 5
  prompt: Optimize the hottest code path.
  run: node bench.js
end
```

```
until ask "is the refactoring complete?" max 3
  prompt: Continue refactoring the module.
end
```

```
if ask "is this a security vulnerability?"
  prompt: Fix the vulnerability.
else
  prompt: No security issue found. Continue.
end
```

Use `max-retries N` to retry an ambiguous verdict with fresh grounding evidence before pausing:

```
if ask "is this safe to deploy?" grounded-by "npm test" max-retries 2
  prompt: Roll out the change.
end
```

**How it works:** The plugin emits a meta-prompt asking Claude to evaluate the question and answer "true" or "false". The verdict is captured via the standard capture-file mechanism (same as `let x = prompt`). This takes two turns: one to ask, one to read the verdict.

- For `while ask`: the body is entered when the verdict is `true` (same as regular `while`).
- For `until ask`: the body is entered when the verdict is `false` (same as regular `until`).
- For `if ask`: the then-branch is taken when the verdict is `true`.

**grounded-by:** Optionally provide a shell command whose stdout is included as evidence for the AI evaluation. This grounds the judgment in concrete output rather than relying solely on conversation context.

```
while ask "are there still failing tests?" grounded-by "npm test" max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

The grounding command's stdout (up to 1000 chars) is included in the judge prompt so Claude can base its answer on real output.

**Parameters:**

- `ask "question"`: The question for Claude to evaluate. Required.
- `grounded-by "command"`: (Optional) Shell command whose stdout provides evidence.
- `max-retries N`: Optional retry budget for ambiguous or missing verdicts.
- `max N`: Maximum iterations (for while/until). Ask conditions count toward `maxIterations` the same way regular conditions do.

**Note:** If the verdict capture fails (e.g., Claude doesn't write the capture file), the plugin retries the judge prompt. Ask conditions are slower than variable-based conditions because they require an extra turn for verdict capture.

## Completion gates

Gates are assertions that must hold before the flow is considered complete. The agent cannot stop until all gates pass. They are listed in the `done when:` section.

```
done when:
  tests_pass
  lint_pass
  tests_pass == true
```

Gates are evaluated after all nodes finish and again on Stop/TaskCompleted hooks. If any gate fails, the agent is forced back into the flow.

**Custom gates** — for commands not covered by built-in predicates, define your own in the `done when:` section:

```
done when:
  tests_pass
  gate build_passes: npm run build
  gate types_ok: npx tsc --noEmit
```

**Gate composition** — `any(gate1, gate2)` passes when at least one of the listed predicates passes:

```
done when:
  any(tests_pass, pytest_pass)
```

Useful when a project may run either Node or Python tests depending on context.

## Context management patterns

Variables carry exact values across workflow steps. Every `prompt:` step sees all current variables re-injected via `renderFlow()`, making each step self-contained. At tested distances (2-15 steps), vanilla Claude recalls values equally well; variables primarily improve readability and explicit context control.

### Baseline comparison

Capture metrics before and after a change:

```
let baseline = run "node bench.js"
prompt: Identify the top 3 performance bottlenecks.
prompt: Refactor the first bottleneck.
prompt: Refactor the second bottleneck.
prompt: Refactor the third bottleneck.
let current = run "node bench.js"
prompt: Compare baseline (${baseline}) vs current (${current}). Write improvement summary.
```

### Multi-source aggregation

Capture values from multiple commands and combine them at the end:

```
let v1 = run "node gen1.js"
let v2 = run "node gen2.js"
let v3 = run "node gen3.js"
prompt: Write summary.json combining: ${v1}, ${v2}, ${v3}
```

### Error forensics

Capture errors as they occur, fix them, then cite exact error messages in documentation:

```
let e1 = run "node diagnose-auth.js"
prompt: Fix the auth service error.
let e2 = run "node diagnose-cache.js"
prompt: Fix the cache service error.
prompt: Write postmortem.md citing exact errors. Auth: ${e1}. Cache: ${e2}.
```

### Selective context injection

Different steps see different context. Each `prompt:` interpolates only the variables you reference:

```
let security_rules = prompt "Only use parameterized queries. Never string-concat SQL."
prompt: Refactor auth.js following: ${security_rules}
let review_criteria = prompt "Check null handling, error paths, input validation."
prompt: Review the refactored code against: ${review_criteria}
```

The security refactoring step doesn't see the review criteria (which could distract it into reviewing). The review step doesn't see the security rules (which could bias it to only check SQL). Each step gets exactly the context it needs.

## Composition

Primitives nest freely. A while loop can contain if statements, retries, and other loops.

```
Goal: fix tests and lint

flow:
  until tests_pass max 5
    run: npm test
    if tests_fail
      prompt: Fix the test failures.
      retry max 2
        run: npm test
      end
    end
  end

done when:
  tests_pass
  lint_pass
```

## Built-in resolvers

### Runtime variables

These variables are updated automatically after each `run` step and after `let x = run`:

| Variable            | Type    | Source        | Description                                 |
| ------------------- | ------- | ------------- | ------------------------------------------- |
| `last_exit_code`    | number  | deterministic | Exit code of the last command               |
| `command_failed`    | boolean | deterministic | True if last exit code != 0                 |
| `command_succeeded` | boolean | deterministic | True if last exit code == 0                 |
| `last_stdout`       | string  | deterministic | stdout of the last command (max 2000 chars) |
| `last_stderr`       | string  | deterministic | stderr of the last command (max 2000 chars) |

### Gate predicates

These are evaluated on demand when used as flow conditions (`while`, `until`, `if`) or completion gates (`done when:`). Each predicate maps to a shell command via `resolveBuiltinCommand()`:

| Predicate            | Source | Runs               | Passes when                  |
| -------------------- | ------ | ------------------ | ---------------------------- |
| `tests_pass`         | parsed | `npm test`         | exit 0                       |
| `tests_fail`         | parsed | `npm test`         | exit != 0                    |
| `lint_pass`          | parsed | `npm run lint`     | exit 0                       |
| `lint_fail`          | parsed | `npm run lint`     | exit != 0                    |
| `pytest_pass`        | parsed | `pytest`           | exit 0                       |
| `pytest_fail`        | parsed | `pytest`           | exit != 0                    |
| `go_test_pass`       | parsed | `go test ./...`    | exit 0                       |
| `go_test_fail`       | parsed | `go test ./...`    | exit != 0                    |
| `cargo_test_pass`    | parsed | `cargo test`       | exit 0                       |
| `cargo_test_fail`    | parsed | `cargo test`       | exit != 0                    |
| `file_exists <path>` | parsed | `test -f '<path>'` | file exists                  |
| `diff_nonempty`      | parsed | `git diff --quiet` | exit != 0 (diff has changes) |

### Resolver priority

When a condition or gate predicate is evaluated, the runtime resolves it in this order:

1. **Deterministic** — Direct variable lookup. If a variable with that name exists in session state (e.g., `command_failed` was set after a `run:` node), use its value immediately.
2. **Parsed** — Built-in command resolution via `resolveBuiltinCommand()`. Predicates like `tests_pass` map to `npm test`, `lint_pass` maps to `npm run lint`, etc. The command is executed and the exit code determines the boolean result.

**For flow conditions** (`while`, `until`, `if`): a runtime variable always takes precedence over running a command. For example, if `command_failed` was set after a `run:` node, an `if command_failed` condition uses the variable directly without executing anything.

**For completion gates** (`done when:`): the predicate is always resolved by running the actual command, regardless of any existing variable with the same name. This ensures independent verification — the agent cannot satisfy a gate merely by setting a variable.

## Defaults

| Setting                     | Default |
| --------------------------- | ------- |
| maxIterations (while/until) | 5       |
| maxAttempts (retry)         | 3       |

These can be overridden per-node using the `max` parameter.

## Natural language

You do not need to write DSL directly. The parser detects control-flow intent in plain English:

| Input                | Typical result  |
| -------------------- | --------------- |
| "keep going until X" | `until X max 5` |
| "don't stop until X" | `until X max 5` |
| "loop until X"       | `until X max 5` |
| "retry 3 times"      | `retry max 3`   |

Natural language is translated by the agent, not by a deterministic compiler. The plugin detects control-flow intent via keyword matching and provides the DSL reference as context for accurate translation. This detection is best-effort: ambiguous phrasing, unusual sentence structures, or edge-case inputs may produce incorrect or no DSL. When precision matters — especially for gates, loop bounds, or variable names — write explicit DSL instead of relying on natural language translation.

## Comments

Lines containing `#` have everything after `#` stripped before parsing.
