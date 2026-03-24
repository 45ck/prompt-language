# Example: Variable Pipeline

Use `let x = run "..."` with shell pipes to transform, filter, and extract data between flow steps. The `run` node is the escape hatch to the full Unix toolkit.

## Natural language

```
Run the tests, capture the output, extract the failing test names, count them, and fix the first one. Repeat until all pass.
```

## DSL equivalent

```
Goal: fix tests one at a time using extracted failure info

flow:
  retry max 5
    let output = run "npm test 2>&1 || true"
    let fail_count = run "echo '${output}' | grep -c 'FAIL' || echo 0"
    let first_fail = run "echo '${output}' | grep 'FAIL' | head -1"
    if ${fail_count} > 0
      prompt: There are ${fail_count} failing tests. Fix this one first: ${first_fail}
    end
  end

done when:
  tests_pass
```

## What happens

1. `let output = run "npm test 2>&1 || true"` captures the full test output including stderr. The `|| true` prevents the `run` node from setting `command_failed` on test failure (we want the output, not the exit code).
2. `let fail_count = run "... | grep -c 'FAIL'"` pipes the output through `grep -c` to count failures.
3. `let first_fail = run "... | grep 'FAIL' | head -1"` extracts just the first failing test name.
4. The `if` block uses numeric comparison to check if there are failures.
5. The prompt gives the agent targeted information — which test to fix and how many remain.

## Common transforms

### Extract a JSON field

```
let config = run "cat package.json"
let name = run "cat package.json | jq -r '.name'"
let version = run "cat package.json | jq -r '.version'"
prompt: Update ${name} from version ${version} to the next minor version.
```

### Count lines

```
let todo_count = run "grep -rc 'TODO' src/ || echo 0"
prompt: There are ${todo_count} TODOs in the codebase. Fix the most critical ones.
```

### Filter and transform

```
let files = run "git diff --name-only HEAD~1"
let ts_files = run "git diff --name-only HEAD~1 | grep '\.ts$' || true"
prompt: Review the TypeScript files changed in the last commit: ${ts_files}
```

### First/last line

```
let log = run "git log --oneline -10"
let latest = run "git log --oneline -1"
let oldest = run "git log --oneline -10 | tail -1"
```

### String manipulation

```
let upper = run "echo '${name}' | tr '[:lower:]' '[:upper:]'"
let trimmed = run "echo '${raw}' | xargs"
let replaced = run "echo '${text}' | sed 's/old/new/g'"
```

## Why shell pipes are enough

The proposed E10 enhancement (variable transforms with `${var | filter}` syntax) would add filters like `first_line`, `line_count`, `trim`, and `json_get`. These are all one-liners with standard Unix tools:

| Proposed filter | Shell equivalent             |
| --------------- | ---------------------------- |
| `first_line`    | `head -1`                    |
| `last_line`     | `tail -1`                    |
| `line_count`    | `wc -l`                      |
| `trim`          | `xargs`                      |
| `json_get .key` | `jq -r '.key'`               |
| `lowercase`     | `tr '[:upper:]' '[:lower:]'` |
| `uppercase`     | `tr '[:lower:]' '[:upper:]'` |

Shell pipes are more powerful than any built-in filter set and universally available. The `let x = run` pattern is the right level of abstraction.
