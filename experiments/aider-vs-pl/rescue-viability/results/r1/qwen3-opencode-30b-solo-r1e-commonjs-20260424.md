# R1-E qwen3-opencode:30b solo ceiling remeasurement

run_id: qwen3-opencode-30b-solo-r1e-commonjs-20260424
timestamp_utc: 2026-04-24T01:21:14Z
fixture: e-small
oracle: verify.cjs
flow_commit: fd7f2f4bae6492e34c0463a2950980b7c64b715f
flow_file: none
runner: aider
model: qwen3-opencode:30b
pl_intensity: solo
arm_label: R1-E-qwen30b-solo-ceiling
wall_seconds: 240
passes: 11
total: 11
pass_rate: 1.000
retries: 0
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "local package.json type commonjs"]
local_inference: ollama ps reported qwen3-opencode:30b resident at 15%/85% CPU/GPU

## Outcome

Solo aider with `qwen3-opencode:30b` produced `csv2json.js` in one attempt and the oracle passed 11/11.

This re-establishes the E-SMALL ceiling under the current fixture hygiene and runner state: the task is solvable by the stronger local model without PL orchestration.

## Artifact

`runs/r1/qwen3-opencode-30b-solo-r1e-commonjs-20260424/`
