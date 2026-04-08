# Example: Producer / Consumer Messaging

Coordinate work across spawned children with `send` and `receive`. This is useful when one child can break a task into smaller units and another child can carry out the work.

## Natural language

```
Split the change into a brief and hand it to an implementer. The implementer should send the result back when it is done.
```

## DSL equivalent

```yaml
Goal: coordinate work between child sessions

flow:
  spawn "triager"
    prompt: Inspect the diff and decide what the implementer should do next.
    send "implementer" "${last_stdout}"
  end

  spawn "implementer"
    receive brief from "triager"
    prompt: Make the requested change: ${brief}
    run: npm test
    send parent "${last_stdout}"
  end

  receive result from "implementer"
  prompt: The implementer reported: ${result}

done when:
  tests_pass
```

## What happens

1. The `triager` child writes a concise brief for the next worker.
2. `send "implementer" "${last_stdout}"` queues that brief in the implementer's inbox.
3. The `implementer` child blocks on `receive brief from "triager"` until the task arrives.
4. After the work finishes, the implementer sends its result back to the parent.
5. The parent receives the result and can make the final decision or continue the flow.

## Why this works

- `send` and `receive` keep the coordination explicit in the flow instead of burying it in ad hoc prompts.
- The parent still owns the orchestration, so the task graph stays readable.
- Message passing stays narrow and deterministic, which makes it easier to reason about than a free-form agent team.

## Related

- [send / receive](../reference/send-receive.md)
- [spawn](../reference/spawn.md)
- [await](../reference/await.md)
