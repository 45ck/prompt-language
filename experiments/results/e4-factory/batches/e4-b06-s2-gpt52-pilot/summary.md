# Batch Summary

Batch: `e4-b06-s2-gpt52-pilot`
Scenario: `s2-pre-verification`
Model: `gpt-5.2`
Frozen commit: `0dcab2cfda803fbb4b52dd297aa53fe09822d0ea`

## Status

- planned pairs: 2
- completed pairs: 2
- eligible pairs: 2
- recovery claim eligible: **false** (supporting-context only)
- comparative verdict: `codex-alone-better`

## Current Read

- both pairs completed with codex-alone recovering faster from the forced pre-verification stop
- A18 (codex-first): PL lane was partial (verificationPassRate=0.67, no timeToGreen), codex-alone succeeded (resumeToGreenSec=189.75)
- A19 (pl-first): both lanes succeeded, but codex-alone resumed in 144.28s vs PL's 1011.81s
- codex-alone showed consistent strong recoveryQuality across both pairs; PL was mixed in A18, strong in A19
- admissibility class is `supporting-context` for both runs -- not yet claim-eligible for recovery

## Lane Medians

| Lane | resumeToGreenSec | verificationPassRate | successRate |
|---|---|---|---|
| pl-sequential | 1011.81 (A19 only; A18 had no green) | 0.83 | 0.5 |
| codex-alone | 167.02 | 1.0 | 1.0 |

## Pair Links

- [A18 p01](../../runs/20260414-0619-a18-core-proof-paired-clean/outcome.md): order=`codex-first`, verdict=`codex-alone-better`
- [A19 p02](../../runs/20260414-0619-a19-core-proof-paired-clean/outcome.md): order=`pl-first`, verdict=`codex-alone-better`

## Eligibility Notes

- both orders represented (codex-first and pl-first), counterbalancing satisfied
- admissibility class is `supporting-context` for both runs, not `primary-comparison`
- recovery claim eligibility is false: this is a pilot batch providing directional signal only
- promotion to recovery-claim-eligible requires repeated predeclared interruption/resume pairs that agree
- this batch provides supporting context for the S2 scenario but does not yet support formal recovery claims
