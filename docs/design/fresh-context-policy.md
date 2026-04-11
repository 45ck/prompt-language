# Design: Fresh-Context Policy for Steps and Loops

## Status

Accepted design target for the fresh-context follow-up tracked under the review-pack program.

Relevant bead:

- `prompt-language-r8vp.5` - Fresh-context policy for steps and loops

Primary anchors:

- [2026-04-11 Plan Pack](../wip/reviews/2026-04-11-plan-pack/README.md)
- [Import Backlog: Fresh session boundaries](../wip/tooling/ecosystem/import-backlog.md#fresh-session-boundaries)
- [From Hydra Reach 2026-04-11: Plan Pack](../source-imports/from-hydra-reach-2026-04-11/README.md#plan-pack)

This note defines where prompt-language should preserve conversational state and where it should reset to a fresh session with an explicit bootstrap handoff. It stays at the runtime session-boundary level. It does not define operator-shell UX, planner behavior, or a general multi-agent platform.

## Decision

prompt-language should treat **threaded execution** as the default for ordinary sequential steps inside one run, and should treat **fresh execution** as the default for boundaries where transcript carry-over is more likely to cause contamination than help:

- loop iterations
- retries
- spawned children

Fresh execution does not mean "start from nothing." It means **start a new model session with deterministic bootstrap inputs instead of inheriting the full prior transcript**.

Threaded execution means a step continues in the current conversational lineage and may benefit from prior turn-by-turn reasoning, tool results, and error history.

## Terms

### Threaded execution

The next unit of work reuses the current conversation/session.

Use this when the next step is part of the same reasoning thread and the transcript itself is useful context, not just the declared workflow variables.

### Fresh execution

The next unit of work starts in a new session and receives only the inputs that the runtime deliberately bootstraps into it.

Required bootstrap inputs for any fresh boundary:

- declared workflow inputs and currently materialized variables
- relevant artifacts and file paths
- the current step or child instruction
- applicable policy, profile, and tool constraints
- any compact handoff summary or bootstrap file the runtime defines for that boundary

Fresh execution must not implicitly inherit the entire parent or previous-attempt transcript.

## Policy by construct

| Construct                | Default                   | Why                                                                                                                             | Explicit opt-in                                                                                                                                             |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary sequential step | `threaded`                | Sequential steps often build one reasoning chain; resetting every step would throw away useful local continuity and raise cost. | A step may opt into `fresh` when it should act on stable state/artifacts rather than conversational residue.                                                |
| Loop iteration           | `fresh` per iteration     | Iterations should be comparable and isolated; prior item reasoning is more often contamination than signal.                     | A loop may opt into `threaded` only when the loop is intentionally cumulative and each iteration depends on the prior transcript, not just prior variables. |
| Retry                    | `fresh` per retry attempt | A retry is a corrective re-run; carrying the failing transcript forward often preserves the same bad path.                      | A retry may opt into `threaded` when the error history itself is the recovery input, such as interactive repair of a partially completed action.            |
| Spawned child            | `fresh`                   | Spawn is a bounded child session, not a peer in the same conversation. Isolation is the point.                                  | No implicit threaded-child mode by default. Any future shared-thread child behavior would need a separate design decision.                                  |

## Ordinary sequential steps

Default sequential behavior remains threaded because prompt-language is still a parent-authored runtime where a run advances through one explicit flow. Most adjacent steps are part of the same local task decomposition, so preserving conversation history is the cheaper and simpler default.

Fresh mode is still needed for ordinary steps, but only as an explicit boundary. Good candidates include:

- a verification step that should read artifacts, not conversational persuasion
- a judge or reviewer step that should not inherit the producer's chain of thought
- a handoff from planning to execution where only the approved plan should carry forward
- a long-running run that needs context reset without creating a child topology

The key rule is that ordinary-step freshness is **selective**, not blanket. prompt-language should not become "always fresh every node" by accident.

## Loops

Loop iterations should default to fresh sessions. This is the cleanest way to make each iteration depend on:

- the loop item
- explicit shared inputs
- declared artifacts

and not on accidental memory from previous items.

This default matters most for review, classification, extraction, and fan-out style loops where each item should be judged independently. It also matches the import-backlog rationale that fresh-versus-threaded execution is useful when it reduces context rot without expanding the language into a larger orchestration shell.

Threaded loops are allowed only when cumulative transcript state is the actual requirement. Examples:

- progressive drafting where each iteration deliberately refines one evolving answer
- a conversational repair loop that depends on the model seeing the previous failed response verbatim

If a loop only needs prior results, those results should flow through variables or artifacts instead of transcript reuse.

## Retries

Retries should default to fresh attempts. The system should preserve the **facts** of the prior failure, but not blindly continue the failed conversation.

The retry bootstrap should therefore carry forward:

- the failing step identity
- structured failure details
- any surviving artifacts or outputs
- retry budget and policy

It should not carry forward the entire failing transcript unless retry mode is explicitly threaded.

This default makes retries a genuine second attempt rather than a continuation of the same local trap. It also makes retry behavior easier to evaluate because the runtime can distinguish:

- failures that recover under a clean restart
- failures that require conversational continuity to recover

## Spawned children

Spawned work should remain fresh by default and by design. This is already aligned with the current subagent-first boundary: a child is a bounded worker with its own session and state directory, not a second speaker in the same conversation.

The parent may pass deterministic bootstrap state into the child, but that is not the same as transcript inheritance. A child should receive:

- explicit task instructions
- selected parent variables and artifacts
- applicable profile/tool policy
- any runtime-generated bootstrap summary

The child should not silently receive the parent's entire conversational history.

This note does not approve a threaded-child mode. If future work wants same-thread child semantics, that is a category change and should be reviewed separately because it pressures the runtime toward peer coordination rather than bounded delegation.

## Default behavior summary

The default runtime policy should therefore be:

- ordinary sequential steps: threaded
- loop iterations: fresh
- retries: fresh
- spawned children: fresh

The practical heuristic is simple:

> Reuse transcript state only when conversational continuity is the requirement. Otherwise, reset the session and pass only explicit workflow state.

## Explicit opt-ins and non-goals

Allowed explicit opt-ins:

- `fresh` for an ordinary step
- `threaded` for a loop
- `threaded` for a retry

Non-goals for this design:

- defining final DSL syntax for these controls
- making spawned children implicitly threaded
- using fresh-context policy as a back door to orchestration-shell UX claims
- replacing variables, artifacts, or child imports with transcript inheritance as the main state-passing mechanism

The syntax may evolve later, but the semantic contract should stay stable even if the surface spelling changes.

## Evaluation implications

This policy exists partly so future evaluation work can compare modes honestly instead of arguing from anecdotes.

Required evaluation consequences:

- smoke and eval assets must record whether a unit ran in `fresh` or `threaded` mode
- comparisons must hold the task, tooling, and bootstrap inputs constant while varying only the session-boundary policy
- loop, retry, and child-task benchmarks should be separated from ordinary sequential-step benchmarks because their defaults differ
- results should report both quality and cost, including pass rate, retry count, token/latency overhead, and failure-recovery behavior

The main questions for the future fresh-vs-threaded evaluation slice are:

1. Do fresh loop iterations reduce contamination and improve consistency?
2. Do fresh retries recover more often than threaded retries on the same failure class?
3. Do threaded ordinary steps outperform fresh ones when continuity is genuinely part of the task?
4. Does child isolation improve quality enough to justify the extra bootstrap overhead?

That evaluation work belongs in the follow-up suite tracked by `prompt-language-r8vp.8`, but it depends on this policy staying explicit. Without a written default/opt-in contract, future smoke and parity results would mix different session semantics and become hard to trust.

## Consequences

What this clarifies:

- fresh context is a runtime boundary decision, not a vague prompt-writing preference
- prompt-language can import fresh-session ideas from Archon and Agent Loom without importing their broader orchestration shell
- bootstrap state, not transcript inheritance, is the durable handoff mechanism across fresh boundaries

What this constrains:

- loop and retry behavior should not silently inherit prior transcript state by default
- step-level freshness must be explicit rather than globally forced
- spawned work should stay isolated unless a later architecture decision deliberately reopens that boundary
