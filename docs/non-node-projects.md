# Non-Node Projects

The plugin works with any language. `done when:` gates run any shell command — if it exits 0, it passes. This guide shows concrete patterns for Python, Go, and Rust, plus a generic template for anything else.

## Python

### Simplest pattern

```
Goal: fix the failing tests

done when:
  pytest_pass
```

`pytest_pass` runs `pytest` and passes when it exits 0.

### Custom gates

Add type checking and format verification alongside tests:

```
Goal: fix the auth module

done when:
  pytest_pass
  gate typecheck: mypy src/
  gate format: black --check src/
```

All three must pass before Claude can stop.

### Fail-fast with pytest -x

Use a custom gate when you want pytest to stop on the first failure:

```
done when:
  gate tests: pytest -x
  gate typecheck: mypy src/
```

### Full flow example

Run tests in a retry loop, then verify everything at the gate:

```
Goal: fix all test failures in the auth module

flow:
  retry max 5
    run: pytest tests/test_auth.py -x
    if command_failed
      prompt: Fix the failing test shown above.
    end
  end

done when:
  pytest_pass
  gate typecheck: mypy src/
  gate format: black --check src/
```

## Go

### Simplest pattern

```
Goal: fix the failing tests

done when:
  go_test_pass
```

`go_test_pass` runs `go test ./...` and passes when it exits 0.

### Custom gates

Add vet and static analysis:

```
Goal: fix the failing tests

done when:
  go_test_pass
  gate vet: go vet ./...
  gate staticcheck: staticcheck ./...
```

### Full flow example

```
Goal: fix test failures in the cache package

flow:
  retry max 5
    run: go test ./cache/...
    if command_failed
      prompt: Fix the test failures shown above.
    end
  end

done when:
  go_test_pass
  gate vet: go vet ./...
```

## Rust

### Simplest pattern

```
Goal: fix the failing tests

done when:
  cargo_test_pass
```

`cargo_test_pass` runs `cargo test` and passes when it exits 0.

### Custom gates

Enforce clippy warnings-as-errors and format checking:

```
Goal: fix the failing tests

done when:
  cargo_test_pass
  gate clippy: cargo clippy -- -D warnings
  gate fmt: cargo fmt --check
```

### Full flow example

```
Goal: fix all clippy warnings and test failures

flow:
  run: cargo clippy -- -D warnings
  if command_failed
    prompt: Fix the clippy warnings shown above.
  end
  retry max 5
    run: cargo test
    if command_failed
      prompt: Fix the test failures shown above.
    end
  end

done when:
  cargo_test_pass
  gate clippy: cargo clippy -- -D warnings
  gate fmt: cargo fmt --check
```

## Any language

The `gate name: command` syntax works for any tool that exits 0 on success.

```
done when:
  gate tests: mvn test
```

```
done when:
  gate tests: bundle exec rspec
```

```
done when:
  gate validate: bash scripts/validate.sh
```

```
done when:
  gate tests: make test
  gate lint: make lint
```

The gate name is just a label for display — the command is what matters. Any command that exits 0 passes; any command that exits non-zero fails and sends Claude back to keep working.

## Further reading

- [README](https://github.com/45ck/prompt-language/blob/main/README.md) — overview, install, and all built-in gate predicates
- [Language Reference](https://github.com/45ck/prompt-language/blob/main/docs/reference/index.md) — per-feature docs for variables, control flow, spawn/await, and gates
- [DSL Reference](https://github.com/45ck/prompt-language/blob/main/docs/dsl-reference.md) — full syntax for gates, flow control, and variables
