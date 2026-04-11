# Design: Compact-Mode Fallback Matrix

## Status

Design-and-test note for `prompt-language-0ovo.5.1` only.

This file defines the compact-to-full escalation matrix for recovery-sensitive turns. It does not claim that compact mode or automatic fallback is already shipped.

## Scope

Compact mode is allowed only when the runtime can still prove exact execution position, recovery context, and operator-visible diagnostics from current state. When that proof weakens, the renderer must either:

- escalate to full mode for the current turn, or
- fail clearly when even full mode would be based on untrustworthy state

This note is intentionally narrower than [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md). That broader note sets epic-level policy. This matrix names the concrete trigger classes, the fail-closed versus advisory split, and the minimum validation expected for each class.

## Decision

Every turn that requests compact mode must classify trigger signals into one of two classes:

- `fail_closed`: compact mode is not allowed for the turn; runtime must use full mode or emit an explicit failure when state cannot be trusted
- `advisory`: compact mode may continue if no `fail_closed` trigger is active, but the signal must remain observable for evaluation and operator diagnosis

The classification rule is strict:

- any single `fail_closed` trigger forces full mode
- multiple triggers must be recorded together rather than collapsed to one winner
- advisory signals never cancel a fail-closed trigger
- if the runtime cannot classify a recovery-sensitive signal confidently, it must treat it as `fail_closed`

## Fail-Closed Trigger Matrix

| Trigger ID                  | Recovery-sensitive event                                                                                                                      | Required action                                                           | Why compact mode is unsafe                                                                            | Observable evidence                                                                           | Validation expectation                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `resume_boundary`           | Session starts from persisted state, recovered checkpoint, backup state, or interrupted-run marker                                            | Force full mode for the turn                                              | Resume correctness depends on exact step identity and current blocked state, not a compressed summary | resumed tag, session or run id, recovery source, requested mode vs actual mode                | Resume-path tests assert full mode, preserved current-step identity, and visible recovery source                            |
| `compaction_boundary`       | Host compaction, context rehydrate, pre-compact or post-compact boundary, or summary handoff is detected                                      | Force full mode for the turn                                              | Compact mode must not summarize a recovery summary during re-entry                                    | compaction marker, hook/event source, requested mode vs actual mode                           | Compaction tests assert fallback count increments and the compaction marker remains visible                                 |
| `state_mismatch`            | Resume state corruption, schema/version mismatch, malformed node progress, or ambiguous current-node reconstruction                           | Force full mode if state can still be rendered; otherwise fail explicitly | When runtime shape is uncertain, compact mode can hide the mismatch instead of localizing it          | `PLR-004` or equivalent mismatch diagnostic, mismatch kind, affected file or subsystem        | Corruption tests assert either full-mode escalation with diagnostics or explicit failure, never silent compact continuation |
| `blocked_state_uncertainty` | Pending approval, blocked checkpoint, or gate-blocked status cannot be reconstructed exactly                                                  | Force full mode for the turn                                              | Recovery-safe rendering needs the exact blocked reason and next action                                | blocked reason, gate or approval id, whether it can be retried, requested mode vs actual mode | Tests assert blocked state remains visible after resume and is not reduced to a generic summary                             |
| `gate_uncertainty`          | Gate result is pending, stale, partially recovered, or inconsistent with current run state                                                    | Force full mode for the turn                                              | Gate trust semantics outrank prompt savings, especially after interruption                            | gate id, freshness marker, last evaluation time, diagnostic or outcome code                   | Gate-recovery tests assert stale or pending gates stay explicit and compact mode does not omit them                         |
| `capture_failure`           | Prompt capture, capture-file retry, review-judge capture replay, or capture nonce recovery path is active                                     | Force full mode for the turn                                              | Capture recovery needs exact prompt, file path, and retry instruction visibility                      | `PLR-005` or capture retry prompt, capture target path, retry reason                          | Capture tests assert the retry prompt or file path is preserved and full mode is forced                                     |
| `spawn_uncertainty`         | Parent is resuming around `spawn` / `await`, child topology is stale, child status disagrees with parent state, or inbox replay is incomplete | Force full mode for the turn                                              | Parent-child recovery is inspection-heavy; compact mode can hide who is blocking whom                 | child ids, await target, child statuses, topology mismatch marker                             | Spawn/await integration tests assert child and await state remain inspectable after fallback                                |
| `import_uncertainty`        | Imported flow resolution changed, failed, or cannot be proven equivalent to the state the run started with                                    | Force full mode for the turn; fail if import identity cannot be trusted   | Compact mode must not hide topology drift or silently continue on the wrong imported graph            | import path, resolution result, fingerprint or version marker when available                  | Import recovery tests assert equivalent imports continue under full mode and non-equivalent imports fail loudly             |
| `debug_mode`                | Runtime enters debug, inspect, validate, replay, smoke, or recovery-audit mode                                                                | Force full mode immediately                                               | In debug-oriented sessions the operator intent is evidence, not compression                           | requested command or hook mode, requested mode vs actual mode                                 | Debug-mode tests assert compact mode is bypassed entirely and operator-facing diagnostics remain verbose                    |
| `manual_force_full`         | User, config, or runtime policy explicitly requests full mode                                                                                 | Force full mode immediately                                               | Explicit operator policy takes precedence over heuristics                                             | policy source, prior mode, actual mode                                                        | Config and CLI tests assert explicit full-mode requests always win                                                          |

