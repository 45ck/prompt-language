# Context-Adaptive Recovery Fallback

- Status: accepted design target
- Scope: `prompt-language-0ovo.5`
- Related work:
  - `docs/adr/ADR-00XX-context-adaptive-rendering.md`
  - `docs/evaluation/context-adaptive-rendering-results-template.md`
  - `docs/roadmap.md`

## Purpose

Define the recovery-safe fallback policy for the context-adaptive rendering program so later implementation slices have a stable contract.

This note does not claim compact mode, fallback automation, or recovery-path coverage are already shipped. It defines the behavior required before compact rendering can be treated as more than an experimental optimization.

## Problem statement

Prompt-language currently treats full-state rendering as the deterministic recovery baseline. That baseline preserves exact current-step awareness, gate trust semantics, and resume safety, but it may inject more context than necessary on ordinary turns.

The context-adaptive rendering program exists to measure whether a compact mode can reduce prompt churn without weakening:

- resume and restore behavior
- compaction safety
- debugging visibility
- spawn and await recovery
- gate and capture correctness

The failure mode to avoid is silent degradation: compact mode must never proceed through a risky recovery path without either escalating to full mode or failing clearly.

## Design principles

- Full mode remains the correctness baseline until evaluation proves otherwise.
- Compact mode is an optimization, not a second source of truth.
- Recovery-sensitive paths fail closed toward more context, not less.
- Escalation must be automatic and observable.
- Trigger definitions, runtime behavior, and tests must share the same vocabulary.
- Debuggability beats prompt-size savings whenever the two conflict.

## Delivery boundary

This epic is split into three dependent slices:

1. Fallback trigger matrix
2. Automatic full-mode escalation
3. Recovery-path tests

The implementation order matters. Tests are expected to validate the same trigger categories and escalation semantics defined here.

## Current repo posture

What exists today:

- full-state rendering is the documented recovery baseline
- context-adaptive rendering is tracked as WIP
- evaluation planning already expects fallback counts and recovery outcomes

What is not yet established as shipped behavior:

- a canonical compact-mode trigger matrix
- automatic runtime escalation to full mode
- direct recovery-path test coverage for compact mode across resume and compaction boundaries

This note therefore defines the contract for planned work rather than documenting existing runtime guarantees.

## Slice 1: Fallback Trigger Matrix

### Trigger classes

Every compact-mode turn must be classified into one of two states before prompt injection:

- `compact-eligible`: compact rendering may proceed
- `full-required`: runtime must escalate to full rendering for the current turn

There is no third silent state such as "probably safe" or "best effort". If the runtime cannot prove compact eligibility, it must treat the turn as `full-required`.

### Required triggers

The runtime must escalate to full mode when any of the following conditions are present.

| Trigger ID                      | Trigger                                                                                              | Why it forces full mode                                                            | Minimum observable fields                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `resume_boundary`               | Session resumes from persisted state, restored checkpoint, backup state, or interrupted run marker   | Recovery correctness depends on exact state reconstruction, not compressed summary | session id, state source, turn id, prior mode, new mode     |
| `host_compaction_boundary`      | The host agent loop compacted, restarted, or crossed a compaction boundary that requires rehydration | Compact mode must not summarize a summary during recovery                          | compaction marker, hook/event source, prior mode, new mode  |
| `state_shape_mismatch`          | Renderer detects missing fields, version mismatch, malformed state, or unexpected node metadata      | Compact mode cannot safely omit detail when state itself is uncertain              | mismatch kind, schema/version info, affected subsystem      |
| `current_step_ambiguity`        | Runtime cannot determine one exact current node, pending gate, or blocked approval state             | Compact rendering is only safe when exact execution position is known              | ambiguity kind, node ids involved, blocked/unblocked status |
| `gate_uncertainty`              | Gate evaluation is pending, stale, inconsistent, or recovered from partial results                   | Gate trust semantics outrank compactness                                           | gate ids, evaluation freshness, reason                      |
| `capture_recovery`              | Prompt capture, capture-file fallback, or structured capture recovery path is active                 | Capture failures are recovery-sensitive and need maximum visibility                | capture mode, file path if relevant, failure class          |
| `spawn_recovery`                | Child session restore, pending `await`, inbox replay, or child-status mismatch is detected           | Parent/child coordination must be inspectable during recovery                      | child ids, await target, message state summary              |
| `import_resolution_uncertainty` | Imported flow resolution changed, failed, or cannot be proven equivalent to the original run context | A compact render must not hide topology drift                                      | import path, resolution status, fingerprint if available    |
| `debug_or_diagnostic_mode`      | Runtime runs under explicit debug, inspect, validate, replay, or recovery-audit mode                 | Operator intent is visibility, not compression                                     | requested mode, command or hook name                        |
| `manual_force_full`             | User, config, or runtime policy explicitly requests full mode                                        | Explicit policy wins                                                               | policy source, previous mode, new mode                      |

### Optional future triggers

The following may become triggers later, but are not part of the minimum contract until separately accepted:

- token-budget heuristics by themselves
- prompt-length thresholds by themselves
- model-specific quirks not expressed as recovery risk
- performance-only switching

Those can influence compact eligibility later, but they must not weaken the fail-closed rules above.

### Trigger precedence

- Any single `full-required` trigger is sufficient to escalate.
- Multiple triggers may fire on the same turn; observability must preserve all of them.
- Recovery triggers take precedence over optimization heuristics.
- Explicit full-mode requests take precedence over any compact eligibility signal.

## Slice 2: Automatic Full-Mode Escalation

### Runtime contract

When compact mode is requested but a `full-required` trigger is present, the runtime must:

