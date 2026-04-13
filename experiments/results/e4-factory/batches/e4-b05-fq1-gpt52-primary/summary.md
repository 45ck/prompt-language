# Batch Summary

Batch: `e4-b05-fq1-gpt52-primary`
Scenario: `factory-quality`
Model: `gpt-5.2`
Frozen commit: `0dcab2cfda803fbb4b52dd297aa53fe09822d0ea`

## Status

- planned pairs: 2
- completed pairs: 2
- eligible pairs: 2
- factory-quality claim eligible: true
- comparative verdict: `prompt-language-better`

## Current Read

- both pairs completed cleanly with all verification passing
- prompt-language scored `factoryQualityOverall=10` in both pairs
- codex-alone scored `factoryQualityOverall=8` in both pairs
- the difference is driven by stronger `processConformance` and `reuseReadiness` in the prompt-language lane

## Lane Medians

| Lane | factoryQualityOverall | verificationPassRate |
|---|---|---|
| pl-sequential | 10 | 1.0 |
| codex-alone | 8 | 1.0 |

## Pair Links

- [A16 p01](../../runs/20260414-0619-a16-core-proof-paired-clean/outcome.md): order=`codex-first`, verdict=`prompt-language-better`
- [A17 p02](../../runs/20260414-0619-a17-core-proof-paired-clean/outcome.md): order=`pl-first`, verdict=`prompt-language-better`

## Eligibility Notes

- both orders represented (codex-first and pl-first), counterbalancing satisfied
- both pairs are claim-eligible with strong trace completeness and closure
- this is a primary batch confirming the pilot (B04) finding with independent runs on a clean commit
