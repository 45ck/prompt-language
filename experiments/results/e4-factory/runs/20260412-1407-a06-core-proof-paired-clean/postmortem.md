# Postmortem

Run: `20260412-1407-a06-core-proof-paired-clean`

## What Happened

- prompt-language: Prompt-language completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.
- codex-alone: Direct Codex completed the bounded CRM core and passed all verification commands under the frozen bootstrap seed.

## Confounds

- no runtime or config confounds were recorded in this run
- scoring correction: the initial A06 write-up incorrectly treated `.factory/project.flow` as a baseline-required artifact; the corrected read uses the common product contract plus lane-specific control evidence
- throughput admissibility: Both lanes completed the same common product contract under the same frozen bootstrap with explicit timings, complete traces, and no runtime confounds, but the run remains a single fixed-order pair so throughput superiority is still provisional.

## Next Actions

- replicate this paired run at least three times before making a stable superiority claim
- add interruption and resume scenarios only after clean S0 pairs accumulate
