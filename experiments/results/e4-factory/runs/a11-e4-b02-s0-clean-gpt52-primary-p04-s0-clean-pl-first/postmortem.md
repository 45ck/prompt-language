# Postmortem

Run: `a11-e4-b02-s0-clean-gpt52-primary-p04-s0-clean-pl-first`

## What Happened

- prompt-language: Prompt-language completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.
- codex-alone: Direct Codex completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.

## Confounds

- no runtime or config confounds were recorded in this run
- throughput admissibility: This is a clean paired timed run on the same common product contract, but throughput superiority remains provisional until order effects are counterbalanced or repeated clean pairs agree.

## Next Actions

- replicate this paired run at least three times before making a stable superiority claim
- add interruption and resume scenarios only after clean S0 pairs accumulate
