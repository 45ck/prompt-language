# Design: Compact-Mode Fallback Matrix

## Status

Design-note contract for `prompt-language-0ovo.5.1` only.

This note defines the trigger matrix and the shipped runtime-alignment subset for the
`pre-compact` hook path. It does not claim that every trigger family or every runtime surface now
has automatic compact-to-full fallback.

## Purpose

`prompt-language-0ovo.5` is the recovery-safe compact-rendering track. This child bead owns one
thing only: a stable, implementation-ready matrix for deciding when compact rendering is forbidden
and full rendering must take over.

The matrix has to be honest about current repo behavior:

- full rendering is still the canonical execution and recovery surface
- compact rendering exists today as a helper surface, not as the default active-turn renderer
- the repo already proves a few recovery signals, but ordinary active turns still do not have a
  general compact-mode selector

## Current Implementation Reality

As of this note revision, the repo behaves like this:

- `src/application/inject-context.ts` injects `renderFlow(...)` on active turns. That is the
  current execution baseline.
- `src/presentation/hooks/session-start.ts` also uses `renderFlow(...)` on resume/session start and
  re-emits capture prompts from full state.
- `src/application/run-flow-headless.ts` uses full rendering plus a summary, not compact rendering,
  for the headless loop.
- `src/presentation/hooks/pre-compact.ts` is the one shipped place that deliberately uses
  compaction-preservation rendering to survive host compaction.
- `src/infrastructure/adapters/file-state-store.ts` can recover from `.bak` and `.bak2` state files
  and emits `PLR-004` when resume state cannot be trusted.
- Capture retry state is already surfaced through `awaiting_capture` annotations in full render and
  preserved in the pre-compact hook. Capture fallback diagnostics use `PLR-005`.
- `src/presentation/hooks/context-adaptive-mode.ts` now classifies the shipped `pre-compact` path
  with matrix-aligned trigger ids and emits `requestedMode`, `actualMode`, `escalated`, and
  `triggerIds` markers.
- `src/presentation/hooks/pre-compact.ts` now treats the hook itself as a
  `compaction_boundary` trigger and fail-closes to full rendering for the current turn.

What does not exist yet:

- no runtime flag or policy that requests compact mode for ordinary active turns
- no persisted compaction event marker, gate freshness model, import-equivalence fingerprint, or
  sticky fallback policy
- no shipped trigger enforcement yet for `gate_uncertainty`, `blocked_state_uncertainty`,
  `spawn_uncertainty`, `import_uncertainty`, `debug_mode`, or `manual_force_full`

This means the matrix below is partly grounded by shipped `pre-compact` behavior and partly a
forward contract for the remaining trigger families.

## Scope Boundary

This note is intentionally narrower than
[Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md).

That broader note defines epic policy. This note defines the exact trigger classes, the minimum
observable evidence expected for each, and the places where the current repo already provides part
of that evidence.

## Decision

Any future turn that requests compact rendering must classify observed signals into one of two
classes before prompt injection:

- `fail_closed`: compact rendering is forbidden for the turn; runtime must use full rendering or
  fail explicitly if even full rendering would rely on untrustworthy state
- `advisory`: compact rendering may continue only if no `fail_closed` trigger is active

Classification rules:

- any single `fail_closed` trigger forces full rendering
- multiple triggers must be preserved together, not collapsed to a single winner
- advisory triggers never override a `fail_closed` trigger
- if the runtime cannot classify a recovery-sensitive signal confidently, it must treat it as
  `fail_closed`
- `pre-compact.ts` is a special-case preservation hook, not proof that ordinary active turns are
  safe to run compact

## First Implementation Contract

The first implementation should use turn-local escalation:

1. a turn requests compact rendering
2. a trigger classifier inspects current state plus host/hook context
3. if no `fail_closed` trigger is present, compact rendering may proceed
4. if a `fail_closed` trigger is present and state is still trustworthy, render the turn in full
   mode
5. if state is not trustworthy enough even for full rendering, fail explicitly with diagnostics
6. the next turn re-evaluates from fresh state instead of inheriting silent compact eligibility

## Fail-Closed Trigger Matrix

