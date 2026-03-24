# Example: Approval Checkpoint

Pause the flow for human review before a destructive or high-risk operation. The `let x = prompt` pattern creates a natural checkpoint — the agent relays the approval request to the user and waits for a response.

## Natural language

```
Generate the database migration. Show me the migration before applying it. Wait for my approval before running it. If I say no, revise the migration.
```

## DSL equivalent

```
Goal: database migration with human approval

flow:
  prompt: Generate the database migration for adding the users table. Show the generated SQL.
  let approval = prompt "Review the migration output above. Type PROCEED to apply it, or describe what needs to change."
  if ${approval} == "PROCEED"
    run: npx prisma migrate deploy
  else
    prompt: Revise the migration based on this feedback: ${approval}
  end

done when:
  file_exists prisma/migrations
```

## What happens

1. The first `prompt` instructs the agent to generate the migration and display it.
2. `let approval = prompt "..."` pauses flow advancement. The agent relays the approval question to the user and captures the response.
3. The `if` checks the captured response:
   - If "PROCEED", the migration runs via `run: npx prisma migrate deploy`.
   - Otherwise, the response is treated as feedback and the agent revises the migration.
4. The gate verifies the migration directory exists.

## Why this works

The `let x = prompt` node is the approval mechanism. When the flow reaches this node:

- The flow cannot advance until the agent captures a response
- The agent must relay the prompt text to the user (it's a capture prompt — the agent is instructed to ask the user)
- The user's response is stored in the variable for conditional branching

This is functionally equivalent to a dedicated `approval` node. The agent mediates the interaction.

## Variation: multi-stage approval

Gate multiple checkpoints in a deployment pipeline:

```
Goal: staged deployment

flow:
  prompt: Run the full test suite and report results.
  run: npm test
  let test_approval = prompt "Tests completed. Review the results above. Type PROCEED to deploy to staging."
  run: ./scripts/deploy.sh --env staging
  run: curl -sf https://staging.example.com/health
  let deploy_approval = prompt "Staging deployment is live and healthy. Type PROCEED to deploy to production."
  run: ./scripts/deploy.sh --env production

done when:
  gate prod_health: curl -sf https://example.com/health
```

Each `let x = prompt` is a checkpoint. The flow pauses at each one, giving the user time to review before the next stage.
