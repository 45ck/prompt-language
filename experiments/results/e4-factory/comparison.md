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
- [A02 scorecard](./A02-crm-http-headless/scorecard.json)
- [A02 trace summary](./A02-crm-http-headless/trace-summary.md)

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
- [A03 scorecard](./runs/20260412-0916-a03-core-proof-prebootstrapped/scorecard.json)
- [A03 trace summary](./runs/20260412-0916-a03-core-proof-prebootstrapped/trace-summary.md)

### A04: `20260412-1005-a04-core-proof-sequential`

- `prompt-language` sequential lane: partial failure

Meaning:

- removing `spawn` and `await` did not eliminate runner instability on Windows
- the sequential runner advanced far enough to produce most of the bounded slice, but failed before
  clean completion

Primary evidence:

- [A04 outcome](./runs/20260412-1005-a04-core-proof-sequential/outcome.md)
- [A04 postmortem](./runs/20260412-1005-a04-core-proof-sequential/postmortem.md)
- [A04 scorecard](./runs/20260412-1005-a04-core-proof-sequential/scorecard.json)
- [A04 trace summary](./runs/20260412-1005-a04-core-proof-sequential/trace-summary.md)

### A05: `20260412-1047-a05-core-proof-sequential-patched`

- `prompt-language` sequential lane: success

Meaning:

- the patched sequential lane completed the same bounded CRM core slice that A04 could not close
- the main A04 failure mode was runner/runtime reliability, not prompt-language expressiveness

Primary evidence:

- [A05 outcome](./runs/20260412-1047-a05-core-proof-sequential-patched/outcome.md)
- [A05 postmortem](./runs/20260412-1047-a05-core-proof-sequential-patched/postmortem.md)
- [A05 scorecard](./runs/20260412-1047-a05-core-proof-sequential-patched/scorecard.json)
- [A05 trace summary](./runs/20260412-1047-a05-core-proof-sequential-patched/trace-summary.md)

### A06: `20260412-1407-a06-core-proof-paired-clean`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- this is the first patched paired clean run driven from the frozen bootstrap seed with lane-appropriate artifact contracts
- comparative verdict: `mixed`
- throughput admissible: false

Primary evidence:

- [A06 outcome](./runs/20260412-1407-a06-core-proof-paired-clean/outcome.md)
- [A06 postmortem](./runs/20260412-1407-a06-core-proof-paired-clean/postmortem.md)
- [A06 scorecard](./runs/20260412-1407-a06-core-proof-paired-clean/scorecard.json)
- [A06 trace summary](./runs/20260412-1407-a06-core-proof-paired-clean/trace-summary.md)

### A07: `a07-e4-b01-s0-clean-gpt52-pilot-p01-s0-clean-codex-first`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-throughput-s0-external-verification`
- batch: `e4-b01-s0-clean-gpt52-pilot` pair `p01`
- comparative verdict: `mixed`
- throughput admissible: false

Primary evidence:

- [A07 outcome](./runs/a07-e4-b01-s0-clean-gpt52-pilot-p01-s0-clean-codex-first/outcome.md)
- [A07 postmortem](./runs/a07-e4-b01-s0-clean-gpt52-pilot-p01-s0-clean-codex-first/postmortem.md)
- [A07 scorecard](./runs/a07-e4-b01-s0-clean-gpt52-pilot-p01-s0-clean-codex-first/scorecard.json)
- [A07 trace summary](./runs/a07-e4-b01-s0-clean-gpt52-pilot-p01-s0-clean-codex-first/trace-summary.md)
- [A07 batch summary](./batches/e4-b01-s0-clean-gpt52-pilot/summary.md)

## Current Interpretation

The evidence now supports five claims:

1. `prompt-language` can successfully drive a bounded software-factory slice.
2. Early failures were dominated by runner/setup issues, not by inability to specify the software
   slice.
3. The Windows/headless runtime path needed explicit fixes around state-root resolution, run-node
   timeout behavior, and Codex process launch / cleanup.
4. After those fixes, the sequential prompt-language lane also completed successfully.
5. The latest clean `S0` pilot pair (`A07`) under the tighter external-verification timing envelope still favors direct Codex on time-to-green for this bounded slice, while prompt-language retains the stronger governed factory-control surface and an earlier first relevant workspace write on the secondary exploratory metric.

For the deeper comparative interpretation, see [research-method.md](./research-method.md) and
[analysis-2026-04-12.md](./analysis-2026-04-12.md).

Throughput note:

- no current run is admissible for a stable throughput-superiority claim
- `A07` is paired and timed on the same common product contract, but throughput claims stay provisional until the counterbalanced batch summary says otherwise
- the current pilot batch is `n=1`, so it is useful for instrument validation and directional timing only
- continue the planned counterbalanced batch before making a stronger throughput claim
