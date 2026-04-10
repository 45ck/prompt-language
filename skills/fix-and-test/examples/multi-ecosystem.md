# Fix-and-Test Examples by Ecosystem

## JavaScript/TypeScript

```flow
flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Fix the failing implementation code and rerun tests.
    end
  end
done when:
  tests_pass
```

## Python

```flow
flow:
  retry max 5
    run: pytest -q
    if command_failed
      prompt: Fix production code causing pytest failures.
    end
  end
done when:
  pytest_pass
```

## Go

```flow
flow:
  retry max 5
    run: go test ./...
    if command_failed
      prompt: Fix the failing Go implementation and rerun.
    end
  end
done when:
  go_test_pass
```

## Rust

```flow
flow:
  retry max 5
    run: cargo test
    if command_failed
      prompt: Fix Rust implementation failures and rerun tests.
    end
  end
done when:
  cargo_test_pass
```
