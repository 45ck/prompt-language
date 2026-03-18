# DSL Reference

The prompt-language DSL defines control-flow programs using six primitives plus try/catch. Programs are composed by nesting these primitives. Blocks use indentation with explicit `end` keywords.

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

The loop evaluates the condition before each iteration. If the condition is false, the loop exits. If max iterations are reached, the flow fails.

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

The loop evaluates the condition after each iteration. If the condition is true, the loop exits. If max iterations are reached, the flow fails.

### retry

Retry a block up to N times. The block is re-executed if the last command in it fails.

```
retry max 3
  run: npm run build
end
```

Parameters:

- max: Maximum number of attempts (default: 3).
- body: One or more DSL statements (indented).

The block runs once. If the last command fails, it retries up to the attempt limit. If all attempts fail, the flow fails.

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

### try/catch

Execute a block. If the catch condition triggers, run the catch block.

```
try
  run: npm run deploy
catch command_failed
  prompt: Deploy failed. Investigate the error and retry manually.
end
```

Parameters:

- body: One or more DSL statements.
- catchCondition: A resolver variable name. If true after body execution, the catch block runs. Defaults to `command_failed`.
- catchBody: One or more DSL statements.

## Completion gates

Gates are assertions that must hold before the flow is considered complete. The agent cannot stop until all gates pass. They are listed in the `done when:` section.

```
done when:
  tests_pass
  lint_pass
  tests_pass == true
```

Gates are evaluated after all nodes finish and again on Stop/TaskCompleted hooks. If any gate fails, the agent is forced back into the flow.

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

These variables are updated automatically after each `run` step:

| Variable            | Type    | Source        | Description                    |
| ------------------- | ------- | ------------- | ------------------------------ |
| `last_exit_code`    | number  | deterministic | Exit code of the last command  |
| `command_failed`    | boolean | deterministic | True if last exit code != 0    |
| `command_succeeded` | boolean | deterministic | True if last exit code == 0    |
| `tests_pass`        | boolean | deterministic | True if test command succeeded |
| `tests_fail`        | boolean | deterministic | True if test command failed    |
| `lint_pass`         | boolean | deterministic | True if lint command succeeded |
| `lint_fail`         | boolean | deterministic | True if lint command failed    |
| `file_exists`       | boolean | deterministic | True if a checked file exists  |
| `diff_nonempty`     | boolean | deterministic | True if git diff has output    |

Resolver priority order: deterministic > parsed > inferred > human.

## Defaults

| Setting                     | Default |
| --------------------------- | ------- |
| maxIterations (while/until) | 5       |
| maxAttempts (retry)         | 3       |

These can be overridden per-node using the `max` parameter.

## Natural language

You do not need to write DSL directly. The parser detects control-flow intent in plain English:

| Input                | Compiled to     |
| -------------------- | --------------- |
| "keep going until X" | `until X max 5` |
| "don't stop until X" | `until X max 5` |
| "loop until X"       | `until X max 5` |
| "retry 3 times"      | `retry max 3`   |

## Comments

Lines containing `#` have everything after `#` stripped before parsing.
