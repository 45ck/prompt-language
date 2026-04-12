# Batch Summary

Batch: `e4-b02-s0-clean-gpt52-primary`
Scenario: `s0-clean`
Model: `gpt-5.2`
Frozen commit: `e8c9a04c75ee2d461c1ac13d0f3a00e655ee27b8`

## Status

- planned pairs: 4
- completed pairs: 4
- eligible pairs: 4
- throughput claim eligible: true
- comparative verdict: `codex-alone-better`

## Lane Medians

- `prompt-language` median time to green: 1514.34s
- `prompt-language` median first relevant write: 149.97s
- `codex-alone` median time to green: 719.79s
- `codex-alone` median first relevant write: 222.85s

## Order Balance

- completed codex-first pairs: 2
- completed pl-first pairs: 2
- eligible codex-first pairs: 2
- eligible pl-first pairs: 2

## Lane Medians By Order

- codex-first / prompt-language median time to green: 1372.77s
- codex-first / codex-alone median time to green: 673.94s
- pl-first / prompt-language median time to green: 1683.37s
- pl-first / codex-alone median time to green: 743.49s

## Pair Links

- [A08 p01](../../runs/a08-e4-b02-s0-clean-gpt52-primary-p01-s0-clean-codex-first/outcome.md): order=`codex-first`, verdict=`codex-alone-better`
- [A09 p02](../../runs/a09-e4-b02-s0-clean-gpt52-primary-p02-s0-clean-pl-first/outcome.md): order=`pl-first`, verdict=`codex-alone-better`
- [A10 p03](../../runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/outcome.md): order=`codex-first`, verdict=`codex-alone-better`
- [A11 p04](../../runs/a11-e4-b02-s0-clean-gpt52-primary-p04-s0-clean-pl-first/outcome.md): order=`pl-first`, verdict=`codex-alone-better`

## Eligibility Notes

- no batch-level eligibility blockers recorded

