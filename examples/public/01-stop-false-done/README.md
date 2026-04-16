# Stop False Done

> See what happens when Claude says "done" but tests still fail.

## What you'll see

Claude will try to fix a broken calculator. Without the gate, it might declare victory after a plausible-looking edit. With `done when: tests_pass`, the runtime blocks completion until `node test.js` actually exits 0.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)
- Node.js >= 22
- prompt-language: `npx @45ck/prompt-language`

## Run it

```bash
cd examples/public/01-stop-false-done
claude
```

## The flow

```
Goal: Fix app.js so all tests pass

flow:
  retry max 3
    run: node test.js
    if command_failed
      prompt: Fix the bug in app.js so all tests pass.
    end
  end

done when:
  tests_pass
```

## What happens

1. `run: node test.js` executes the test suite -- it fails because `divide(1, 0)` returns `Infinity` instead of throwing.
2. `if command_failed` triggers, and the `prompt` asks Claude to fix the bug.
3. Claude edits `app.js` and the `retry` loops back.
4. When tests pass, the flow completes -- but the `tests_pass` gate runs `node test.js` one more time to confirm.
5. Only when the gate passes does the task actually finish.

## Without the gate

Claude might add a comment like "handled divide by zero" without actually fixing the function, then declare the task complete. The `tests_pass` gate makes that impossible.

## Why it matters

Verification gates are the difference between "Claude thinks it's done" and "the tests prove it's done."

## Next steps

- [All proof examples](../) | [Main README](../../../README.md)
- [Getting started](../../../docs/guides/getting-started.md) | [DSL cheatsheet](../../../docs/reference/dsl-cheatsheet.md)
