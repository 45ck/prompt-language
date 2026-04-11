# Design: Swarm Result Namespace and Return Transport

## Status

Accepted design target for bead `prompt-language-1wr7.4`.

Anchors:

- [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)
- [Swarm Tooling Visibility](swarm-tooling-visibility.md)
- [docs/wip/swarm/03-grammar-and-lowering.md](../wip/swarm/03-grammar-and-lowering.md)
- [docs/wip/swarm/06-implementation-plan.md](../wip/swarm/06-implementation-plan.md)

## Decision

When an awaited swarm role settles, the parent runtime must materialize one stable result namespace under:

`<swarm>.<role>.*`

The return path remains ordinary child-to-parent transport over the existing messaging model. `swarm` does not introduce a second result channel, swarm-only storage, or peer-visible shared role state.

This note is intentionally narrow. It defines:

- namespace semantics for awaited role results
- how `return` is transported back to the parent
- JSON-versus-string decoding rules
- missing-return behavior
- failure visibility requirements

It does not reopen broader swarm syntax, scheduling, nested-team semantics, or tooling rollout.

## Why this needs a first-class contract

The current swarm work is only coherent if `await role` behaves like explicit parent-owned orchestration rather than a hidden team runtime.

Without a precise contract here, the implementation can drift in several bad ways:

- runtime state may expose one result shape while CLI or docs describe another
- JSON payloads may be treated differently from plain strings without a stable rule
- missing `return` may become ambiguous between "no payload" and "tooling lost the payload"
- failed roles may appear only as child failures without a parent-readable swarm namespace

`prompt-language-1wr7.4` exists to remove that ambiguity before lowering and runtime work harden.

## Namespace contract

After the parent successfully observes a settled role through `await`, it must populate the following keys:

- `<swarm>.<role>.status`
- `<swarm>.<role>.exit_code`
- `<swarm>.<role>.returned`
- `<swarm>.<role>.result`
- `<swarm>.<role>.started_at`
- `<swarm>.<role>.completed_at`

Semantics:

- `<swarm>` is the authored swarm identifier, not an opaque runtime-generated id.
- `<role>` is the authored role name when available; if the runtime only has the child name, that child name is the fallback role identifier.
- `.returned` is the raw payload observed by the parent after message transport or equivalent child-result import.
- `.result` is the decoded value derived from `.returned` using the rules below.
- `.status` reflects the child lifecycle visible to the parent at await time, not an invented swarm-only success state.
- `.exit_code` is the parsed child exit code when available.
- `.started_at` and `.completed_at` are copied from child execution metadata when available and may be empty strings when the runtime lacks them.

This namespace is parent-owned materialized state. It is not a promise that roles can read or mutate each other's result fields directly.

## Return transport contract

`return expr` lowers to ordinary child-to-parent transport over the existing message path.

The accepted transport model is:

1. the role evaluates the authored return expression
2. the lowered child flow sends that payload back to the parent using existing `send parent ...` semantics
3. the parent imports the observed payload during `await`
4. the parent writes the namespace keys under `<swarm>.<role>.*`

Applied rules:

- `swarm` does not add a separate result file, side channel, or hidden scheduler-owned mailbox
- parent import happens because the parent awaited the role, not because roles publish into shared swarm memory
- role completion and role result import remain related but distinct events: a role may complete with or without a payload

This keeps swarm result flow aligned with the accepted subagent-first boundary: roles are bounded child runs, and the parent remains the authority that decides when imported results become usable.

## Decoding contract

The parent must preserve both the raw return payload and the decoded view.

### Raw value

`<swarm>.<role>.returned` stores the exact payload that reached the parent after transport, including valid JSON text and ordinary strings.

### Decoded value

`<swarm>.<role>.result` applies one decode step:

1. if `.returned` is the empty string, `.result` is the empty string
2. otherwise attempt exact JSON parsing
3. if JSON parsing succeeds and the parsed value is representable in the runtime variable model, store that parsed value
4. if JSON parsing fails or produces an unsupported shape, store the original raw string unchanged

Operational consequences:

- JSON objects remain structured parent-readable data in `.result`
- JSON arrays remain arrays in `.result`
- numeric and boolean JSON values remain typed values in `.result`
- plain strings stay strings in `.result`
- invalid JSON does not disappear, partially decode, or silently coerce

The repo's current runtime tests already point in this direction: JSON returns populate structured `.result`, while raw strings remain raw strings.

## Missing-return behavior

Role completion without a `return` is valid in v1 and must remain observable.

If a role completes and the parent observes no payload through the return transport, the parent must still materialize the namespace:

- `<swarm>.<role>.status = completed`
- `<swarm>.<role>.returned = ""`
- `<swarm>.<role>.result = ""`

This behavior is important for two reasons:

- it distinguishes "role completed but returned nothing" from "role was never awaited, so no parent namespace exists yet"
- it avoids forcing authors to guess whether missing payload means runtime loss, parse failure, or intentional no-return behavior

The runtime may add additional tooling-visible flags later, but v1 must at minimum make the empty-string result deterministic.

## Failure visibility contract

Failed roles must still populate the same parent namespace after await settles.

Minimum failure behavior:

- `<swarm>.<role>.status` reflects the failed child status
- `<swarm>.<role>.exit_code` captures the failed exit code when known
- `<swarm>.<role>.returned` reflects any payload that actually reached the parent; otherwise it is the empty string
- `<swarm>.<role>.result` follows the same decode rules as successful roles

Applied visibility rule:

> Failure does not suppress namespace materialization.

This matters because parent logic, tooling, and future shell surfaces need one stable place to inspect role outcome regardless of success or failure.

Failure visibility here does not require v1 to solve every diagnostic problem. It only requires that awaited failures remain parent-visible in a deterministic namespace instead of existing only in child-local logs.

## Timing of materialization

The namespace becomes authoritative only after the parent has observed role settlement through `await`.

That means:

- starting a role does not pre-create a synthetic success namespace
- a running role may have child metadata elsewhere, but its final `<swarm>.<role>.*` result keys are not authoritative until await import runs
- `await all` must produce the same per-role namespace outcome as awaiting the same started roles individually

This keeps the parent-owned synchronization model intact.

## Non-goals

This note does not authorize:

- shared mutable swarm result scope
- peer-to-peer role reads before parent import
- nested namespace rules for nested swarms
- swarm-specific retry or healing semantics
- automatic schema validation beyond the simple JSON-or-string decode contract
- a tooling-only success state that disagrees with the imported parent namespace

## Implementation-ready acceptance bar

`prompt-language-1wr7.4` is ready to close at the design-doc level when implementation work can proceed against these rules without reopening semantics:

- awaited roles materialize one stable `<swarm>.<role>.*` namespace
- return transport remains ordinary child-to-parent messaging
- `.returned` preserves raw payloads
- `.result` decodes exact JSON and otherwise preserves the raw string
- missing-return completion is explicitly represented as empty-string payload and result
- failed awaited roles still populate the namespace instead of disappearing into child-local state

## Practical rule

When reviewing a swarm result implementation, ask:

> After `await`, can an operator or parent flow inspect one deterministic `<swarm>.<role>.*` namespace and understand whether the role succeeded, failed, returned JSON, returned a string, or returned nothing?

If the answer is yes, the implementation fits this design.

If the answer depends on hidden swarm state, child-only logs, or transport-specific guesswork, it does not.
