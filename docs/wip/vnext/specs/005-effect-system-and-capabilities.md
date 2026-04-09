# Spec 005 — Effect system and capabilities

## Problem

`run:` is too semantically broad. Today a harmless local test and an irreversible production action can look nearly identical in the syntax. That makes:

- policy weaker
- replay riskier
- resume harder
- auditing poorer
- capability restrictions harder to enforce

## Goals

- Add first-class effect nodes
- Separate checks from side effects
- Introduce idempotency semantics
- Attach risk and capabilities to actions

## Non-goals

- Do not remove raw shell as an escape hatch
- Do not require all commands to use typed adapters on day one

## Proposed syntax

### Explicit effect node

```yaml
effect "open_pr" risk medium once key="${branch_name}"
  run: gh pr create --title "${title}" --body "${body}"
  needs: [github.pr.create]
end
```

### Reversible effect

```yaml
effect "deploy_prod" risk high once key="${release_id}"
  run: npm run deploy:prod
  rollback: npm run rollback:prod ${release_id}
  needs: [deploy.prod]
end
```

### Irreversible effect

```yaml
effect "send_email" risk irreversible once key="${message_id}"
  run: node scripts/send-email.js ${message_id}
  needs: [notification.send]
end
```

### Capability declarations

```yaml
capabilities:
  - git.read
  - git.write
  - npm.test
  - github.pr.create
  - deploy.prod
```

### Read-only / check step annotations

```yaml
run: npm test
  class: check
  needs: [npm.test]
```

## Effect classes

Suggested classes:

- `pure` — no mutation, deterministic where possible
- `check` — verification or observation step
- `mutate` — local project mutation
- `effect_once` — external side effect with idempotency key
- `effect_reversible` — external side effect with rollback
- `human` — approval or manual step

## Semantics

### `once key=...`

The runtime records the effect instance and suppresses duplicate re-execution during retry/resume unless explicitly forced.

### `rollback`

Rollback is not guaranteed to restore global truth, but makes the runtime explicit about recovery options.

### `needs`

Capabilities declare what permission/tool surface the node requires. The policy engine can use this.

## Typed adapters (later layer)

High-value typed adapters should eventually exist above raw shell:

```yaml
github.open_pr(title="${title}", body="${body}")
npm.test(scope="auth")
git.changed_files()
```

These improve:

- portability
- policy enforcement
- replay/simulation
- observability

## Static analysis

The compiler/linter should:

- flag high-risk raw shell without explicit effect/risk
- flag irreversible effects without approval or policy
- flag effects lacking idempotency keys where retries are possible
- flag undeclared capabilities
- flag unused capability declarations

## Migration path

### Phase 1

- effect nodes
- risk field
- idempotency key support

### Phase 2

- capabilities
- effect-aware policy checks

### Phase 3

- typed tool adapters over raw shell

## Acceptance criteria

- Effects are syntactically distinct from ordinary checks
- Effects record idempotency metadata
- Effects can declare rollback
- Effects integrate with policy/risk
- Capability-aware linting exists

## Open questions

- Should local file edits inside the repo be auto-classified as `mutate`?
- How much should typed adapters be built in versus plugin-provided?
