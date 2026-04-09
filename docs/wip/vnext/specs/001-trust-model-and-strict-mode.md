# Spec 001 — Trust model and strict mode

## Problem

The current runtime has several soft/fail-open behaviors that are acceptable for experimentation but too weak for trustworthy autonomy:

- capture parse/capture file failures can degrade into empty or raw values
- approvals can continue on timeout
- review exhaustion can continue
- unreadable/corrupted state can fail open
- iteration exhaustion can eventually allow the agent to stop

These are exactly the kinds of hidden runtime degradations that reintroduce human babysitting later.

## Goals

- Add a first-class trust configuration model
- Support project-level and flow-level strictness
- Make the runtime fail closed when it no longer knows enough
- Preserve a permissive mode for experimentation and gradual adoption

## Non-goals

- This spec does not change the semantics of deterministic gates
- This spec does not introduce model judging
- This spec does not replace review or approvals; it governs their failure behavior

## Proposed syntax

### Global trust block

```yaml
trust:
  mode: strict
  unknown_var: fail
  memory_missing: fail
  capture_parse: fail
  capture_empty: fail
  state_corruption: fail
  review_exhausted: fail
  judge_abstain: fail
  approve_timeout: reject
  max_iterations_exceeded: fail
```

### Per-node overrides

```yaml
let summary = prompt "Summarize the logs" as SummarySchema strict

approve "Deploy to prod?" timeout 300 on_timeout reject
approve "Continue low-risk cleanup?" timeout 60 on_timeout continue
```

### Mode presets

```yaml
trust:
  mode: permissive | balanced | strict
```

Suggested preset meanings:

- `permissive`: current-ish behavior for exploration
- `balanced`: fail closed on high-risk issues, permissive on non-critical capture issues
- `strict`: fail closed on all ambiguity relevant to trusted execution

## Semantics

### Unknown variables

- `unknown_var: fail` means `${typo}` is a compile-time or runtime error, not silent pass-through.

### Missing memory

- `memory_missing: fail` means `memory "key"` cannot silently become `""` when the value is required.

### Capture parse

- `capture_parse: fail` means structured capture that fails validation stops execution.
- `capture_parse: raw` may remain available in permissive mode.

### Capture empty

- `capture_empty: fail` means empty capture files are not acceptable.

### State corruption

- `state_corruption: fail` means corrupted state halts the flow and emits a recoverable error state.
- A manual recovery path should remain available via replay/restore/reset.

### Review exhaustion

- `review_exhausted: fail` turns current soft review loops into strict bounded loops.

### Judge abstain

- If later `judge` support exists, `judge_abstain: fail` prevents soft continuation when the evaluator lacks evidence.

### Approval timeout

- `approve_timeout: reject` should be the default under strict mode.

### Max-iteration exceeded

- `max_iterations_exceeded: fail` should leave the flow in an explicit failed state with checkpoint/replay info, not silently treat failure as completion.

## Static analysis rules

The linter should flag:

- high-risk effects with permissive trust
- missing trust blocks in production templates
- contradictory trust settings
- strict mode paired with silent fallbacks on critical nodes

## Migration plan

### Stage 1

- add `review strict`
- add `approve ... on_timeout`
- add unknown-var strict linting
- add explicit state corruption failure mode

### Stage 2

- add trust presets
- add per-node overrides
- update templates/docs

### Stage 3

- make strict mode the recommended production default

## Edge cases

### Partial strictness

A flow may want strictness only around high-risk sections.

```yaml
flow:
  trust:
    mode: strict
  # critical steps
end
```

### Human override

The runtime should allow explicit human recovery from strict failures:

- continue once
- continue always for this node type
- restore checkpoint
- abort

## Acceptance criteria

- Unknown variables can be configured to fail
- Approval timeouts can reject instead of approve
- Review exhaustion can fail the flow
- State corruption can leave the flow in explicit failed state
- Strict mode is testable and replayable
- Templates and docs recommend strict mode for trusted automation

## Open questions

- Should `state_corruption: fail` be the default even in permissive mode?
- Should strictness be inherited by spawned child flows by default?
