# Final Plan

## Goals

1. Make runtime behavior explainable without overdesigning the system.
2. Separate normal flow outcomes from actual runtime failures.
3. Put compatibility and preflight checks inside `validate`.
4. Block semantic changes by default.
5. Keep the first rollout small enough to ship.

## Core decisions

### 1) Two top-level result channels

Use:

- `diagnostics[]` for parse/profile/runtime/internal problems
- `outcomes[]` for normal flow results such as gate failures, budget exhaustion, approval denial, and successful completion

### 2) Four diagnostic classes only

The first implementation only needs:

- `parse`
- `profile`
- `runtime`
- `internal`

Do not start with a giant taxonomy. Add metadata later if necessary.

### 3) Treat flow outcomes as non-errors

These are not runtime errors:

- a gate evaluated successfully and returned false
- approval was denied
- retry/review/loop budget ran out before success
- a flow completed successfully

### 4) One hard compatibility rule

Never silently degrade semantics.

Block by default when a selected runner/profile would change:

- gate enforcement
- `approve`
- `spawn` / `await` parallel semantics
- required capture / `ask` semantics

Warn only for UX-only features.

### 5) Put compatibility inside `validate`

Add support for:

```bash
pl validate my.flow --runner claude --mode interactive
pl validate my.flow --runner opencode --mode headless --json
```

`validate` should answer both:

- is the flow structurally valid?
- is the flow compatible with this execution profile?

### 6) Stable diagnostic code ranges

Use:

- `PLP-*` parse / shape
- `PLC-*` compatibility / preflight / profile
- `PLR-*` runtime
- `PLI-*` internal
- `PLO-*` outcomes

### 7) Exit codes

- `0` success
- `1` terminal unsuccessful flow outcome
- `2` blocked by parse/profile/preflight diagnostics
- `3` runtime/internal failure

### 8) Ship in four passes

1. Introduce the contract and exit-code behavior.
2. Reclassify existing failures into diagnostics vs outcomes.
3. Add profile checks to `validate`.
4. Add tests, smoke coverage, and docs.

## Non-goals for this round

- No separate `explain` command yet
- No giant harness-neutral abstraction layer yet
- No huge feature matrix yet
- No silent semantic fallback
