# Context-Adaptive Rendering Research Plan

## Status

Research / tracked-next support document. Not a shipped feature description.

## Problem

Prompt-language likely re-renders more state than necessary on ordinary turns. The project should test whether a compact, canonical renderer can reduce prompt churn and improve runtime efficiency without weakening determinism, recovery, or gate-driven correctness.

## Hypotheses

### H1 — Canonical rendering reduces incidental churn

If equivalent state is rendered canonically, repeated ordinary turns should exhibit lower prompt volatility than the current implementation.

### H2 — Compact rendering reduces bytes per turn

If rendering is limited to current-path state, relevant variables, and compact gate/output summaries, bytes per turn should fall materially on representative flows.

### H3 — Compact rendering can remain recovery-safe

If risky states automatically escalate to full mode, compact rendering should not materially regress resume/compaction/recovery behavior.

### H4 — Render reductions may not fully translate to latency wins

Even if render bytes improve, total wall-clock gains may be modest because hook startup, state I/O, and gate execution may dominate.

## Failure conditions

Reject or pause the program if:

- gate-heavy correctness regresses
- compact mode weakens recovery
- prompt-byte gains do not translate into meaningful practical benefit
- implementation complexity becomes larger than the measured win

## Required metrics

- prompt bytes per hook invocation
- total rendered bytes per flow run
- stable vs changing bytes
- variable count injected per turn
- output bytes injected per turn
- hook startup time
- state file read/write time
- gate execution time
- wall-clock time
- total turn count
- fallback-to-full count
- recovery incidents

## Fixture categories

- gate-heavy fix loops
- long sequential flows
- prompt capture / ask-like flows
- spawn/await flows
- large-output scenarios
- resume/compaction recovery scenarios

## Output

Results should be published to `docs/eval/context-adaptive-rendering-results.md` with the same honesty standard used elsewhere in the project: wins, ties, losses, and regressions all reported.
