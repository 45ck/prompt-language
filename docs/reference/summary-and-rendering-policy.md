# Summary and Rendering Policy

This page documents the concrete policy for summary-oriented render surfaces. Use it when you need the exact thresholds, omission rules, and fallback conditions for compact or summary output.

For the canonical full multiline renderer, see [Canonical Render Spec](../design/canonical-render-spec.md). For the design rationale behind this policy, see [Output Summarization Policy](../design/output-summarization-policy.md).

## What this page covers

This page covers short-form summary outputs such as:

- compact summary blocks
- terminal completion summaries
- other bounded summary surfaces that intentionally do not show the full render

It does not cover:

- the canonical full render
- raw command output storage
- artifact persistence or future artifact storage

## Summary policy

### Full render remains available

Summary output is a derived view. It must never replace the full render as the authoritative state view.

Practical rule:

- use summary surfaces for brevity
- use the full render whenever you need exact step position, full warning detail, full gate context, or recovery-sensitive state

### Concrete thresholds

Summary surfaces use these limits.

| Item                                  | Limit                                  |
| ------------------------------------- | -------------------------------------- |
| Summary body                          | 12 logical lines target                |
| Summary body hard cap                 | 900 characters                         |
| Warning or diagnostic line            | 160 characters                         |
| Variable value displayed in summary   | 120 characters                         |
| Embedded stdout / stderr excerpt      | 120 characters, normalized to one line |
| Inline warnings before count collapse | 3                                      |
| Inline diagnostics before collapse    | 3                                      |
| Inline variables before elision       | 8                                      |

If these limits are exceeded after safe truncation and elision, the summary surface should not keep compressing important state. It should fall back to the full render for that turn.

## Redaction and omission rules

Summary surfaces should prefer omission or bounded excerpts over full echoing of volatile output.

Always exclude or collapse:

- raw `last_stdout`
- raw `last_stderr`
- large multiline command output
- oversized JSON or blob-like payloads
- more than one short excerpt per failing command or diagnostic

Always preserve visibility of:

- overall status
- failure reason when present
- pending or failed gates
- capture-in-progress state
- warnings and diagnostics
- review rejection and approval denial outcomes

## Fallback and disable conditions

Summary output must be suppressed and full render used instead when any of these conditions apply:

- resume or recovery boundary
- host compaction or rehydration boundary
- current-step ambiguity
- pending, stale, or uncertain gate state
- prompt capture or structured capture recovery
- `spawn` / `await` recovery or child-status ambiguity
- imported-flow resolution uncertainty
- explicit debug or inspect mode
- summary hard-cap overflow after safe truncation

These are fail-closed rules. If the runtime cannot prove summary safety, it should use the full render.

## Operator guidance

When you see a summary surface:

- treat it as a quick projection, not the full execution record
- trust it for high-level state only when no fallback conditions are active
- switch to the full render when gates, capture, recovery, or child coordination are involved

Recommended operator habits:

1. Use summary surfaces for ordinary active turns and terminal overviews.
2. Use the full render when the flow is blocked, failed, resumed, or mid-recovery.
3. Treat count-collapsed sections such as `3 warnings` as a signal to inspect the fuller surface.

## Related

- [Defaults and Limits](defaults-and-limits.md)
- [Gates](gates.md)
- [Runtime Variables](runtime-variables.md)
- [CLI Reference](cli-reference.md)
- [Canonical Render Spec](../design/canonical-render-spec.md)
- [Output Summarization Policy](../design/output-summarization-policy.md)
