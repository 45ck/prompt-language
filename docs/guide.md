# How prompt-language works

This guide explains the mechanics behind the prompt-language plugin — what Claude actually sees on each turn, how variables persist, why gates can't be fooled, and how to write effective flows. For installation, see the [README](https://github.com/45ck/prompt-language/blob/main/README.md). For syntax details, see the [DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md).

## The closed loop

Three Claude Code hooks form an enforcement loop:

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

## Prompt capture

`let x = prompt "..."` is the only node type that requires two turns to complete:

- **Phase 1**: The plugin emits a meta-prompt telling Claude to answer the question AND write its response to `.prompt-language/vars/{varName}`. Claude answers naturally while also writing the file.
- **Phase 2**: On the next turn, the plugin reads the file, stores the value in `state.variables`, and advances past the node.

During phase 1, the rendered flow shows `[awaiting response...]` on the let node. If the file isn't found on phase 2, the plugin retries up to 3 times, then fails open with an empty string (the flow continues rather than getting stuck).

This mechanism lets flows capture Claude's reasoning as a variable for use in later steps — for example, storing an analysis result to interpolate into a follow-up prompt.

## How gates prevent lying

There is a critical design difference between flow conditions and completion gates:

|             | Flow conditions (`if`/`while`/`until`) | Completion gates (`done when:`) |
| ----------- | -------------------------------------- | ------------------------------- |
| Resolution  | Variable lookup first, then command    | Always runs the command         |
| Trust model | Fast path — uses latest result         | Verify independently            |
| Purpose     | Control iteration flow                 | Enforce exit criteria           |

Flow conditions check `state.variables` first. If `command_failed` is already set from the last `run:` node, an `if command_failed` doesn't re-run anything — it just reads the variable.

Gates always execute the real command. Even if `tests_pass` exists as a variable set to `"true"`, the `done when: tests_pass` gate runs `npm test` itself. This is why gates catch gaslighting: the agent can set variables however it wants, but the gate independently verifies by running the actual command.

Built-in gate predicates and their commands:

| Predicate            | Command            | Passes when                      |
| -------------------- | ------------------ | -------------------------------- |
| `tests_pass`         | `npm test`         | Exit code 0                      |
| `tests_fail`         | `npm test`         | Exit code non-zero               |
| `lint_pass`          | `npm run lint`     | Exit code 0                      |
| `lint_fail`          | `npm run lint`     | Exit code non-zero               |
| `diff_nonempty`      | `git diff --quiet` | Exit code non-zero (diff exists) |
| `file_exists <path>` | `test -f '<path>'` | Exit code 0                      |

## Writing effective flows

1. **Start with gates, not flows** — Just adding `done when: tests_pass` to any prompt prevents premature stopping. You don't need a full flow to get value from the plugin.

2. **Pair loops with gates** — A `retry max 5` structures execution, but only a gate enforces that the final result actually passes. Use both together.

3. **Variables shine at distance** — At 2-5 steps, Claude remembers everything from conversation context. Use variables when flows span 10+ steps, or when you need exact values (exit codes, version strings) that can't afford approximation.

4. **Prefer `retry` for fix-test cycles** — `retry` auto-enters its body and re-loops on `command_failed`. `while`/`until` require getting the condition direction right. For the common pattern of "run tests, fix failures, repeat," `retry` is simpler.

5. **Capture baselines early** — `let baseline = run "node bench.js"` stores the exact output as a variable, immune to context compression. Useful for before/after comparisons in optimization tasks.

For worked examples, see [Fix Tests](https://github.com/45ck/prompt-language/blob/main/docs/examples/fix-tests.md) and [Lint and Fix](https://github.com/45ck/prompt-language/blob/main/docs/examples/lint-and-fix.md).

## When it wins and when it doesn't

**Wins:**

- **Untrustworthy or incomplete prompts** — Gates enforce what the prompt doesn't say. If you ask Claude to "fix the tests" but it only fixes one of three, `done when: tests_pass` catches the gap.
- **Verification-heavy tasks** — The agent can claim success, but the gate runs the real command. No amount of conversational confidence bypasses `npm test` returning exit code 1.
- **Long autonomous runs** — Variable re-injection keeps values precise regardless of conversation length. Loop counters, captured outputs, and exit codes are always exact.

**Loses:**

- **Simple, well-specified tasks** — When the prompt is clear and complete, vanilla Claude matches correctness at 2-3x less latency.
- **No verifiable exit condition** — If there's no command that can check whether the task is done, there's no gate to add, and the plugin adds overhead without enforcement value.

In controlled evaluation (45 hypotheses, 300+ test runs), the plugin won 15, tied 28, and 2 were both-fail (neither side succeeded). Wins cluster around gate enforcement; ties cluster around tasks where the prompt is already explicit. See [Eval Analysis](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md) for the full breakdown.

## Debugging

When a flow isn't behaving as expected:

1. **Check state** — Read `.prompt-language/session-state.json` to see the raw state: current path, variables, gate results, node progress.
2. **Check rendered view** — Use the `/flow:status` slash command to see exactly what Claude sees on each turn.
3. **Reset** — Use `/flow:reset` to clear all state and start over. Useful when a flow gets stuck in an unexpected state.
4. **Check capture files** — For `let x = prompt` issues, look in `.prompt-language/vars/` to see if Claude wrote the file and what it contains.

## Further reading

- [DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md) — Full syntax, defaults, composition rules, built-in variables, and gate predicates
- [Hooks Architecture](https://github.com/45ck/prompt-language/blob/main/docs/hooks-architecture.md) — Implementation details of the three-hook enforcement loop
- [Eval Analysis](https://github.com/45ck/prompt-language/blob/main/docs/eval-analysis.md) — 45-hypothesis comparative evaluation against vanilla Claude
- [Examples](https://github.com/45ck/prompt-language/blob/main/docs/examples/) — Worked flow examples for common patterns