| Trigger ID                  | Recovery-sensitive event                                                                                                          | Current repo evidence                                                                                                                                                                                                                    | Required first implementation behavior                                                                                                                                   | Remaining gap                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `resume_boundary`           | Session resumes from persisted state, backup state, interrupted-run state, or a recovered session snapshot                        | `inject-context.ts` emits a `[resumed from ...]` banner for resumed active flows; `session-start.ts` renders full state from persisted session data; `pre-compact.ts` now emits `resume_boundary` when it renders backup-recovered state | If compact was requested for an ordinary active turn, force full mode for that turn and record that the turn crossed a resume boundary                                   | No ordinary active-turn compact request path exists yet                                                                 |
| `compaction_boundary`       | Host compaction, rehydrate, or summary handoff boundary is active                                                                 | `pre-compact.ts` is the shipped compaction hook and now emits `compaction_boundary` plus forced-full markers on every active compaction turn                                                                                             | Treat compaction/re-entry as recovery-sensitive. Any ordinary turn after such a boundary must fall back to full mode unless a later implementation proves safer behavior | No persisted compaction marker or post-compaction escalation logic exists today outside the hook-local pre-compact path |
| `state_mismatch`            | Resume state is corrupted, malformed, structurally incomplete, or version/schema shape is not trustworthy                         | `file-state-store.ts` recovers from backup and emits `PLR-004` when no valid state remains; `pre-compact.ts` now emits `state_mismatch` for backup recovery, checksum sanitization, and version mismatch                                 | If state can still be rendered safely, force full mode and surface the mismatch; otherwise fail explicitly                                                               | There is still no richer mismatch classifier for blocked-state or gate-specific ambiguity                               |
| `blocked_state_uncertainty` | Pending approval, blocked checkpoint, or blocked gate state cannot be reconstructed exactly                                       | Full rendering already shows approval state and current-node position, but there is no explicit blocked-state recovery classifier                                                                                                        | Force full mode for the turn and surface the exact blocked reason and next action                                                                                        | No explicit runtime signal for “blocked state reconstructed ambiguously” exists yet                                     |
| `gate_uncertainty`          | Gate result is pending, stale, partially recovered, or inconsistent with current run state                                        | Full and compact renderers can show gate pass/fail/unknown, but they do not carry freshness or partial-recovery metadata                                                                                                                 | Force full mode and keep gate identity, freshness, and failure reason visible                                                                                            | Gate freshness, stale detection, and trigger emission are not implemented                                               |
| `capture_failure`           | Prompt capture retry, capture-file recovery, review-judge retry, or capture fallback path is active                               | `render-flow.ts` renders capture retry annotations; `PLR-005` exists; `session-start.ts` and `pre-compact.ts` re-emit retry instructions; `pre-compact.ts` now emits `capture_failure` when capture recovery is live                     | Force full mode for ordinary active turns whenever capture recovery is live; keep retry path and target file visible                                                     | Current trigger enforcement exists only in the pre-compact hook, not in a general active-turn render-mode fallback path |
| `spawn_uncertainty`         | Parent is resuming around `spawn` / `await`, child status disagrees with parent state, or inbox replay/topology cannot be trusted | Renderers already show `spawn` child status and `await` target, but there is no recovery-specific topology check                                                                                                                         | Force full mode and preserve parent-child blocking relationships as inspectable state                                                                                    | No resumed spawn/await recovery classifier or topology checksum exists                                                  |
| `import_uncertainty`        | Imported flow resolution changed, failed, or cannot be proven equivalent to the flow identity the run started with                | No concrete recovery evidence found in the current runtime for resumed import-equivalence checks                                                                                                                                         | Force full mode for equivalent recovered imports; fail explicitly when import identity cannot be trusted                                                                 | Entire trigger family is design-only today                                                                              |
| `debug_mode`                | Runtime enters debug, inspect, validate, replay, smoke, or recovery-audit mode                                                    | Current debug-oriented flows naturally use verbose/full surfaces, but there is no explicit render-mode policy object                                                                                                                     | Bypass compact rendering entirely for these sessions                                                                                                                     | No central render-mode policy or classifier exists                                                                      |
| `manual_force_full`         | User, config, CLI, or runtime policy explicitly requests full rendering                                                           | No explicit full-render policy switch exists in current code                                                                                                                                                                             | Full mode must win immediately and observably                                                                                                                            | Entire trigger family is design-only today                                                                              |

