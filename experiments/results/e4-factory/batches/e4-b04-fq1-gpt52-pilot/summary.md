# Batch Summary

Batch: `e4-b04-fq1-gpt52-pilot`
Scenario: `factory-quality`
Model: `gpt-5.2`
Frozen commit: `a9b38d6d82726cd803e26362d37f03f10bed1dce`

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

- [A14 p01](../../runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/outcome.md): order=`codex-first`, verdict=`prompt-language-better`
- [A15 p02](../../runs/a15-e4-b04-fq1-gpt52-pilot-p02-factory-quality-pl-first/outcome.md): order=`pl-first`, verdict=`prompt-language-better`

## Eligibility Notes

- both orders represented (codex-first and pl-first), counterbalancing satisfied
- both pairs are claim-eligible with strong trace completeness and closure
- this is a pilot batch; promotion to primary requires additional pairs
