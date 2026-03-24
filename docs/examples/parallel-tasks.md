# Example: Parallel Tasks

Run independent work streams simultaneously using `spawn`/`await`. Each spawned child is a separate `claude -p` process with its own state directory.

## Natural language

```
Fix the tests in auth, api, and billing modules. Work on all three at the same time. When all are done, run the full test suite.
```

## DSL equivalent

```
Goal: fix tests in three modules in parallel

flow:
  spawn "auth"
    prompt: Fix all failing tests in the auth module. Only modify files in src/auth/.
    run: npm test -- --filter auth
  end
  spawn "api"
    prompt: Fix all failing tests in the api module. Only modify files in src/api/.
    run: npm test -- --filter api
  end
  spawn "billing"
    prompt: Fix all failing tests in the billing module. Only modify files in src/billing/.
    run: npm test -- --filter billing
  end
  await all
  run: npm test

done when:
  tests_pass
```

## What happens

1. Each `spawn` block launches a child `claude -p` process. The parent immediately advances past each spawn — no waiting.
2. All three children run simultaneously, each with their own state directory (`.prompt-language-auth/`, `.prompt-language-api/`, `.prompt-language-billing/`).
3. Parent variables are copied to each child as `let` declarations, so children have access to the parent's context.
4. `await all` blocks the parent until all three children complete (or fail).
5. After `await`, child variables are imported with name prefixes: `auth.last_exit_code`, `api.last_exit_code`, `billing.last_exit_code`.
6. The parent runs the full test suite to verify everything works together.
7. The `done when: tests_pass` gate ensures the combined result is correct.

## Variation: await specific children

Wait for only one child before continuing:

```
flow:
  spawn "setup"
    run: npm install
    run: npx prisma generate
  end
  spawn "docs"
    prompt: Update the README with the new API endpoints.
  end
  await "setup"
  prompt: Implement the new API endpoints. The database schema is ready.
  await "docs"
```

Here, `await "setup"` blocks until setup completes but lets docs work continue in parallel. The implementation prompt only runs after the database schema is ready.

## Variation: parallel with error handling

Combine `spawn`/`await` with `try`/`catch`:

```
flow:
  spawn "migrate"
    run: npx prisma migrate deploy
  end
  spawn "seed"
    run: node scripts/seed.js
  end
  try
    await all
  catch command_failed
    prompt: One or more parallel tasks failed. Check the error output and fix the issues.
  end
```
