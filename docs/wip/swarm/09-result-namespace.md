# Swarm Result Namespace

## Overview

When a swarm role completes and is awaited by the parent flow, its results are imported into the parent's variable store under a structured namespace. This document describes the namespace layout, JSON decode behavior, and failure handling.

## Namespace Layout

After `await <role>` or `await all`, the parent receives variables under the `<swarmId>.<roleId>.*` prefix:

| Variable                      | Type                        | Description                                                                           |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `<swarm>.<role>.status`       | `"completed"` \| `"failed"` | Terminal execution status                                                             |
| `<swarm>.<role>.exit_code`    | number \| string            | Last exit code from child (numeric when parseable)                                    |
| `<swarm>.<role>.returned`     | string                      | Raw `return` payload as-is (empty string if no return)                                |
| `<swarm>.<role>.result`       | VariableValue               | JSON-decoded payload, or raw string if decode fails                                   |
| `<swarm>.<role>.started_at`   | string                      | ISO 8601 timestamp when role was spawned                                              |
| `<swarm>.<role>.completed_at` | string                      | ISO 8601 timestamp when role finished                                                 |
| `<swarm>.<role>.error`        | string                      | Last stderr from child (only set when `status === "failed"`, truncated to 2000 chars) |

Additionally, all non-internal child variables are imported with the flat `<childName>.<key>` prefix via `importChildVariablesWithPrefix`. Internal transport variables (`__swarm_id`, `__swarm_role`, `__swarm_return`) are filtered out.

## JSON Decode Behavior

The `.result` field uses `decodeJsonVariableValue()`:

1. If `returned` is empty string, `.result` is empty string
2. If `returned` is valid JSON whose parsed value is a `VariableValue` (string, number, boolean, array, object — no `null`), `.result` is the parsed value
3. Otherwise `.result` is the raw string (same as `.returned`)

This means `return '{"summary":"ok","confidence":0.9}'` produces:

- `.returned` = `'{"summary":"ok","confidence":0.9}'` (string)
- `.result` = `{ summary: "ok", confidence: 0.9 }` (object)

And `return "done"` produces:

- `.returned` = `"done"` (string)
- `.result` = `"done"` (string, since it's not valid JSON)

## Failure Handling

| Scenario                             | `.status`     | `.returned` | `.result` | `.error`    |
| ------------------------------------ | ------------- | ----------- | --------- | ----------- |
| Role completes with `return`         | `"completed"` | payload     | decoded   | not set     |
| Role completes without `return`      | `"completed"` | `""`        | `""`      | not set     |
| Role fails before `return`           | `"failed"`    | `""`        | `""`      | last stderr |
| Role fails after `return` (via send) | `"failed"`    | payload     | decoded   | last stderr |

## Transport Mechanism

Swarm roles are lowered to `spawn` + `await` primitives. The `return` expression is lowered to:

```
let __swarm_return = <expression>
send parent "${__swarm_return}"
```

On the parent side, `importAwaitedSwarmResult` reads the return payload from (in priority order):

1. `child.returned` (if set directly)
2. `messageStore.receive(childName)` (from `send parent`)
3. `child.variables['__swarm_return']` (fallback from child state)

## Parent Visibility

The parent can reference results in interpolation and conditions:

```yaml
swarm checkout_fix
  role frontend
    prompt: Fix the frontend
    return "${last_stdout}"
  end

  flow:
    start frontend
    await frontend
  end
end

if ${checkout_fix.frontend.status} == "completed"
  prompt: Frontend returned: ${checkout_fix.frontend.result}
else
  prompt: Frontend failed: ${checkout_fix.frontend.error}
end
```
