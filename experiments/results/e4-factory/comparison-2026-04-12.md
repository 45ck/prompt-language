# Comparison Snapshot

Date: 2026-04-12

## Bounded CRM Core

### A02: `A02-crm-http-headless`

- `prompt-language` HTTP lane: failed early

Meaning:

- this was an early headless CRM HTTP attempt, not a clean capability comparison
- the run failed in runtime/setup plumbing before it could produce a comparable bounded product slice

Primary evidence:

- [A02 outcome](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/A02-crm-http-headless/outcome.md:1)
- [A02 postmortem](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/A02-crm-http-headless/postmortem.md:1)
- [A02 scorecard](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/A02-crm-http-headless/scorecard.json:1)

### A03: `20260412-0916-a03-core-proof-prebootstrapped`

- `prompt-language` multi-agent lane: success
- direct Codex lane: success

Meaning:

- the bounded CRM core slice can be built successfully with `prompt-language`
- the bounded CRM core slice can also be built successfully without `prompt-language`
- the main difference in this run was operational quality of the runner and evidence capture, not end-state capability

Primary evidence:

- [A03 outcome](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-0916-a03-core-proof-prebootstrapped/outcome.md:1)
- [A03 scorecard](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-0916-a03-core-proof-prebootstrapped/scorecard.json:1)

### A04: `20260412-1005-a04-core-proof-sequential`

- `prompt-language` sequential lane: partial failure

Meaning:

- removing `spawn` and `await` did not eliminate runner instability on Windows
- the sequential runner advanced far enough to produce most of the bounded slice, but failed before clean completion and left orphaned child processes

Primary evidence:

- [A04 outcome](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-1005-a04-core-proof-sequential/outcome.md:1)
- [A04 postmortem](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-1005-a04-core-proof-sequential/postmortem.md:1)
- [A04 scorecard](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-1005-a04-core-proof-sequential/scorecard.json:1)

### A05: `20260412-1047-a05-core-proof-sequential-patched`

- `prompt-language` sequential lane: success

Meaning:

- after the runtime fixes, the sequential prompt-language lane completed the bounded CRM core slice
- the main A04 failure mode was runner/runtime reliability, not inability to express the factory
  slice in prompt-language

Primary evidence:

- [A05 outcome](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-1047-a05-core-proof-sequential-patched/outcome.md:1)
- [A05 postmortem](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-1047-a05-core-proof-sequential-patched/postmortem.md:1)
- [A05 scorecard](/D:/Visual%20Studio%20Projects/prompt-language/experiments/results/e4-factory/runs/20260412-1047-a05-core-proof-sequential-patched/scorecard.json:1)

## Current Interpretation

The evidence now supports five claims:

1. `prompt-language` can successfully drive a bounded software-factory slice.
2. Early failures were dominated by runner/setup issues, not by inability to specify the product.
3. The Windows/headless runtime path needed explicit fixes around state-root resolution, run-node timeout behavior, and Codex process launch / cleanup.
4. After those fixes, the sequential prompt-language lane also completed successfully.
5. The first clean paired timed run now shows a raw timing read that favors direct Codex on time-to-green for the bounded CRM core, while prompt-language remains stronger on governed control and closure artifacts and reached first code earlier.

Throughput note:

- no current run is admissible for a stable throughput-superiority claim
- `A06` is the first paired patched run with lane-appropriate artifact contracts, explicit timings,
  and complete raw traces, but it is still a single fixed-order pair
- provisional raw timing read: `codex-alone` reached green faster, while `prompt-language`
  reached first code earlier
- sample size is still `n=1`, so the repo still needs repeated clean pairs before claiming stable
  superiority in either direction
