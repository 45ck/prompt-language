# Parallel Review

> Review every source file in parallel, then aggregate.

## What you'll see

The flow discovers source files, spawns a parallel review agent for each one, waits for all to complete, then verifies the combined result with a test gate.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)
- Node.js >= 22
- prompt-language: `npx @45ck/prompt-language`

## Run it

```bash
cd examples/public/05-parallel-review
claude
```

## The flow

```
Goal: Review and fix all source files in parallel

flow:
  let files = run "ls src/"

  foreach-spawn file in ${files} max 20
    prompt: Review and fix any bugs in src/${file}
  end

  await all

done when:
  tests_pass
```

## What happens

1. `let files = run "ls src/"` captures the list of source files: `auth.js`, `validate.js`, `format.js`.
2. `foreach-spawn` launches a parallel child agent for each file.
3. Each child reviews and fixes its assigned file independently.
4. `await all` blocks until every child completes.
5. The `tests_pass` gate runs the combined test suite to verify all fixes work together.

## Without the gate

Each child might fix its own file in isolation, but the combined result could still fail integration tests. The gate catches this.

## Why it matters

Parallel agents are fast but unsupervised. The `await all` + gate pattern ensures that parallel work is verified as a whole, not just individually.

## Next steps

- [All proof examples](../) | [Main README](../../../README.md)
- [Getting started](../../../docs/guides/getting-started.md) | [DSL cheatsheet](../../../docs/reference/dsl-cheatsheet.md)
