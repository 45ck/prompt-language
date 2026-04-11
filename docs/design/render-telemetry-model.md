# Render Telemetry Byte Composition

## Status

Contract note for bead `prompt-language-0ovo.1.2`.

This file defines the byte-composition slice that must exist inside render
telemetry. It does not claim that the runtime already emits these values at
every hook.

## Why This Bead Stays Open

At current `HEAD`, the repo does not yet wire per-hook byte-composition
emission into the runtime paths for:

- `UserPromptSubmit`
- `Stop`
- `TaskCompleted`

That means `prompt-language-0ovo.1.2` is not materially satisfied yet. The
closure-ready part that this file provides is the contract for what those hook
metrics must look like once emitted.

## Required Hook Byte Composition

Each render telemetry record must include a `metrics.hookByteComposition`
object with entries for all three hooks:

```json
{
  "metrics": {
    "hookByteComposition": {
      "userPromptSubmit": {
        "stableBytes": 0,
        "dynamicBytes": 0,
        "variableBytes": 0,
        "commandOutputBytes": 0,
        "totalBytes": 0,
        "visibleVariableCount": 0,
        "changedVariableCount": 0
      },
      "stop": {
        "stableBytes": 0,
        "dynamicBytes": 0,
        "variableBytes": 0,
        "commandOutputBytes": 0,
        "totalBytes": 0,
        "visibleVariableCount": 0,
        "changedVariableCount": 0
      },
      "taskCompleted": {
        "stableBytes": 0,
        "dynamicBytes": 0,
        "variableBytes": 0,
        "commandOutputBytes": 0,
        "totalBytes": 0,
        "visibleVariableCount": 0,
        "changedVariableCount": 0
      }
    }
  }
}
```

## Field Semantics

For each hook record:

- `stableBytes`: bytes from deterministic prompt scaffolding that should remain
  unchanged for equivalent state.
- `dynamicBytes`: bytes from state-dependent material that can vary between
  turns or retries.
- `variableBytes`: bytes contributed by rendered variable state included in the
  hook payload.
- `commandOutputBytes`: bytes contributed by captured command or tool output
  included in the hook payload.
- `totalBytes`: full UTF-8 byte size of the emitted hook payload.
- `visibleVariableCount`: number of variables visible to that hook render.
- `changedVariableCount`: number of visible variables whose value or presence
  changed since the prior rendered turn.

## Required Invariants

These fields are intended to make stable vs dynamic prompt composition explicit.
The machine-readable contract must enforce:

```text
totalBytes = stableBytes + dynamicBytes
dynamicBytes >= variableBytes + commandOutputBytes
```

The second inequality is deliberate. Dynamic content can include variable and
command-output material plus other stateful prompt sections such as retry
context, recovery notices, or gate diagnostics.

## Relationship To The Broader Telemetry Model

This bead refines the broader render telemetry contract in
`docs/evaluation/render-telemetry-model.md`.

The broader model still owns aggregate turn-level counters such as
`promptBytes`, `promptDeltaBytes`, `outputBytes`, `stdoutBytes`, and
`stderrBytes`.

This bead adds the missing per-hook composition view that distinguishes stable
and dynamic prompt bytes.

It does not close the broader telemetry-model bead `prompt-language-0ovo.1.1`,
which owns the full record shape, or the runtime-overhead bead
`prompt-language-0ovo.1.3`, which owns measurement and regression evidence for
the cost of emitting these fields.

## Closure Boundary

This bead should only be closed when all of the following are true:

- runtime emission exists for all three hooks
- automated tests prove the hook metrics are present
- emitted output distinguishes stable bytes from dynamic bytes through the
  fields above

This file alone does not close the bead. It defines the contract required for
the runtime work to close cleanly.
