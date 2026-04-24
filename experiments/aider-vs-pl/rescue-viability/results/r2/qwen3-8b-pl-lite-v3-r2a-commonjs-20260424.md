# R2-A3 qwen3:8b PL-lite H8 semantic repair

run_id: qwen3-8b-pl-lite-v3-r2a-commonjs-20260424
timestamp_utc: 2026-04-24T01:55:24Z
fixture: h8-repair-v3
oracle: spec.cjs
flow_commit: d662322d98943c0b528bd87f564aa8aa5ee09ee0
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r2/qwen3-8b-pl-lite-v3-r2a-commonjs-20260424/r2-pl-lite-v3.flow
runner: aider
model: qwen3:8b
pl_intensity: lite
arm_label: R2-A3-qwen8b-pllite-h8-v3
wall_seconds: 456
passes: 15
total: 20
pass_rate: 0.750
retries: 0
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "semantic oracle", "pre-seeded repair fixture"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

PL-lite improved the seeded repair fixture from 10/20 to 15/20 with no retry and no completion gate.

The remaining failures were missing exported interfaces for all four files and one falsy-preservation failure on `Order.status`.

## Artifact

`runs/r2/qwen3-8b-pl-lite-v3-r2a-commonjs-20260424/`

Generated TypeScript outputs are retained under `src-snapshot/*.ts.txt` so the repository lint gate does not treat failed experiment outputs as source.
