# Postmortem

Run: `a13-e4-b03-fq1-gpt52-pilot-p01-factory-quality-codex-first`
Scenario: `factory-quality`

## What Happened

- prompt-language: Prompt-language completed the local factory-quality artifact contract, but the shared `noslop` verification path failed under the Windows harness.
- codex-alone: Direct Codex completed the local factory-quality artifact contract, but the shared `noslop` verification path failed under the Windows harness.

## Confounds

- common Windows verification confound: both lanes hit `noslop` verification failures caused by the harness launch/path model rather than by missing product artifacts
- primary claim admissibility: This pilot is paired and trace-complete, but it is not comparative evidence because the same harness bug affected both lanes before clean closure.

## Next Actions

- fix Windows `noslop` execution in the harness and rerun the same paired `factory-quality` protocol on a fresh batch
- only counterbalance into the next order-stratum after one clean rerun on the patched harness
