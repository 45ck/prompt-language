# R2-A2 qwen3:8b PL-lite H8 v2 exploratory hardening

run_id: qwen3-8b-pl-lite-v2-r2a-commonjs-20260424
timestamp_utc: 2026-04-24T01:48:49Z
fixture: h8-foreach-copy-v2
oracle: spec.cjs
flow_commit: d662322d98943c0b528bd87f564aa8aa5ee09ee0
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r2/qwen3-8b-pl-lite-v2-r2a-commonjs-20260424/r2-pl-lite-v2.flow
runner: aider
model: qwen3:8b
pl_intensity: lite
arm_label: R2-A2-qwen8b-pllite-h8-v2
wall_seconds: 245
passes: 1
total: 8
pass_rate: 0.125
retries: 0
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "TASK-only model-visible context"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

PL-lite completed with no retry or completion gate, but the external oracle reported 1/8 passing.

The run showed schema drift under TASK-only context: after the first file, qwen3:8b hallucinated different module shapes instead of following the H8 v2 table. This made v2 useful as a hardening probe but not as the final R2 oracle design because it still used source-regex checks.

## Artifact

`runs/r2/qwen3-8b-pl-lite-v2-r2a-commonjs-20260424/`

Generated TypeScript outputs are retained under `src-snapshot/*.ts.txt` so the repository lint gate does not treat failed experiment outputs as source.
