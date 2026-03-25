# How prompt-language works (internals)

This guide explains the mechanics behind the prompt-language plugin — what Claude actually sees on each turn, how variables persist, why gates can't be fooled, and how to write effective flows. For installation, see the [README](https://github.com/45ck/prompt-language/blob/main/README.md). For syntax details, see the [DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md).

## The closed loop

**Hooks** are entry points where the plugin intercepts Claude Code's lifecycle. Think of them as checkpoints: the plugin can inspect the current state, inject context into Claude's prompt, or block an action entirely. prompt-language uses three hooks to form an enforcement loop:

- **UserPromptSubmit** — Parses DSL from the prompt, creates session state, injects the first step into Claude's context.
- **Stop** — Intercepts when Claude tries to stop. If steps remain or gates haven't passed, it blocks the stop and injects the next step.
- **TaskCompleted** — Runs gate commands before allowing completion. If any gate fails, the task stays open.

```
  UserPromptSubmit          Stop                TaskCompleted
  ┌──────────────┐    ┌─────────────┐     ┌──────────────────┐
  │ Parse DSL    │    │ Steps left? │     │ Run gate cmds    │
  │ Create state │    │ Block stop  │     │ All pass? → Done │
  │ Inject step  │    │ Inject next │     │ Any fail? → Back │
  └──────────────┘    └─────────────┘     └──────────────────┘
```

