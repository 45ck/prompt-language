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

### B04 Batch: `e4-b04-fq1-gpt52-pilot`

- completed clean pairs: `2`
- eligible pairs: `2`
- order balance: `1` `codex-first`, `1` `pl-first`
- factory-quality claim eligible: `true`
- batch verdict: `prompt-language-better`

Meaning:

- this is the first claim-eligible factory-quality pilot batch under the trace-first rubric
- both lanes succeeded in both pairs and passed the shared verification contract
- prompt-language scored stronger on `processConformance` and `reuseReadiness` in both pairs
- the factory-quality advantage held in both order strata

Primary evidence:

- [B04 batch summary](./batches/e4-b04-fq1-gpt52-pilot/summary.md)
- [B04 batch data](./batches/e4-b04-fq1-gpt52-pilot/summary.json)

### A13: `a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first`

- `prompt-language` sequential lane: partial
- direct Codex lane: partial

Meaning:

- timing envelope: `paired-factory-quality-s0-external-verification`
- scenario kind: `factory-quality`
- primary claim type: `factory-quality`
- primary endpoint: `factoryQualityOverall`
- batch: `e4-b03-fq1-gpt52-pilot` pair `p01-factory-quality-codex-first`
- comparative verdict: `inconclusive`
- factory-quality claim eligible: false
- prompt-language process conformance: mixed
- codex-alone process conformance: weak
- shared confound: Windows `noslop` verification path failed for both lanes

Primary evidence:

- [A13 outcome](./runs/a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first/outcome.md)
- [A13 postmortem](./runs/a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first/postmortem.md)
- [A13 scorecard](./runs/a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first/scorecard.json)
- [A13 trace summary](./runs/a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first/trace-summary.md)

### A14: `a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-factory-quality-s0-external-verification`
- scenario kind: `factory-quality`
- primary claim type: `factory-quality`
- primary endpoint: `factoryQualityOverall`
- batch: `e4-b04-fq1-gpt52-pilot` pair `p01-factory-quality-codex-first`
- comparative verdict: `prompt-language-better`
- factory-quality claim eligible: true
- prompt-language process conformance: strong
- codex-alone process conformance: mixed

Primary evidence:

- [A14 outcome](./runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/outcome.md)
- [A14 postmortem](./runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/postmortem.md)
- [A14 scorecard](./runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/scorecard.json)
- [A14 trace summary](./runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/trace-summary.md)

### A15: `a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-factory-quality-s0-external-verification`
- scenario kind: `factory-quality`
- primary claim type: `factory-quality`
- primary endpoint: `factoryQualityOverall`
- batch: `e4-b04-fq1-gpt52-pilot` pair `p02-factory-quality-pl-first`
- comparative verdict: `prompt-language-better`
- factory-quality claim eligible: true
- prompt-language process conformance: strong
- codex-alone process conformance: mixed

Primary evidence:

- [A15 outcome](./runs/a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first/outcome.md)
- [A15 postmortem](./runs/a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first/postmortem.md)
- [A15 scorecard](./runs/a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first/scorecard.json)
- [A15 trace summary](./runs/a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first/trace-summary.md)

### A16: `20260414-0619-a16-core-proof-paired-clean`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-factory-quality-s0-external-verification`
- scenario kind: `factory-quality`
- primary claim type: `factory-quality`
- primary endpoint: `factoryQualityOverall`
- batch: `e4-b05-fq1-gpt52-primary` pair `p01-factory-quality-codex-first`
- comparative verdict: `prompt-language-better`
- factory-quality claim eligible: true
- prompt-language process conformance: strong
- codex-alone process conformance: mixed

Primary evidence:

- [A16 outcome](./runs/20260414-0619-a16-core-proof-paired-clean/outcome.md)
- [A16 postmortem](./runs/20260414-0619-a16-core-proof-paired-clean/postmortem.md)
- [A16 scorecard](./runs/20260414-0619-a16-core-proof-paired-clean/scorecard.json)
- [A16 trace summary](./runs/20260414-0619-a16-core-proof-paired-clean/trace-summary.md)

### A17: `20260414-0619-a17-core-proof-paired-clean`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-factory-quality-s0-external-verification`
- scenario kind: `factory-quality`
- primary claim type: `factory-quality`
- primary endpoint: `factoryQualityOverall`
- batch: `e4-b05-fq1-gpt52-primary` pair `p02-factory-quality-pl-first`
- comparative verdict: `prompt-language-better`
- factory-quality claim eligible: true
- prompt-language process conformance: strong
- codex-alone process conformance: mixed

Primary evidence:

- [A17 outcome](./runs/20260414-0619-a17-core-proof-paired-clean/outcome.md)
- [A17 postmortem](./runs/20260414-0619-a17-core-proof-paired-clean/postmortem.md)
- [A17 scorecard](./runs/20260414-0619-a17-core-proof-paired-clean/scorecard.json)
- [A17 trace summary](./runs/20260414-0619-a17-core-proof-paired-clean/trace-summary.md)

