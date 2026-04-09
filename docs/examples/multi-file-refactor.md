# Example: Multi-File Refactor

Refactor every changed TypeScript file, running lint per file, then verify the full suite passes.

## Natural language

```
Get the list of changed TypeScript files. For each file, lint it and fix any issues. When all files are done, make sure tests and lint both pass.
```

## DSL equivalent

```
Goal: refactor changed TypeScript files

flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    run: npx eslint ${file} --max-warnings=0
    if lint_fail
      prompt: Fix the lint errors in ${file} shown above.
      run: npx eslint ${file} --max-warnings=0
    end
  end
  run: npm test

done when:
  tests_pass
  lint_pass
```

## What happens

1. `let files = run` captures the list of changed `.ts` files from git as a newline-delimited string.
2. `foreach` splits that string into individual file paths and iterates over them.
3. Per iteration, `run: npx eslint ${file}` checks the current file only — fast, targeted feedback.
4. If lint fails on that file, the agent gets a prompt to fix it, then lint runs again immediately.
5. After all files are processed, `run: npm test` verifies nothing was broken.
6. The compound gate `tests_pass` + `lint_pass` means the agent cannot stop until both checks are independently verified by running the real commands.

## Variation: type-check per file

Add a TypeScript compile check per file before linting:

```
Goal: type-check and lint changed files

flow:
  let files = run "git diff --name-only -- '*.ts'"
  foreach file in ${files}
    run: npx tsc --noEmit --allowJs false ${file}
    if command_failed
      prompt: Fix the type errors in ${file}.
    end
    run: npx eslint ${file} --max-warnings=0
    if lint_fail
      prompt: Fix the lint errors in ${file}.
    end
  end

done when:
  tests_pass
  lint_pass
```

The `command_failed` variable is set after each `run:` node, so the `if` branch reacts to whichever command just ran. See [DSL reference — built-in resolvers](../reference/dsl-reference.md#built-in-resolvers) for variable semantics.