Hooks are stateless processes — they read and write `.prompt-language/session-state.json` but hold no in-memory state between invocations. For implementation details, see [Hooks Architecture](https://github.com/45ck/prompt-language/blob/main/docs/hooks-architecture.md).

## What Claude sees each turn

On every hook invocation, `renderFlow()` produces a full-state snapshot that gets prepended to Claude's prompt. This is the central mechanism: Claude doesn't rely on conversation history to know where it is in the flow. It gets a deterministic re-injection from `session-state.json` every single turn.

Here's a concrete example. Midway through a retry loop fixing auth tests, Claude sees this at the top of its context:

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
  last_stdout = FAIL src/auth.test.ts ...
```

Every annotation has a specific meaning:

| Annotation               | Meaning                                           |
| ------------------------ | ------------------------------------------------- |
| `>` prefix               | Node is on the active execution path              |
| `<-- current`            | This is the step Claude should execute now        |
| `[2/5]`                  | Loop progress — iteration 2 of 5                  |
| `[fail]`                 | Gate status — this predicate has not passed yet   |
| `[= value]`              | Resolved variable value (shown on `let` nodes)    |
| `[awaiting response...]` | A `let x = prompt` is waiting for Claude's answer |
| Variables section        | All stored variables and their current values     |

This snapshot is rebuilt from `session-state.json` on every turn, not from conversation history. Even if earlier messages are compressed away, the flow state is always accurate.

## Variable lifecycle

Variables are stored in `state.variables` inside `session-state.json`. They persist for the entire flow session — not per-turn, not per-scope. The namespace is flat: a variable set inside a loop is visible everywhere.

Three capture modes:

| Mode    | Syntax                      | Behavior                             |
| ------- | --------------------------- | ------------------------------------ |
| Literal | `let x = "hello"`           | Stores the string immediately        |
| Run     | `let x = run "node -v"`     | Executes the command, stores stdout  |
| Prompt  | `let x = prompt "question"` | Two-phase capture (see next section) |

Variables are interpolated via `${varName}` in prompt and run text. Unknown variables are left as-is — no error, no empty string, just `${unknownVar}` verbatim.

For `run:` nodes, `shellInterpolate()` wraps substituted values in single-quotes to prevent shell injection. You don't need to quote variables yourself in run commands.

**Built-in variables** are automatically set after every `run:` node and `let x = run` execution:

- `last_exit_code` — numeric exit code
- `command_succeeded` / `command_failed` — boolean
- `last_stdout` / `last_stderr` — output (truncated at 2000 chars)

> **Gotchas**
>
> 1. **Flat scoping** — A variable set inside a loop body is visible after the loop ends. There is no block scoping.
> 2. **Auto-variables are overwritten** after every `run:` — if you need a value later, save it: `let saved = "${last_exit_code}"`.
> 3. **Unknown `${vars}` pass through silently** — typos in variable names won't produce errors. Double-check your names.
> 4. **Spawn isolation** — Variables in `spawn` children are isolated. At spawn time, parent variables are copied as `let` literals (a snapshot). After `await`, child variables are imported with a `{spawn-name}.` prefix (e.g., `${fix-auth.last_exit_code}`). The import includes all child variables, not just user-defined ones.

## Prompt capture

`let x = prompt "..."` is the only node type that requires two turns to complete:

- **Phase 1**: The plugin emits a meta-prompt telling Claude to answer the question AND write its response to `.prompt-language/vars/{varName}`. Claude answers naturally while also writing the file.
- **Phase 2**: On the next turn, the plugin reads the file, stores the value in `state.variables`, and advances past the node.

During phase 1, the rendered flow shows `[awaiting response...]` on the let node.

This mechanism lets flows capture Claude's reasoning as a variable for use in later steps — for example, storing an analysis result to interpolate into a follow-up prompt.

> **Warning: fail-open behavior.** If Claude doesn't write the capture file, the plugin retries up to 3 times, then sets the variable to `""` (empty string) and continues. If `${x}` is later interpolated into a `run:` command, the command will receive an empty argument. Use `${x:-fallback}` default values or add an `if` check before using captured values in critical commands.

## How gates prevent lying

There is a critical design difference between flow conditions and completion gates:

|             | Flow conditions (`if`/`while`/`until`) | Completion gates (`done when:`) |
| ----------- | -------------------------------------- | ------------------------------- |
| Resolution  | Variable lookup first, then command    | Always runs the command         |
| Trust model | Fast path — uses latest result         | Verify independently            |
| Purpose     | Control iteration flow                 | Enforce exit criteria           |

Flow conditions check `state.variables` first. If `command_failed` is already set from the last `run:` node, an `if command_failed` doesn't re-run anything — it just reads the variable.

Gates always execute the real command. Even if `tests_pass` exists as a variable set to `"true"`, the `done when: tests_pass` gate runs `npm test` itself. This is why gates are trustworthy: the agent can set variables however it wants, but the gate independently verifies by running the actual command. There is no way to satisfy a gate by setting a variable — it always runs the real check.

Built-in gate predicates and their commands:

| Predicate            | Command            | Passes when                      |
| -------------------- | ------------------ | -------------------------------- |
| `tests_pass`         | `npm test`         | Exit code 0                      |
| `tests_fail`         | `npm test`         | Exit code non-zero               |
| `lint_pass`          | `npm run lint`     | Exit code 0                      |
| `lint_fail`          | `npm run lint`     | Exit code non-zero               |
| `pytest_pass`        | `pytest`           | Exit code 0                      |
| `pytest_fail`        | `pytest`           | Exit code non-zero               |
| `go_test_pass`       | `go test ./...`    | Exit code 0                      |
| `go_test_fail`       | `go test ./...`    | Exit code non-zero               |
| `cargo_test_pass`    | `cargo test`       | Exit code 0                      |
| `cargo_test_fail`    | `cargo test`       | Exit code non-zero               |
| `diff_nonempty`      | `git diff --quiet` | Exit code non-zero (diff exists) |
| `file_exists <path>` | `test -f '<path>'` | Exit code 0                      |

## AI-evaluated conditions (`ask`)

Regular `while`/`until`/`if` conditions use variable lookup or built-in command predicates (`tests_fail`, `command_failed`, etc.). The `ask` keyword adds a third option: let Claude evaluate a subjective question.

### Syntax

```
while ask "does the code still have performance issues?" max 5
  prompt: Optimize the hottest code path.
  run: node bench.js
end
```

```
if ask "is this a security vulnerability?"
  prompt: Fix the vulnerability.
end
```

### When to use

Use `ask` when the loop or branch exit depends on judgment that can't be reduced to a command exit code. Examples:

- "Is the code clean enough?" -- no single command answers this
- "Are there still performance issues?" -- requires interpretation of benchmark output
- "Is the refactoring complete?" -- subjective assessment

For anything with a clear pass/fail command (`tests_pass`, `lint_pass`, `command_failed`), prefer the deterministic condition -- it's faster and more reliable.

### How it works

Ask conditions use the same two-phase capture mechanism as `let x = prompt`:

1. **Phase 1**: The plugin emits a meta-prompt asking Claude to answer "true" or "false". Claude writes its verdict to a capture file.
2. **Phase 2**: On the next turn, the plugin reads the verdict and decides whether to enter the body (for loops) or which branch to take (for `if`).

This means ask conditions add one extra turn of latency compared to variable-based conditions. The verdict is not stored as a user-visible variable -- it's consumed internally by the condition evaluator.

### Grounding with evidence

The `grounded-by` clause runs a shell command and includes its output in the judge prompt. This gives Claude concrete evidence rather than relying solely on conversation context.

```
until ask "are all tests passing?" grounded-by "npm test" max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

The grounding command's stdout (up to 1000 chars) is embedded in the judge prompt. If the grounding command fails or returns empty output, the judgment proceeds without evidence.

### Iteration counting

Ask conditions count toward `maxIterations` the same way regular conditions do. If a `while ask "..." max 3` loop enters its body 3 times, the loop exits on the next evaluation regardless of the verdict.

## Writing effective flows

> **Flows add latency without correctness benefit for well-specified tasks.** In 45 controlled A/B tests, flow control (while, retry, if, try/catch) won 0 times against vanilla Claude. Gates won 15. Add `done when:` to any prompt without a flow first. Only add a flow when you need iterative loop behavior that would require multiple manual follow-up messages.

1. **Start with gates, not flows** — Just adding `done when: tests_pass` to any prompt prevents premature stopping. You don't need a full flow to get value from the plugin.

2. **Pair loops with gates** — A `retry max 5` structures execution, but only a gate enforces that the final result actually passes. Use both together.

3. **Variables shine at distance** — At 2-15 steps, Claude remembers everything from conversation context. Use variables when flows span many steps, or when you need exact values (exit codes, version strings) that can't afford approximation.

4. **Prefer `retry` for fix-test cycles** — `retry` auto-enters its body and re-loops on `command_failed`. `while`/`until` require getting the condition direction right. For the common pattern of "run tests, fix failures, repeat," `retry` is simpler.

5. **Capture baselines early** — `let baseline = run "node bench.js"` stores the exact output as a variable, immune to context compression. Useful for before/after comparisons in optimization tasks.

For worked examples, see [Fix Tests](https://github.com/45ck/prompt-language/blob/main/docs/examples/fix-tests.md), [Lint and Fix](https://github.com/45ck/prompt-language/blob/main/docs/examples/lint-and-fix.md), and the full [Examples](https://github.com/45ck/prompt-language/blob/main/docs/examples/) directory.

## When it wins and when it doesn't

**Wins:**

- **Untrustworthy or incomplete prompts** — Gates enforce what the prompt doesn't say. If you ask Claude to "fix the tests" but it only fixes one of three, `done when: tests_pass` catches the gap.
- **Verification-heavy tasks** — The agent can claim success, but the gate runs the real command. No amount of conversational confidence bypasses `npm test` returning exit code 1.
- **Long autonomous runs** — Variable re-injection keeps values precise regardless of conversation length. Loop counters, captured outputs, and exit codes are always exact.

**Loses:**

- **Simple, well-specified tasks** — When the prompt is clear and complete, vanilla Claude matches correctness at 2-3x less latency.
- **No verifiable exit condition** — If there's no command that can check whether the task is done, there's no gate to add, and the plugin adds overhead without enforcement value.

In controlled evaluation (45 hypotheses, 300+ test runs at `--repeat 3` reliability), the plugin won 15, tied 28, and 2 were both-fail (neither side succeeded). Wins cluster around gate enforcement; ties cluster around tasks where the prompt is already explicit. See [Eval Analysis](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md) for the full breakdown.

## Debugging

When a flow isn't behaving as expected:

1. **Check state** — Read `.prompt-language/session-state.json` to see the raw state: current path, variables, gate results, node progress.
2. **Check rendered view** — Use the `/flow:status` slash command to see exactly what Claude sees on each turn.
3. **Reset** — Use `/flow:reset` to clear all state and start over. Useful when a flow gets stuck in an unexpected state.
4. **Check capture files** — For `let x = prompt` issues, look in `.prompt-language/vars/` to see if Claude wrote the file and what it contains.

### Cancelling a flow

If a flow is stuck in a loop, going in the wrong direction, or you simply want to stop it, you can cancel it mid-execution by saying any of these phrases in a normal message:

- **abort flow**
- **cancel flow**
- **stop flow**
- **reset flow**

These work as natural language -- just include the phrase anywhere in your message (e.g., "this isn't working, abort flow"). The plugin detects the phrase, sets the flow status to `cancelled`, and clears any pending prompts. You will see `[prompt-language] Flow cancelled by user.` as confirmation.

The `/flow:reset` slash command also cancels the active flow and clears all state. The difference:

- **Cancel phrases** -- Cancel the flow and preserve the final state in `session-state.json` (status becomes `cancelled`). Useful when you want to inspect what happened before starting over.
- **`/flow:reset`** -- Deletes all state files entirely, giving you a clean slate. Use this when you want to re-run the same flow from scratch or start a completely different flow.

Cancel phrases only work when a flow is active (status is `active`). If the flow has already completed, failed, or been cancelled, the phrases have no effect.

### State file schema

A minimal example of what `session-state.json` looks like:

```json
{
  "status": "active",
  "flowSpec": { "goal": "fix the auth tests", "...": "..." },
  "currentNodePath": [0, 1],
  "variables": {
    "last_exit_code": "1",
    "command_failed": "true",
    "last_stdout": "FAIL src/auth.test.ts ..."
  },
  "nodeProgress": {
    "retry-0": { "iteration": 2, "maxIterations": 5 }
  },
  "gateResults": {
    "tests_pass": false
  }
}
```

Key fields:

- **status** — `active`, `completed`, `failed`, or `cancelled`. Hooks skip processing when status is not `active`.
- **currentNodePath** — Array of indices into the flow tree. `[0, 1]` means the second child of the first top-level node. This is what "where the flow is" means at a low level.
- **variables** — All stored values, including built-ins (`last_exit_code`, `command_failed`, `last_stdout`, `last_stderr`) and user-defined ones. Values are strings, booleans, or numbers (e.g., `"hello"`, `true`, `1`).
- **nodeProgress** — Iteration counts for loops and retry nodes. Keys are node IDs; values hold the current and max iteration counts.
- **gateResults** — Pass/fail status for each gate predicate as evaluated on the last `TaskCompleted` hook invocation.
- **spawnedChildren** — Record of spawned child processes. Each entry contains `name`, `status` (running/completed/failed), `pid`, `stateDir`, and optionally `variables` (imported after completion).

## Compatibility

The plugin hooks into Claude Code's plugin API, which is not versioned. Breaking changes are possible on Claude Code updates. If gates or flows stop working after a Claude Code update, reinstall the plugin:

```bash
npx @45ck/prompt-language
```

## Further reading

- [DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md) — Full syntax, defaults, composition rules, built-in variables, and gate predicates
- [Troubleshooting](https://github.com/45ck/prompt-language/blob/main/docs/troubleshooting.md) — Debugging stuck flows, known issues, common fixes
- [Hooks Architecture](https://github.com/45ck/prompt-language/blob/main/docs/hooks-architecture.md) — Implementation details of the three-hook enforcement loop
- [Eval Analysis](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md) — 45-hypothesis comparative evaluation against vanilla Claude
- [Examples](https://github.com/45ck/prompt-language/blob/main/docs/examples/) — Worked flow examples for common patterns