## Advisory Signals

These signals matter for evaluation and operator diagnosis, but they do not require escalation by themselves while state remains trustworthy.

| Trigger ID                 | Advisory event                                                                                   | Why it stays advisory                                                               | Observable evidence                                                       | Validation expectation                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `optional_artifact_gap`    | Optional run-state v2 artifacts are missing while canonical state is still coherent              | Missing convenience artifacts should not block a trustworthy turn on their own      | missing artifact path, fallback-to-canonical-state note                   | Tests assert compact mode may continue while diagnostics identify the missing artifact  |
| `output_pressure`          | Large output, token churn, or prompt-size pressure is high but recovery state is otherwise clean | Performance pressure is not a recovery hazard by itself                             | prompt byte counts, render-mode metrics, fallback count remains unchanged | Evaluation harness tracks bytes and wall-clock without treating this as forced fallback |
| `checkpoint_age_warning`   | Last checkpoint or recovery pointer is old, but current state still resolves cleanly             | Age alone is a warning, not proof of mismatch                                       | checkpoint timestamp, age bucket, warning diagnostic                      | Snapshot and evaluation tests assert warning visibility without forced full mode        |
| `host_degradation_warning` | Non-fatal host or adapter degradation affects observability but not current state correctness    | Warn the operator, but do not escalate unless the degradation makes state uncertain | warning diagnostic, adapter or hook name, retry advice                    | Preflight and diagnostics tests assert warning emission without mode flip               |

Advisory signals must still be counted in telemetry and evaluation output. They are not invisible.

## Escalation Semantics

The first implementation should use turn-local escalation:

1. compact mode is requested
2. trigger classification runs before prompt injection
3. any `fail_closed` trigger forces full mode for that turn
4. the actual mode and trigger ids are recorded
5. the next turn re-evaluates from fresh state

If state is too corrupt to support full rendering safely, the runtime must fail explicitly instead of inventing a partial compact fallback.

## Required Observable Fields

Every fallback event should expose, at minimum:

- requested render mode
- actual render mode
- `escalated: true`
- trigger id array
- current session or run identifier
- current node or blocked-state identifier when available

Recovery-specific events should add the nearest evidence handle available:

- checkpoint or resume source
- compaction event marker
- gate id and freshness data
- capture target path or nonce
- child run ids or await target
- import path and equivalence marker

## Test and Validation Note

The matrix is only useful if runtime behavior and test names share the same vocabulary. The validation bar for this bead is therefore a mapping, not just a list of ideas.

| Scenario family                                    | Trigger IDs that must be exercised                                            | Expected outcome                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| interrupted session resume                         | `resume_boundary`, `blocked_state_uncertainty`                                | Full mode is used; current node, blocked state, and recovery source remain visible               |
| compaction and rehydrate                           | `compaction_boundary`                                                         | Full mode is used; compaction marker survives into diagnostics or evaluation output              |
| corrupted or mismatched state                      | `state_mismatch`                                                              | Runtime escalates to full mode if possible, otherwise fails explicitly with mismatch diagnostics |
| gate recovery after stale or partial evidence      | `gate_uncertainty`                                                            | Full mode is used; gate identity and freshness stay visible                                      |
| capture retry and review-judge replay              | `capture_failure`                                                             | Full mode is used; retry prompt, path, or capture target remains inspectable                     |
| resumed spawn or await topology                    | `spawn_uncertainty`                                                           | Full mode is used; parent-child blocking relationship remains inspectable                        |
| import drift during resumed or recovered run       | `import_uncertainty`                                                          | Full mode is used for equivalent imports; invalid imports fail clearly                           |
| explicit debug or validation sessions              | `debug_mode`, `manual_force_full`                                             | Compact mode is skipped entirely                                                                 |
| healthy ordinary turn                              | advisory only or no triggers                                                  | Compact mode remains allowed and no escalation is emitted                                        |
| optional artifact gaps and non-fatal host warnings | `optional_artifact_gap`, `host_degradation_warning`, `checkpoint_age_warning` | Compact mode may continue, but warnings remain visible and measurable                            |

## Acceptance Fit

This note satisfies `prompt-language-0ovo.5.1` when it gives downstream implementation and test work one stable answer to these questions:

- which recovery-sensitive events force escalation from compact to full mode
- which signals are warnings only
- what evidence should operators or evaluators be able to see for each trigger
- what scenario family must prove each trigger in tests or validation runs

That is the boundary for this bead. Automatic escalation behavior and executable recovery-path coverage belong to the follow-on slices.
