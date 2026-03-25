# DSL Cheatsheet

Quick reference for all prompt-language primitives, variables, and gates.

## Program Structure

```
Goal: <description>

flow:
  <statements>

done when:
  <predicates>
```

Lines starting with `#` are comments (stripped before parsing).

## Primitives

| Primitive        | Syntax                       | Notes                             |
| ---------------- | ---------------------------- | --------------------------------- |
| prompt           | `prompt: Do X`               | Injects text as agent instruction |
| run              | `run: npm test`              | Executes shell command            |
| run (timeout)    | `run: npm test [timeout 60]` | Kills after N seconds             |
| let/var          | `let x = "literal"`          | Stores string variable            |
| let (run)        | `let x = run "cmd"`          | Stores command stdout             |
| let (prompt)     | `let x = prompt "text"`      | Captures agent response           |
| let (list)       | `let x = []`                 | Initializes empty list            |
| let (append)     | `let x += "val"`             | Appends to list                   |
| let (append run) | `let x += run "cmd"`         | Appends stdout to list            |
| break            | `break`                      | Exits nearest loop                |
| continue         | `continue`                   | Skips to next loop iteration      |
| spawn            | `spawn "name"` ... `end`     | Launches child process            |
| spawn (dir)      | `spawn "name" in "path"`     | Child runs in given directory     |
| await            | `await "name"` / `await all` | Blocks until child(ren) complete  |

## Control Flow

### while / until

```
while tests_fail max 5          until tests_pass max 5
  prompt: Fix tests.              prompt: Fix tests.
  run: npm test                   run: npm test
end                             end
```

Default `max`: 5. `while` loops while true; `until` loops while false.

### retry

```
retry max 3
  run: npm run build
end
```

Default `max`: 3 (1 initial + 2 retries). Re-enters body on `command_failed`.

### if / else if / else

```
if command_failed
  prompt: Fix the error.
else if lint_fail
  prompt: Fix lint.
else
  prompt: All good.
end
```

`elif` is an alias for `else if`.

### try / catch / finally

```
try
  run: npm run deploy
catch command_failed
  prompt: Deploy failed.
finally
  run: cleanup.sh
end
```

`catch` defaults to `command_failed`. `finally` always executes.

### foreach

```
foreach file in ${files}
  run: npx tsc --noEmit ${file}
end
```

Default `max`: 50. List splitting priority: JSON array > newline > whitespace.

Auto-set: `${file}`, `${file_index}` (0-based), `${file_length}`.

### ask conditions (AI-evaluated)

```
while ask "still have issues?" max 5     if ask "is this a bug?"
  prompt: Fix the issue.                    prompt: Fix it.
end                                       end
```

Optional grounding: `while ask "failing?" grounded-by "npm test" max 5`

## Variables

### Interpolation

| Syntax            | Meaning                           |
| ----------------- | --------------------------------- |
| `${var}`          | Substitute variable value         |
| `${var:-default}` | Use default if var is unset       |
| `${var_index}`    | Current foreach index (0-based)   |
| `${var_length}`   | List length / foreach total items |

Unknown `${var}` references are left as-is.

### Built-in Variables (auto-set after every `run`)

| Variable            | Type    | Description                |
| ------------------- | ------- | -------------------------- |
| `last_exit_code`    | number  | Exit code of last command  |
| `command_failed`    | boolean | `true` when exit code != 0 |
| `command_succeeded` | boolean | `true` when exit code == 0 |
| `last_stdout`       | string  | stdout (max 2000 chars)    |
| `last_stderr`       | string  | stderr (max 2000 chars)    |

### Arithmetic

```
let count = ${count} + 1
```

Supports `+`, `-`, `*`, `/` on integers in let expressions.

## Conditions

Used in `while`, `until`, `if`. Resolved by variable lookup first, then built-in command.

| Feature       | Example                          |
| ------------- | -------------------------------- |
| Variable      | `if command_failed`              |
| Negation      | `while not tests_pass max 5`     |
| Comparison    | `if ${count} > 0`                |
| Operators     | `==`, `!=`, `>`, `<`, `>=`, `<=` |
| And/Or        | `if ${a} > 0 and ${b} > 0`       |
| Quoted string | `if ${status} == "ready"`        |

## Completion Gates

```
done when:
  tests_pass
  lint_pass
  file_exists src/index.ts
  gate build_ok: npm run build
  any(tests_pass, pytest_pass)
```

Gates always run the actual command (never resolved from variables).

### Built-in Gate Predicates

| Predicate            | Command            | Passes when |
| -------------------- | ------------------ | ----------- |
| `tests_pass`         | `npm test`         | exit 0      |
| `tests_fail`         | `npm test`         | exit != 0   |
| `lint_pass`          | `npm run lint`     | exit 0      |
| `lint_fail`          | `npm run lint`     | exit != 0   |
| `pytest_pass`        | `pytest`           | exit 0      |
| `pytest_fail`        | `pytest`           | exit != 0   |
| `go_test_pass`       | `go test ./...`    | exit 0      |
| `go_test_fail`       | `go test ./...`    | exit != 0   |
| `cargo_test_pass`    | `cargo test`       | exit 0      |
| `cargo_test_fail`    | `cargo test`       | exit != 0   |
| `file_exists <path>` | `test -f '<path>'` | file exists |
| `diff_nonempty`      | `git diff --quiet` | has changes |

## Spawn / Await

```
spawn "worker"
  prompt: Do the work.
  run: npm test
end
await "worker"
prompt: Worker result was ${worker.last_exit_code}.
```

- Parent advances immediately past `spawn` block.
- Child gets snapshot of parent variables at spawn time.
- After `await`, child vars imported as `${childName.varName}`.
- `await all` waits for every spawned child.

## Defaults

| Setting             | Default |
| ------------------- | ------- |
| `max` (while/until) | 5       |
| `max` (retry)       | 3       |
| `max` (foreach)     | 50      |
