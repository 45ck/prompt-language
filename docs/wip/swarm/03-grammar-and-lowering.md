# Grammar and Lowering

## Syntax sketch

```ebnf
SwarmBlock      := "swarm" Identifier Newline
                   RoleBlock+
                   SwarmFlowBlock
                   "end"

RoleBlock       := "role" Identifier RoleOptions? Newline
                   FlowNode*
                   ReturnStmt?
                   "end"

RoleOptions     := (ModelOpt | InOpt | WithVarsOpt)*

ModelOpt        := "model" String
InOpt           := "in" String
WithVarsOpt     := "with vars" IdentifierList

SwarmFlowBlock  := "flow:" Newline
                   SwarmFlowNode+
SwarmFlowNode   := StartStmt | AwaitStmt | ExistingFlowNode

StartStmt       := "start" IdentifierList
AwaitStmt       := "await" "all"
                 | "await" IdentifierList

ReturnStmt      := "return" Expression
```

## Parsing strategy

The parser should:

1. recognize `swarm` as a block-level node
2. store each `role` as a named role definition
3. parse the inner `flow:` as a normal flow block with two additional statements: `start`, `return`

Validation rules:

- role names must be unique inside a swarm
- `start` can only reference declared roles
- `await` can only reference declared roles or `all`
- `return` is only legal inside a role
- each role can have at most one `return` statement
- cyclic self-starting is disallowed in v1
- nested `swarm` inside `role` is disallowed in v1

## Lowering model

`swarm` is expanded before execution into ordinary runtime nodes.

### Lowering rule: role declaration

Store the role body as a template. It does not execute until started.

### Lowering rule: `start roleA`

Expand into a `spawn "roleA"` using the role’s declared options and body.

### Lowering rule: `return expr`

Lower to:

1. assign to an internal variable like `__swarm_return`
2. serialize if needed
3. `send parent ${__swarm_return}`

### Lowering rule: `await roleA`

Expand into:

1. `await "roleA"`
2. `receive __swarm_<swarm>_<role>_returned from "roleA" timeout N`
3. assign namespace variables under `<swarm>.<role>.*`

### Lowering rule: `await all`

Lower into ordered awaits over started roles, followed by receives for each return payload.

## Example lowering

Source:

```yaml
swarm checkout_fix
  role frontend model "sonnet"
    prompt: Fix the UI regression.
    let summary = prompt "Return JSON with summary and confidence" as json {
      summary: string
      confidence: number
    }
    return ${summary}
  end

  flow:
    start frontend
    await frontend
  end
end
```

Lowered form:

```yaml
spawn "frontend" model "sonnet"
  prompt: Fix the UI regression.
  let summary = prompt "Return JSON with summary and confidence" as json {
    summary: string
    confidence: number
  }
  let __swarm_return = ${summary}
  send parent ${__swarm_return}
end

await "frontend"
receive __checkout_fix_frontend_returned from "frontend" timeout 30
```

Parent namespace population happens after the receive.

## Runtime semantics

### Role execution

Roles execute as ordinary child flows, subject to all current child runtime semantics.

### Parent authority

The parent alone determines:

- when a role starts
- when it is joined
- whether its output is trusted
- what to do next

### Failure behavior

V1 should not invent automatic retries or healing semantics for failed roles.
Users already have `retry`, `if`, `review`, and `try/catch`.

### Return transport

Return is message-based transport. This matches the current messaging model and avoids adding a parallel child-result channel.

### Result decoding

Parent should attempt:

1. exact JSON parse
2. fallback to string if parse fails

## Why this lowering is good

- easy to debug
- no second runtime
- compatible with current flow monitor/status model
- compatible with existing smoke-test strategy
- easy to render/expand in `validate`
