# Postmortem

Run: `20260414-0619-a18-core-proof-paired-clean`
Scenario: `recovery`

## What Happened

- prompt-language: Prompt-language did not recover cleanly from the forced pre-verification stop under the frozen bootstrap seed.
- codex-alone: Direct Codex resumed from the forced pre-verification stop and closed the bounded CRM core successfully under the frozen bootstrap seed.

## Confounds

- prompt-language failure class: product
- primary claim admissibility: This is a trace-backed S2 governed-recovery pilot on the same bounded CRM contract, but it remains supporting context until repeated predeclared interruption/resume pairs agree.

## Next Actions

- repeat the S2 interruption/resume pilot in both orders before making a governed-recovery claim
- keep the clean B02 throughput result separate from any recovery interpretation
