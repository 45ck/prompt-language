# prompt-libraries

Library files export reusable flow blocks, prompts, and gates that can be composed into any flow via `use`.

## Library file structure

```yaml
library: testing

export flow fix_and_test(test_cmd="npm test"):
  retry max 3
    run: ${test_cmd}
    if command_failed
      prompt: Fix the test failures shown in ${last_stderr}
    end
  end

export prompt review_prompt(lang="TypeScript"):
  You are a ${lang} expert. Review the code for correctness, security, and style.

export gates all_tests_pass(test_cmd="npm test"):
  tests_pass
  gate check: ${test_cmd}
```

## Using a library

```yaml
import "libraries/testing.flow" as testing

flow:
  use testing.fix_and_test(test_cmd="jest --coverage")
  use testing.review_prompt(lang="JavaScript")
end

done when:
  use testing.all_tests_pass(test_cmd="jest")
```

## Export kinds

| Kind     | Expands as                              |
| -------- | --------------------------------------- |
| `flow`   | Inline flow nodes at the point of `use` |
| `prompt` | A single `prompt:` node                 |
| `gates`  | Completion gate entries in `done when:` |

## Parameters

- Declared in parentheses after the export name: `export flow name(param="default")`.
- Parameters with defaults are optional at call sites.
- `use` arguments can be positional or named: `use ns.sym(val, key=val2)`.

## Semantics

- `library: name` at the top of a file declares it as a library. Files without this declaration cannot be named-imported.
- Parameters are substituted before the nodes are inserted; unknown parameters retain their `${name}` form.
- A library file can itself import other libraries.

## Related

- [import](import.md)
