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

### A08: `a08-e4-b02-s0-clean-gpt52-primary-p01-s0-clean-codex-first`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-throughput-s0-external-verification`
- batch: `e4-b02-s0-clean-gpt52-primary` pair `p01`
- comparative verdict: `codex-alone-better`
- throughput admissible: false

Primary evidence:

- [A08 outcome](./runs/a08-e4-b02-s0-clean-gpt52-primary-p01-s0-clean-codex-first/outcome.md)
- [A08 postmortem](./runs/a08-e4-b02-s0-clean-gpt52-primary-p01-s0-clean-codex-first/postmortem.md)
- [A08 scorecard](./runs/a08-e4-b02-s0-clean-gpt52-primary-p01-s0-clean-codex-first/scorecard.json)
- [A08 trace summary](./runs/a08-e4-b02-s0-clean-gpt52-primary-p01-s0-clean-codex-first/trace-summary.md)

### A09: `a09-e4-b02-s0-clean-gpt52-primary-p02-s0-clean-pl-first`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-throughput-s0-external-verification`
- batch: `e4-b02-s0-clean-gpt52-primary` pair `p02`
- comparative verdict: `codex-alone-better`
- throughput admissible: false

Primary evidence:

- [A09 outcome](./runs/a09-e4-b02-s0-clean-gpt52-primary-p02-s0-clean-pl-first/outcome.md)
- [A09 postmortem](./runs/a09-e4-b02-s0-clean-gpt52-primary-p02-s0-clean-pl-first/postmortem.md)
- [A09 scorecard](./runs/a09-e4-b02-s0-clean-gpt52-primary-p02-s0-clean-pl-first/scorecard.json)
- [A09 trace summary](./runs/a09-e4-b02-s0-clean-gpt52-primary-p02-s0-clean-pl-first/trace-summary.md)

### A10: `a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-throughput-s0-external-verification`
- batch: `e4-b02-s0-clean-gpt52-primary` pair `p03`
- comparative verdict: `codex-alone-better`
- throughput admissible: false

Primary evidence:

- [A10 outcome](./runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/outcome.md)
- [A10 postmortem](./runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/postmortem.md)
- [A10 scorecard](./runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/scorecard.json)
- [A10 trace summary](./runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/trace-summary.md)

### A11: `a11-e4-b02-s0-clean-gpt52-primary-p04-s0-clean-pl-first`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-throughput-s0-external-verification`
- batch: `e4-b02-s0-clean-gpt52-primary` pair `p04`
- comparative verdict: `codex-alone-better`
- throughput admissible: false

Primary evidence:

- [A11 outcome](./runs/a11-e4-b02-s0-clean-gpt52-primary-p04-s0-clean-pl-first/outcome.md)
- [A11 postmortem](./runs/a11-e4-b02-s0-clean-gpt52-primary-p04-s0-clean-pl-first/postmortem.md)
- [A11 scorecard](./runs/a11-e4-b02-s0-clean-gpt52-primary-p04-s0-clean-pl-first/scorecard.json)
- [A11 trace summary](./runs/a11-e4-b02-s0-clean-gpt52-primary-p04-s0-clean-pl-first/trace-summary.md)

### B02 Batch: `e4-b02-s0-clean-gpt52-primary`

- completed clean pairs: `4`
- eligible pairs: `4`
- order balance: `2` `codex-first`, `2` `pl-first`
- throughput claim eligible: `true`
- batch verdict: `codex-alone-better`

Meaning:

- this is the first claim-eligible clean throughput batch under the tightened `S0` envelope
- both lanes succeeded in all four pairs and passed the shared verification contract
- direct Codex was faster to green in every pair and in both order strata
- prompt-language remained earlier on the secondary first-write metric, but that did not translate into faster verified completion

Primary evidence:

- [B02 batch summary](./batches/e4-b02-s0-clean-gpt52-primary/summary.md)
- [B02 batch data](./batches/e4-b02-s0-clean-gpt52-primary/summary.json)

## Current Interpretation

The evidence now supports these current hypothesis-status reads:

1. `prompt-language` can successfully drive a bounded software-factory slice.
2. `prompt-language` is not currently better than direct Codex on the archived `S0` raw throughput
   question.
3. `prompt-language` still has an open, unclosed hypothesis on factory-quality and governed
   recovery, because those are the dependent variables where it plausibly should win.

The historical and current claims split is:

- `S0 throughput`: answered by `B02`, currently `codex-alone-better`
- `factory-quality`: not yet claim-eligible under the new trace-first rubric
- `recovery`: not yet claim-eligible under repeated interrupted/resume pairs

The evidence also supports these historical claims:

1. Early failures were dominated by runner/setup issues, not by inability to specify the software
   slice.
2. The Windows/headless runtime path needed explicit fixes around state-root resolution, run-node
   timeout behavior, and Codex process launch / cleanup.
3. After those fixes, the sequential prompt-language lane also completed successfully.
4. The first claim-eligible clean `S0` batch (`B02`) shows direct Codex is better on raw
   time-to-green for this bounded slice under the archived throughput protocol.
5. Prompt-language still retains the stronger governed factory-control surface, but that claim now
   needs to be tested directly under the `factory-quality` and `recovery` protocols.

For the deeper comparative interpretation, see [research-method.md](./research-method.md) and
[analysis-2026-04-12.md](./analysis-2026-04-12.md).

Throughput note:

- `B02` is now admissible for a stable clean-throughput claim under the current `S0` protocol
- for this bounded CRM slice, the current batch-level throughput verdict is `codex-alone-better`
- `B02` should now be treated as the archived throughput answer, not the whole E4 answer
- future prompt-language experiments should target factory-quality, governed recovery,
  restartability, and multi-agent control rather than assuming raw-throughput superiority
