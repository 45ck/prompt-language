# Current state and gap analysis

## What the repo already has

The current docs describe a runtime that already ships a strong base:

- persistent state and context re-injection
- `prompt`, `run`, `let` / `var`
- `if`, `while`, `until`, `retry`, `foreach`, `break`, `continue`
- `spawn` / `await`, `race`, `foreach-spawn`, `send` / `receive`
- `done when:` gates and built-in predicates
- approvals
- review loops
- memory and prefetch
- imports and prompt libraries
- structured JSON capture
- SDK and integrations
- a thesis and eval program

This is a real runtime, not a toy syntax layer.

## What the repo itself says is proven

The evaluation docs say the strongest proven advantage is **structural gate enforcement**. They explicitly say flow control does not outperform vanilla on well-specified tasks, and that context/state features primarily improve programmability and convenience rather than measured correctness. The guide reinforces this by telling users to start with gates before flows.

That is the right reading.

## What is still missing

### 1. A real trust model

The runtime still contains several permissive/fail-open behaviors:

- prompt capture can degrade into empty or raw data
- approval can continue on timeout
- review can continue after max rounds
- corrupted state currently allows operation
- max-iteration failure eventually lets the agent stop

For research, that is tolerable. For real safe autonomy, it is not.

### 2. Scope as a first-class concept

Developers do not mostly babysit by asking “did tests pass?” They babysit by asking:

- did it stay in scope?
- did it avoid risky files?
- did it change too much?
- did it preserve invariants?
- did it avoid hidden side effects?

The language has gates but not yet a reusable **contract system** that encodes scope and invariants.

### 3. Side effects are still opaque

`run:` is too semantically broad. There is no first-class distinction between:

- a read-only check
- a local code mutation
- a retry-safe external mutation
- an irreversible action

Without that distinction, retries/resume remain fragile.

### 4. State is too loosely typed

Variables are global, loosely typed, and can be easy to misuse. Structured capture exists, but the overall model is still closer to string interpolation than an artifact/dataflow system.

### 5. Replayability is not strong enough

A mutable session-state JSON file is simple, but weak for:

- audit history
- crash recovery
- deterministic replay
- rich evaluation
- concurrent coordination

### 6. Parallelism is not yet safe concurrency

The language already has `spawn` and `await`. That is useful. But serious parallelism needs:

- worktree isolation
- ownership declarations
- resource locks
- merge policies
- collision handling

### 7. The compile path is too implicit

Natural-language detection at prompt submission is a nice convenience, but it should not be the main trusted execution path for serious flows. The language needs a visible compile/lint/simulate/run pipeline and a stable IR.

### 8. Memory exists, but wisdom governance does not

The runtime can remember values, but it does not yet model:

- factual config vs heuristic wisdom
- provenance
- confidence
- expiry
- contradiction resolution
- promotion from failure to durable project knowledge

### 9. Evaluation is promising but not yet central enough

The proposed rubric/judge/eval stack is one of the best future directions in the repo. It should become a core architectural pillar, not just a WIP add-on.

## Summary of the main architectural gap

The project has enough runtime power, but not yet enough **trust discipline**.

The missing layer is not “more ways to say loop.”
The missing layer is:

- contracts
- effects
- policy
- capabilities
- replay
- compile-time analysis
- structured evaluation
- provider abstraction
