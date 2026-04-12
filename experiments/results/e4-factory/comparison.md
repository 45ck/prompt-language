# E4 Comparison

Date: 2026-04-12

## Runs

### A02: `A02-crm-http-headless`

- `prompt-language` HTTP lane: failed early

Meaning:

- this was an early headless CRM HTTP attempt, not a clean capability comparison
- the run failed in runtime/setup plumbing before it could produce a comparable bounded product slice

Primary evidence:

- [A02 outcome](./A02-crm-http-headless/outcome.md)
- [A02 postmortem](./A02-crm-http-headless/postmortem.md)

### A03: `20260412-0916-a03-core-proof-prebootstrapped`

- `prompt-language` multi-agent lane: success
- direct Codex lane: success

Meaning:

- the bounded CRM core slice can be built successfully with `prompt-language`
- the bounded CRM core slice can also be built successfully without `prompt-language`
- the main difference in this run was operational quality of the runner and evidence capture, not
  end-state capability

Primary evidence:

- [A03 outcome](./runs/20260412-0916-a03-core-proof-prebootstrapped/outcome.md)
- [A03 postmortem](./runs/20260412-0916-a03-core-proof-prebootstrapped/postmortem.md)

### A04: `20260412-1005-a04-core-proof-sequential`

- `prompt-language` sequential lane: partial failure

Meaning:

- removing `spawn` and `await` did not eliminate runner instability on Windows
- the sequential runner advanced far enough to produce most of the bounded slice, but failed before
  clean completion

Primary evidence:

- [A04 outcome](./runs/20260412-1005-a04-core-proof-sequential/outcome.md)
- [A04 postmortem](./runs/20260412-1005-a04-core-proof-sequential/postmortem.md)

### A05: `20260412-1047-a05-core-proof-sequential-patched`

- `prompt-language` sequential lane: success

Meaning:

- the patched sequential lane completed the same bounded CRM core slice that A04 could not close
- the main A04 failure mode was runner/runtime reliability, not prompt-language expressiveness

Primary evidence:

- [A05 outcome](./runs/20260412-1047-a05-core-proof-sequential-patched/outcome.md)
- [A05 postmortem](./runs/20260412-1047-a05-core-proof-sequential-patched/postmortem.md)

## Current Interpretation

The evidence now supports four claims:

1. `prompt-language` can successfully drive a bounded software-factory slice.
2. Early failures were dominated by runner/setup issues, not by inability to specify the software
   slice.
3. The Windows/headless runtime path needed explicit fixes around state-root resolution, run-node
   timeout behavior, and Codex process launch / cleanup.
4. After those fixes, the sequential prompt-language lane also completed successfully.
