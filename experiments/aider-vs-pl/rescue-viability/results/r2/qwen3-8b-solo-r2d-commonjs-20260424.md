# R2-D qwen3:8b solo H8 comparator

run_id: qwen3-8b-solo-r2d-commonjs-20260424
timestamp_utc: 2026-04-24T01:39:19Z
fixture: h8-foreach-copy
oracle: spec.cjs
flow_commit: 94a7bfb2c5765d4cae1a7877ca25c419a2af7cf2
flow_file: none
runner: aider
model: qwen3:8b
pl_intensity: solo
arm_label: R2-D-qwen8b-solo-h8
wall_seconds: 35
passes: 4
total: 4
pass_rate: 1.000
retries: 0
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "reconstructed H8 fixture"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

Solo aider with `qwen3:8b` passed the reconstructed H8 oracle 4/4 in one attempt.

This means the reconstructed H8 fixture is not usable as rescue evidence under the current explicit TASK/spec prompt: qwen3:8b solo already reaches the ceiling. R2 should not proceed to medium/full variants on this fixture until the original H8 fixture is recovered or the reconstruction is hardened enough that solo again fails.

## Artifact

`runs/r2/qwen3-8b-solo-r2d-commonjs-20260424/`