1. suppress compact rendering for that turn
2. render the turn in full mode
3. record the escalation cause in diagnostics or structured telemetry
4. continue execution without requiring manual intervention unless the underlying state is itself invalid

The runtime must not:

- continue in compact mode after identifying a `full-required` trigger
- silently downgrade observability
- require operators to infer escalation from prompt size alone

### Escalation scope

The default escalation scope is `turn-local`:

- the risky turn escalates to full mode immediately
- subsequent turns may return to compact mode only after re-evaluating eligibility from current state

The runtime may later add stickier policies such as "stay full until run end" or "stay full until next checkpoint", but those are not required for the first implementation. If a sticky policy is added later, it must still report the original trigger and the current forced-full reason separately.

### Invalid-state behavior

Some triggers indicate recoverable uncertainty. Others indicate broken state. The policy split is:

- if the state can still be rendered and executed with full fidelity, escalate to full mode and continue
- if the state is not trustworthy enough even for full rendering, fail clearly with diagnostics rather than inventing a compact or partial fallback

This prevents compact mode from becoming a masking layer for deeper runtime corruption.

### Observability requirements

Every escalation event must be visible through at least one operator-facing path and one machine-readable path.

Minimum operator-facing requirements:

- surfaced in hook or CLI diagnostics for the affected turn
- includes that full mode was forced
- includes the trigger id or a stable human-readable equivalent

Minimum machine-readable requirements:

- render mode requested
- render mode used
- escalation boolean
- trigger ids array
- turn/session identifier
- recovery-context metadata when present

Recommended additional fields:

- checkpoint or backup source identifier
- child session ids
- gate ids
- compaction event marker
- import fingerprint mismatch detail

### Metrics expectations

Evaluation and runtime telemetry should be able to answer:

- how often compact mode was requested
- how often it was actually used
- how often fallback/escalation occurred
- which triggers dominate fallback volume
- whether escalated turns later resumed compact mode successfully
- whether escalation correlates with improved recovery success

The existing evaluation template already includes `fallback count`; implementations should extend that to trigger-category counts rather than a single opaque total.

## Slice 3: Recovery-Path Tests

### Goal

Prove that compact mode does not hide or weaken recovery behavior across the risky paths named in the trigger matrix.

### Test matrix expectations

The recovery-path test suite must cover, at minimum, these scenario families.

| Scenario family                                  | Compact requested | Expected result                                                           |
| ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------- |
| interrupted run resume                           | yes               | full-mode escalation with explicit `resume_boundary` signal               |
| restore from backup state                        | yes               | full-mode escalation and preserved current-step visibility                |
| host compaction / rehydrate boundary             | yes               | full-mode escalation with compaction marker retained                      |
| gate pending or stale during recovery            | yes               | full-mode escalation; no silent gate omission                             |
| capture-file fallback after prompt capture issue | yes               | full-mode escalation; failure details remain visible                      |
| spawn/await restore with pending child work      | yes               | full-mode escalation; child and await status remain inspectable           |
| imported flow uncertainty on resumed run         | yes               | full-mode escalation or explicit failure if state is invalid              |
| explicit debug / inspect mode                    | yes               | full mode used immediately, no compact attempt                            |
| clean ordinary active turn with no triggers      | yes               | compact mode allowed, no escalation emitted                               |
| irrecoverably invalid state                      | yes               | explicit failure, not compact rendering and not silent best-effort output |

### Assertions

Tests should assert all of the following where relevant:

- requested mode versus actual mode
- exact trigger id or trigger classification
- preservation of current-step identity
- preservation of blocked state such as pending gates or approvals
- visibility of recovery metadata in diagnostics or reports
- absence of silent compact-mode continuation after trigger detection

### Fixture expectations

The suite should reuse or extend the same fixture categories already planned for render-mode evaluation:

- gate-heavy fix loops
- long sequential flows
- prompt-capture flows
- spawn and await flows
- large-output scenarios where recovery still matters
- resume and compaction scenarios

Recovery-path tests are not a substitute for the broader full-vs-compact evaluation harness. They are the safety gate that must pass before comparative rollout evidence is considered meaningful.

### Shared vocabulary rule

The tests, runtime diagnostics, and trigger matrix must use the same stable trigger ids. Do not let tests assert ad hoc strings while the runtime emits unrelated terminology.

## Explicit non-goals

This epic does not:

- declare compact mode production-ready by default
- replace the full renderer as the canonical recovery surface
- define user-facing DSL syntax for selecting fallback policy
- optimize for token savings at the expense of recovery visibility
- treat ordinary prompt-length pressure alone as a recovery trigger
- redesign checkpointing, backup-state storage, or event-log architecture
- promise that all future heuristics will be automatic without further review

## Acceptance contract

This design note is satisfied only when later implementation proves all of the following:

- the runtime has one documented trigger matrix shared by docs, code, and tests
- compact mode escalates automatically to full mode whenever any `full-required` trigger fires
- escalations are observable to operators and measurable in structured outputs
- recovery-path tests cover resume, compaction, capture, gates, spawn/await, imports, and invalid-state handling
- compact mode never remains active silently on a recovery-sensitive turn

## Open questions for implementation follow-up

- Whether escalation should remain strictly turn-local or become sticky until a safe checkpoint is crossed
- Which exact operator surfaces should carry escalation detail first: hook stderr, status commands, session reports, or all of them
- Whether import-resolution uncertainty should compare file paths only or stronger fingerprints
- Whether any trigger should escalate an entire resumed session into full mode for its remainder

These are implementation-shaping questions, not reasons to weaken the fail-closed contract above.
