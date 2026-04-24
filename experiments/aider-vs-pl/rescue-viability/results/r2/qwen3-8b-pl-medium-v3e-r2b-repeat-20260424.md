# R2-B7 qwen3:8b PL-medium H8 semantic repair v3b repeat

run_id: qwen3-8b-pl-medium-v3e-r2b-repeat-20260424
timestamp_utc: 2026-04-24T03:40:28Z
fixture: h8-repair-v3
oracle: spec.cjs
flow_commit: 121ca20a51870b58522e76d0fa96976a71415ca5
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r2/qwen3-8b-pl-medium-v3e-r2b-repeat-20260424/r2-pl-medium-v3b.flow
runner: aider
model: qwen3:8b
pl_intensity: medium
arm_label: R2-B7-qwen8b-plmedium-h8-v3b
wall_seconds: 337
passes: 20
total: 20
pass_rate: 1.000
retries: completed
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "semantic oracle", "pre-seeded repair fixture", "retry prompt explicitly names repair files"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

Second repeat of the clean PL-medium v3b result completed with PL exit 0 and oracle 20/20.

## Artifact

`runs/r2/qwen3-8b-pl-medium-v3e-r2b-repeat-20260424/`

Generated TypeScript outputs are retained under `src-snapshot/*.ts.txt` so the repository lint gate does not treat experiment outputs as source.
