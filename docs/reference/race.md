# race

`race` launches multiple spawn children in parallel. The first child to complete successfully wins.

## Syntax

```yaml
race
  spawn "approach-a"
    prompt: Fix by patching the existing code
    run: npm test
  end
  spawn "approach-b"
    prompt: Fix by rewriting from scratch
    run: npm test
  end
end
```

With timeout:

```yaml
race timeout 120
  spawn "fast"
    prompt: Quick fix
    run: npm test
  end
  spawn "thorough"
    prompt: Comprehensive fix with full test suite
    run: npm test -- --coverage
  end
end
```

## Semantics

- All children launch immediately in parallel.
- The first child to complete sets `race_winner` to its name.
- Winner's variables are accessible with the name prefix: `approach-a.result`.
- Non-winning children are not cancelled; they run to completion.
- `timeout N` is in seconds. If exceeded before any child completes, `race_winner` is set to `""`.

## Auto-set variables

- `race_winner` — name of the winning child, or `""` on timeout

## Related

- [spawn](spawn.md)
- [await](await.md)
