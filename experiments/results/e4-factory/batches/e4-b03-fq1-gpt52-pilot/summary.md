# Batch Summary

Batch: `e4-b03-fq1-gpt52-pilot`
Scenario: `factory-quality`
Model: `gpt-5.2`
Frozen commit: `9a468afb6ecbb7680e932ca4714bc4b8b75f6e60`

## Status

- planned pairs: 2
- completed pairs: 1
- eligible pairs: 0
- factory-quality claim eligible: false
- comparative verdict: `inconclusive`

## Current Read

- `A13` is preserved as a trace-complete pilot, not as admissible comparative evidence
- both lanes completed the local factory-quality artifact contract
- both lanes were downgraded by the same Windows `noslop` verification-path failure

## Pair Links

- [A13 p01](../../runs/a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first/outcome.md): order=`codex-first`, verdict=`inconclusive`

## Eligibility Notes

- shared Windows `noslop` verification-path failure affected both lanes before clean closure
- rerun the same protocol on the patched harness before adding the counterbalanced pair