## Advisory Signals

These are warning-class signals. They should remain observable, but they must not force escalation
unless they also imply one of the fail-closed conditions above.

| Trigger ID                 | Advisory event                                                                                       | Current repo evidence                                                                                                   | Required first implementation behavior                                                    | Remaining gap                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| `optional_artifact_gap`    | Optional artifact bundle or convenience state file is missing while canonical state remains coherent | No compact-fallback implementation currently depends on these artifacts                                                 | Keep compact eligible, but emit a warning and evidence handle                             | Design-only today                          |
| `output_pressure`          | Prompt-size pressure or token churn is high while recovery state is otherwise trustworthy            | `renderFlowCompact(...)` and `renderFlowSummary(...)` exist partly to reduce churn, but no policy uses them dynamically | Track as evaluation/telemetry input only; do not treat it as a recovery trigger by itself | No telemetry or policy integration exists  |
| `checkpoint_age_warning`   | Recovery pointer or checkpoint is old but still resolves cleanly                                     | No explicit checkpoint-age signal exists in the current runtime                                                         | Emit warning only; do not force fallback solely from age                                  | Design-only today                          |
| `host_degradation_warning` | Host or adapter degraded observability without making state untrustworthy                            | Hook warnings already exist in places, but not as compact-mode advisory signals                                         | Emit warning and operator guidance without flipping render mode                           | No advisory classification pipeline exists |

Advisory signals are still expected to be visible in evaluation and diagnostics. They are not silent.

## Required Observable Fields

When automatic fallback is implemented, every escalation event should expose at least:

- `requestedMode`
- `actualMode`
- `escalated: true`
- `triggerIds`
- session or run identifier
- current node or blocked-state identifier when available

Recovery-specific events should also add the nearest available evidence handle:

- resume or backup source
- compaction marker
- gate id plus freshness data
- capture target path or nonce
- child run ids or await target
- import path plus equivalence marker

Current repo subset already available today:

- `PLR-004` for unrecoverable resume corruption
- `PLR-005` for capture fallback
- stderr messages for backup recovery
- `[resumed from ...]` on resumed active turns
- capture retry prompt/file-path re-emission
- compact hook render markers for `requestedMode`, `actualMode`, `escalated`, and `triggerIds`
- shipped `pre-compact` trigger ids for `compaction_boundary`, `resume_boundary`,
  `state_mismatch`, and `capture_failure`

Current repo fields not yet available:

- gate freshness metadata
- compaction markers
- import-equivalence evidence

## Validation and Evidence Map

The matrix is only useful if runtime code, diagnostics, and tests use the same vocabulary.

Current evidence already in the repo:

- `src/presentation/hooks/context-adaptive-recovery.test.ts` covers named recovery families for
  `resume_boundary`, `compaction_boundary`, `state_mismatch`, and `capture_failure`
- `src/presentation/hooks/session-start.test.ts` and
  `src/presentation/hooks/user-prompt-submit.test.ts` prove `PLR-004` is surfaced when state is
  unrecoverable
- `src/domain/render-flow.test.ts` proves capture retry state remains visible in rendering

Scenario families still missing executable coverage for this compact-fallback track:

- `gate_uncertainty`
- `blocked_state_uncertainty`
- `spawn_uncertainty`
- `import_uncertainty`
- `debug_mode`
- `manual_force_full`
- advisory-only signal reporting
- ordinary active-turn compact eligibility outside `pre-compact`

## Acceptance Fit

This bead is satisfied at the design-note level when the note gives later implementation and test
work one stable answer to these questions:

- which recovery-sensitive events force compact-to-full fallback
- which signals remain advisory only
- what currently exists in the repo for each trigger family
- what observable evidence the implementation must emit once fallback is real
- which trigger families still need executable runtime and test work

That is the boundary for `prompt-language-0ovo.5.1`. This note should not be used to imply that
compact mode or automatic fallback is already complete.