### A18: `20260414-0619-a18-core-proof-paired-clean`

- `prompt-language` sequential lane: partial
- direct Codex lane: success

Meaning:

- timing envelope: `paired-recovery-s2-pre-verification`
- scenario kind: `s2-pre-verification`
- primary claim type: `recovery`
- primary endpoint: `resumeToGreenSec`
- batch: `e4-b06-s2-gpt52-pilot` pair `p01-s2-codex-first`
- comparative verdict: `codex-alone-better`
- recovery claim eligible: false
- admissibility: supporting-context

Primary evidence:

- [A18 outcome](./runs/20260414-0619-a18-core-proof-paired-clean/outcome.md)
- [A18 postmortem](./runs/20260414-0619-a18-core-proof-paired-clean/postmortem.md)
- [A18 scorecard](./runs/20260414-0619-a18-core-proof-paired-clean/scorecard.json)
- [A18 trace summary](./runs/20260414-0619-a18-core-proof-paired-clean/trace-summary.md)

### A19: `20260414-0619-a19-core-proof-paired-clean`

- `prompt-language` sequential lane: success
- direct Codex lane: success

Meaning:

- timing envelope: `paired-recovery-s2-pre-verification`
- scenario kind: `s2-pre-verification`
- primary claim type: `recovery`
- primary endpoint: `resumeToGreenSec`
- batch: `e4-b06-s2-gpt52-pilot` pair `p02-s2-pl-first`
- comparative verdict: `codex-alone-better`
- recovery claim eligible: false
- admissibility: supporting-context

Primary evidence:

- [A19 outcome](./runs/20260414-0619-a19-core-proof-paired-clean/outcome.md)
- [A19 postmortem](./runs/20260414-0619-a19-core-proof-paired-clean/postmortem.md)
- [A19 scorecard](./runs/20260414-0619-a19-core-proof-paired-clean/scorecard.json)
- [A19 trace summary](./runs/20260414-0619-a19-core-proof-paired-clean/trace-summary.md)

### B05 Batch: `e4-b05-fq1-gpt52-primary`

- completed clean pairs: `2`
- eligible pairs: `2`
- order balance: `1` `codex-first`, `1` `pl-first`
- factory-quality claim eligible: `true`
- batch verdict: `prompt-language-better`

Meaning:

- this is the first primary factory-quality batch, confirming the B04 pilot result
- prompt-language won on factory-quality in both pairs across both order strata
- combined with B04, there are now 4 clean counterbalanced factory-quality pairs all showing prompt-language-better

Primary evidence:

- [B05 batch summary](./batches/e4-b05-fq1-gpt52-primary/summary.md)
- [B05 batch data](./batches/e4-b05-fq1-gpt52-primary/summary.json)

### B06 Batch: `e4-b06-s2-gpt52-pilot`

- completed pairs: `2`
- eligible pairs: `2`
- order balance: `1` `codex-first`, `1` `pl-first`
- recovery claim eligible: `false`
- batch verdict: `codex-alone-better`

Meaning:

- this is the first S2 recovery pilot batch
- direct Codex recovered better from pre-verification interruption in both pairs
- prompt-language had a partial failure in the codex-first pair (A18)
- these are supporting context, not yet claim-eligible for recovery

Primary evidence:

- [B06 batch summary](./batches/e4-b06-s2-gpt52-pilot/summary.md)
- [B06 batch data](./batches/e4-b06-s2-gpt52-pilot/summary.json)

## Current Interpretation

The evidence now supports these current hypothesis-status reads:

1. `prompt-language` can successfully drive a bounded software-factory slice.
2. `prompt-language` is not currently better than direct Codex on the archived `S0` raw throughput
   question.
3. `prompt-language` is better than direct Codex on governed factory-quality behavior, confirmed
   across two batches (`B04` pilot and `B05` primary) with 4 clean counterbalanced pairs all
   showing `prompt-language-better`.
4. `prompt-language` is not currently better than direct Codex on S2 pre-verification recovery
   in the first pilot batch (`B06`), with both pairs showing `codex-alone-better`.

The historical and current claims split is:

- `S0 throughput`: answered by `B02`, currently `codex-alone-better`
- `factory-quality`: confirmed by `B04` + `B05`, currently `prompt-language-better` across 4/4 clean pairs
- `recovery`: answered at pilot strength by `B06`, currently `codex-alone-better`

The active `factory-quality` pilot contract is a local SDLC slice, not the full externally
executed QA/demo pipeline. It requires governed requirements/design artifacts, generated tests,
QA/demo specification files, and local verification evidence (`build` when present, `noslop
doctor`, `noslop check --tier=fast`, `lint`, `typecheck`, `test`). External `mqm` /
`demo-machine` execution remains reserved for the broader `fullFactoryFlow` claim.

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
