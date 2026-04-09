# Design principles

## 1. Deterministic completion stays sacred

`done when:` should remain deterministic by default. Do not let model or human judges silently replace hard completion checks.

## 2. Small explicit judges beat one giant oracle

Where subjective evaluation is needed, prefer:

- narrow rubrics
- explicit evidence
- abstention
- calibration
- baseline comparison

## 3. Fail closed when the runtime no longer knows enough

Timeouts, parse failures, missing captures, state corruption, and exhausted review loops should stop trusted execution unless the flow explicitly opts into permissive behavior.

## 4. Side effects must be visible in the syntax

A production deploy should not look indistinguishable from a local test run. Effects should be first-class and policy-aware.

## 5. Scope is a product feature

Contracts should encode the boundedness that developers currently enforce manually.

## 6. Replayability is non-negotiable

Every autonomous run should leave behind enough evidence to:

- understand what happened
- rerun it
- compare it
- learn from it
- turn failures into regressions

## 7. Raw shell remains the escape hatch, not the only interface

Typed adapters and capabilities should exist above shell. Shell is still necessary, but it should not be the only semantic layer.

## 8. Parallelism must be safe concurrency, not just coordination

Spawn/await is a start. Real safe concurrency needs worktrees, locks, ownership, and merge policies.

## 9. Memory needs governance

Stored “wisdom” should be versioned, typed, attributable, and promotable — not a junk drawer.

## 10. Authoring convenience should not be the trusted execution path

Natural-language flow generation is useful, but serious usage should go through compile/lint/simulate/run.

## 11. The language itself should be testable

Flows, contracts, judges, and policies should all be testable artifacts.

## 12. Portability matters

The language should describe bounded engineering work independently of any single model vendor or CLI.
