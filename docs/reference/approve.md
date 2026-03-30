# approve

`approve` pauses the flow and waits for a human yes/no response.

## Syntax

```yaml
approve "Please review these changes before deploying"
```

With timeout:

```yaml
approve "Deploy to production?" timeout 60
```

## Semantics

- Displays the message and blocks until a response is received.
- Accepted yes tokens: `yes`, `y`, `approved`, `ok`, `approve`
- Accepted no tokens: `no`, `n`, `reject`, `cancel`, `rejected`
- On approval sets `approve_rejected = "false"`.
- On rejection sets `approve_rejected = "true"`.
- `timeout N` is in seconds. If the timeout expires, flow continues as approved.

## Example

```yaml
flow:
  run: npm run build
  approve "Build succeeded. Deploy to production?"
  if approve_rejected
    prompt: Deployment cancelled. Summarize what changes are ready.
  else
    run: npm run deploy
  end
end
```

## Related

- [if](if.md)
- [let / var](let-var.md)
