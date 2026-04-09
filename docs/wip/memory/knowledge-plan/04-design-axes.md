# Design Axes To Evaluate

## 1. Determinism vs flexibility

Use exact section lookup and hard gates for critical control paths.
Use retrieval only when softer grounding is acceptable.

## 2. Always-loaded vs on-demand

Only load core guidance by default.
Load bulky docs and specialized knowledge on demand.

## 3. Read-only policy vs writable memory

Shared policy should usually be read-only.
Writable stores should be scoped and explicit.

## 4. Runtime state vs long-term memory

Checkpoints, loop counters, and execution status belong in runtime state.
Lessons and procedures belong in durable memory.

## 5. Project-level composition vs inline DSL

Prefer repo/project structure for big concepts:

- wisdom
- policies
- review logic
- memory directories
- reusable libraries

## 6. Language semantics vs backend config

Keep the DSL focused on intent and execution.
Push backend choices down into adapters and config.

## 7. Hot-path execution vs maintenance work

Do not make consolidation, indexing, and store maintenance part of normal flow authoring unless truly needed.
