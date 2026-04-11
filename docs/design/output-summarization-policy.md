# Output Summarization Policy

- Status: accepted design target
- Scope: `prompt-language-0ovo.4.1`
- Related:
  - [Canonical Render Spec](canonical-render-spec.md)
  - [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md)
  - [Compact-Mode Fallback Matrix](compact-mode-fallback-matrix.md)
  - [Summary and Rendering Policy](../reference/summary-and-rendering-policy.md)

## Purpose

Define one concrete policy for summary-oriented render surfaces so implementation, operator guidance, and tests all use the same thresholds and fail-closed rules.

This note covers summary outputs only. It does not redefine the canonical full render described in [Canonical Render Spec](canonical-render-spec.md).

## Problem

Prompt-language now has multiple output surfaces with different size and fidelity needs:

- the full render, which remains the correctness baseline
- compact and summary surfaces, which exist to reduce prompt churn and operator noise
- completion-style summaries, which need to be readable and deterministic without hiding risk

Without a single policy, summary helpers drift into ad hoc truncation, inconsistent redaction, or unsafe omission during recovery-sensitive turns.

## Policy goals

- Preserve deterministic summary formatting for equivalent state.
- Keep raw and full-fidelity paths available at all times.
- Bound summary size using explicit thresholds rather than best-effort prose.
- Prevent summary output from masking risk, capture state, pending gates, or recovery uncertainty.
- Prevent accidental exposure of oversized or sensitive command output in short-form surfaces.

## Summary surfaces covered

This policy applies to summary-oriented outputs such as:

- render summaries intended for compact re-injection
- completion summaries intended for final or terminal operator-facing output
- short status blocks that summarize state rather than fully render it

It does not apply to:

- the canonical multiline full render
- raw artifacts or future artifact storage
- append-only run history or event-log payloads

## Core policy

### 1. Full render remains authoritative

Summary output is a derived projection, not a second source of truth.

Rules:

- Every summary surface must have a raw/full counterpart.
- When summary output would hide execution-critical state, the runtime must fall back to full mode instead of inventing a thinner summary.
- No summary surface may become the only path to inspect warnings, gates, capture state, or failure reason.

### 2. Deterministic block format

For equivalent state, the summary block must be byte-stable.

Minimum ordering guarantees:

- fixed section order
- canonical variable ordering by key when variables are shown
- stable omission rules
- no timestamps or host-derived randomness in the block itself

### 3. Thresholds

Summary-oriented outputs must use these concrete limits.

| Field or block                       | Policy                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| Header line                          | Always include goal and status                           |
| Summary body target                  | At most 12 logical lines                                 |
| Summary body hard limit              | At most 900 characters before final fallback decision    |
| Individual diagnostic / warning line | Truncate to 160 characters                               |
| Variable value shown in a summary    | Truncate to 120 characters                               |
| Embedded stdout / stderr excerpt     | At most 120 characters, single-line normalized           |
| Counted warnings shown inline        | At most 3 warnings before collapse to `N warnings`       |
| Counted diagnostics shown inline     | At most 3 diagnostics before collapse to `N diagnostics` |
| Counted variables shown inline       | At most 8 visible variables before elision               |

If the summary block still exceeds either the line or byte limit after normal truncation and elision, the renderer must stop compressing semantically important sections and instead switch to the fallback behavior defined below.

### 4. Redaction and omission constraints

Summary surfaces must not inline raw high-volume command output unless the output is already represented as a bounded excerpt.

Always exclude or collapse:

- raw `last_stdout`
- raw `last_stderr`
- large multiline command output
- more than one excerpt per failing command or diagnostic
- opaque payload blobs that exceed the variable-value limit

Summary surfaces must preserve visibility of:

- overall status
- failure reason when present
- capture-in-progress state
- pending or failed gates
- review rejection or approval-denial outcomes
- explicit warnings and diagnostics, even if counted or truncated

Summary surfaces must not claim to have redacted secrets safely unless the runtime is using explicit secret classification. Until such classification exists, the rule is conservative omission:

- prefer omission or short bounded excerpts over full echoing
- do not restate environment-variable payloads, token-looking strings, or arbitrary command output in full
- when in doubt, show that output exists and point operators to the full/raw path instead of expanding it

### 5. Fallback and disable conditions

Summary output must be disabled for any turn where summarization would make the execution state materially less trustworthy.

At minimum, disable summary mode and fall back to full mode when any of the following are true:

- the state is being resumed or recovered
- host compaction or rehydration boundary is active
- the current step is ambiguous
- a gate is pending, stale, inconsistent, or partially recovered
- prompt capture or structured capture recovery is active
- parent/child `spawn` / `await` recovery is active
- imported flow resolution is uncertain
- explicit debug or inspect mode requests full visibility
- the summary block exceeds hard limits even after safe truncation

These conditions align with the fail-closed rules in [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md) and [Compact-Mode Fallback Matrix](compact-mode-fallback-matrix.md).

### 6. Operator guidance contract

When a summary surface is used, operators must still be able to tell:

- that they are seeing a summary rather than the full render
- whether the summary was used normally or after a fallback decision
- where to look next when detail is omitted

Minimum operator-facing guidance:

- identify the surface as a summary or compact summary
- preserve the top-level status and any blocking reason
- surface count-based collapse honestly, for example `3 warnings` or `8 variables shown`
- tell the operator when full mode was forced instead of compact summary

## Recommended summary block shape

The recommended order is:

1. header
2. current-step or terminal-status line
3. optional gate line
4. optional diagnostic / warning lines
5. optional bounded variable snapshot
6. optional explicit note that full detail remains available elsewhere

Recommended examples:

```text
[prompt-language] Summary: fix auth retry | Status: active
Current: prompt "re-run focused auth tests"
Gates: tests_pass [pending], lint_pass [pass]
Warnings: 1 warning
Variables: module=auth, retries=2, command_failed=true
```

```text
[prompt-language] Summary: release prep | Status: failed
Failed: npm test exited non-zero
Diagnostics: 2 warnings, 1 blocking diagnostic
Full detail required on this turn; compact summary suppressed.
```

## Non-goals

This policy does not:

- define artifact persistence or raw-output storage
- define a durable secret-redaction engine
- replace the full renderer as the canonical state view
- allow compact summaries to continue through recovery-sensitive turns

## Acceptance target

This design slice is closable when:

- summary thresholds are concrete and documented
- redaction and omission rules are explicit
- fallback and disable conditions are explicit
- operator guidance is explicit
- the relevant reference and index pages link to the policy
