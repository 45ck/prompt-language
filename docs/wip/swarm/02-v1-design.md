# V1 Design

## Decision

Build **manager-owned swarms** first.

V1 should assume:

- one parent flow owns orchestration
- named roles are declared locally inside the swarm block
- roles do not dynamically create more roles
- role execution order is explicit
- outputs are explicitly returned
- final correctness still comes from top-level gates

## V1 goals

### Goal 1: Make common swarm patterns readable

The main win is readability over raw `spawn` / `await` / `send` / `receive`.

### Goal 2: Avoid new runtime magic

If a feature cannot be lowered cleanly to existing primitives plus one or two minimal additions, it probably belongs in a later version.

### Goal 3: Preserve explicit control

Parent remains the authority for:

- when roles start
- when they are awaited
- how outputs are interpreted
- what to do on failure
- when the whole flow is actually done

## Proposed v1 syntax surface

```yaml
swarm <id>
  role <id> [model "..."] [in "..."] [with vars a, b, c]
    <existing flow nodes>
    [return <expr>]
  end

  flow:
    start <role>[, <role>...]
    await <role>[, <role>...] | await all
  end
end
```

## Minimal new constructs

### `swarm`

A new container node that holds:

- role declarations
- a local coordination flow

### `role`

A named child-flow template.

### `start`

A clearer swarm-local alias for “spawn this declared role now”.

### `return`

A child-to-parent result emission mechanism.

## What does **not** change in v1

These should continue to behave exactly as they do today:

- `done when:`
- `review`
- `approve`
- `retry`
- `if` / `while` / `until`
- command execution
- prompt capture
- JSON capture
- parent-owned failure handling

## Namespace model

After a role is awaited, the parent gets:

- `${swarmId.roleId.result}`
- `${swarmId.roleId.status}`
- `${swarmId.roleId.exit_code}`
- `${swarmId.roleId.returned}`
- `${swarmId.roleId.started_at}`
- `${swarmId.roleId.completed_at}`

The intent is:

- `result` = parsed returned value when possible
- `returned` = raw returned payload as string
- status/exit metadata = operational data

## Type expectations

`return` should allow:

- string
- number
- boolean
- JSON object
- JSON array

Best practice for nontrivial swarms should be: return JSON with a stable shape.

## V1 examples it should handle well

- frontend/backend/reviewer split
- repository-wide audit with per-file workers
- multi-strategy search with an explicit judge after the workers finish
- static analysis + patching + review loop
