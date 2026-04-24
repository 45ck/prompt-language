# R2-D3 qwen3:8b solo H8 semantic repair

run_id: qwen3-8b-solo-v3-r2d-commonjs-20260424
timestamp_utc: 2026-04-24T02:03:20Z
fixture: h8-repair-v3
oracle: spec.cjs
flow_commit: d662322d98943c0b528bd87f564aa8aa5ee09ee0
flow_file: none
runner: aider
model: qwen3:8b
pl_intensity: solo
arm_label: R2-D3-qwen8b-solo-h8-v3
wall_seconds: 146
passes: 18
total: 20
pass_rate: 0.900
retries: 0
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "semantic oracle", "pre-seeded repair fixture"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

Solo aider improved the same seeded repair fixture from 10/20 to 18/20 in one attempt.

The remaining failures were missing exported interfaces for `User` and `Order`. This beats PL-lite on the same semantic fixture, so decomposition alone did not rescue qwen3:8b on H8 repair v3.

## Artifact

`runs/r2/qwen3-8b-solo-v3-r2d-commonjs-20260424/`

Generated TypeScript outputs are retained under `src-snapshot/*.ts.txt` so the repository lint gate does not treat failed experiment outputs as source.
