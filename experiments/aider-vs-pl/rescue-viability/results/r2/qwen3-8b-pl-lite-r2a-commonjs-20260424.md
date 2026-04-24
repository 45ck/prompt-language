# R2-A qwen3:8b PL-lite H8 ablation

run_id: qwen3-8b-pl-lite-r2a-commonjs-20260424
timestamp_utc: 2026-04-24T01:33:53Z
fixture: h8-foreach-copy
oracle: spec.cjs
flow_commit: b27f09c7126e3dcd91ee36f1a68ec340526465ff
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r2/qwen3-8b-pl-lite-r2a-commonjs-20260424/r2-pl-lite.flow
runner: aider
model: qwen3:8b
pl_intensity: lite
arm_label: R2-A-qwen8b-pllite-h8
wall_seconds: 96
passes: 4
total: 4
pass_rate: 1.000
retries: 0
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "reconstructed H8 fixture"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

The decomposition-only PL flow completed without retry or completion gates. The external H8 oracle reported 4/4 passing.

This result means the reconstructed H8 fixture does not require retry/gate machinery once it is decomposed into one prompt per file. The remaining R2 question is whether qwen3:8b solo also passes this reconstructed fixture; if solo fails, the measured lift is decomposition, not retry.

## Artifact

`runs/r2/qwen3-8b-pl-lite-r2a-commonjs-20260424/`
