# Example: Error Recovery

Run a deployment that might fail and automatically roll back if it does.

## Natural language

```
Run the database migration. If it fails, roll back to the previous state and report what went wrong. When done, verify the deployment is healthy.
```

## DSL equivalent

```
Goal: run database migration with rollback on failure

flow:
  let snapshot = run "node scripts/db-snapshot.js"
  try
    run: node scripts/db-migrate.js
    prompt: Verify the migration completed correctly and update the changelog.
  catch command_failed
    run: node scripts/db-restore.js --snapshot ${snapshot}
    prompt: The migration failed. Investigate the error above and fix the migration script before retrying.
  end

done when:
  file_exists deploy/MIGRATED
```

## What happens

1. `let snapshot = run` captures a snapshot identifier before any changes are made — stored as a variable for use in the catch block.
2. `try` always enters the body and runs `node scripts/db-migrate.js`.
3. If the migration succeeds (exit 0), the agent gets a prompt to verify and update the changelog, then flow continues past the `try` block.
4. If the migration fails (exit != 0), the `catch command_failed` block activates:
   - `run: node scripts/db-restore.js --snapshot ${snapshot}` uses the captured snapshot ID to roll back.
   - The agent is prompted to investigate the failure and fix the migration script.
5. The `done when: file_exists deploy/MIGRATED` gate verifies that the deployment actually succeeded — the agent cannot stop by just claiming it worked.

## Variation: deploy with health check retry

```
Goal: deploy application and verify health

flow:
  try
    run: ./scripts/deploy.sh --env production
  catch command_failed
    run: ./scripts/rollback.sh
    prompt: Deployment failed and was rolled back. Diagnose the error in the deploy log and fix the issue.
  end
  retry max 3
    run: curl -sf https://api.example.com/health
    if command_failed
      prompt: Health check failed. Check the service logs and fix any startup errors.
    end
  end

done when:
  file_exists deploy/DEPLOYED
```

The `retry` block after the `try` handles transient startup delays — it retries the health check up to 3 times before giving up. If the deploy itself fails, the `catch` block rolls back immediately without reaching the health check.

See [DSL reference — try/catch](../dsl-reference.md#trycatch) and [let/var](../dsl-reference.md#letvar) for syntax details.
