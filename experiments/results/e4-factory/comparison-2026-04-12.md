# Comparison Snapshot

Date: 2026-04-12

## Bounded CRM Core

### A03: `20260412-0916-a03-core-proof-prebootstrapped`

- `prompt-language` multi-agent lane: success
- direct Codex lane: success

Meaning:

- the bounded CRM core slice can be built successfully with `prompt-language`
- the bounded CRM core slice can also be built successfully without `prompt-language`
- the main difference in this run was operational quality of the runner and evidence capture, not end-state capability

Primary evidence:

- [A03 outcome](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-0916-a03-core-proof-prebootstrapped/outcome.md:1)

### A04: `20260412-1005-a04-core-proof-sequential`

- `prompt-language` sequential lane: partial failure

Meaning:

- removing `spawn` and `await` did not eliminate runner instability on Windows
- the sequential runner advanced far enough to produce most of the bounded slice, but failed before clean completion and left orphaned child processes

Primary evidence:

- [A04 outcome](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-1005-a04-core-proof-sequential/outcome.md:1)

## Current Interpretation

The evidence now supports three claims:

1. `prompt-language` can successfully drive a bounded software-factory slice.
2. The current Windows/headless runtime path is still unreliable, especially around process launch, prompt-runner failure handling, and completion reporting.
3. A failed sequential run is not enough to disprove the factory idea, because a successful prompt-language run already exists for the same bounded slice.
