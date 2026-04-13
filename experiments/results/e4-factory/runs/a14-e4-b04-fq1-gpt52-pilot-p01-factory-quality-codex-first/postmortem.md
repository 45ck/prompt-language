# Postmortem

Run: `a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first`
Scenario: `factory-quality`

## What Happened

- prompt-language: Prompt-language completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.
- codex-alone: Direct Codex completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.

## Confounds

- no runtime or config confounds were recorded in this run
- primary claim admissibility: This is a trace-first paired factory-quality run on the same common product contract with closure and lane-level evidence strong enough for a governed-factory comparison.

## Next Actions

- replicate this paired run at least three times before making a stable superiority claim
- add interruption and resume scenarios only after clean S0 pairs accumulate
