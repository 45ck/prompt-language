# R2-B3 qwen3:8b PL-medium H8 semantic repair

run_id: qwen3-8b-pl-medium-v3-r2b-commonjs-20260424
timestamp_utc: 2026-04-24T02:06:25Z
fixture: h8-repair-v3
oracle: spec.cjs
flow_commit: d662322d98943c0b528bd87f564aa8aa5ee09ee0
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r2/qwen3-8b-pl-medium-v3-r2b-commonjs-20260424/r2-pl-medium-v3.flow
runner: aider
model: qwen3:8b
pl_intensity: medium
arm_label: R2-B3-qwen8b-plmedium-h8-v3
wall_seconds: 1030
passes: 12
total: 20
pass_rate: 0.600
retries: incomplete
excluded: true
excluded_reason: Prompt runner exited with code 1 before the PL-medium arm completed cleanly.
infra_workarounds: ["git init fixture dir", "semantic oracle", "pre-seeded repair fixture"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

PL-medium attempted the same v3 repair fixture with retry-on-oracle-failure enabled, but `prompt-language ci` failed with `Prompt runner exited with code 1` after about 17 minutes. The external oracle reported 12/20 for the final workspace state.

This run is retained as an operational artifact but excluded from aggregate R2 scoring because the PL arm did not complete cleanly.

## Artifact

`runs/r2/qwen3-8b-pl-medium-v3-r2b-commonjs-20260424/`

Generated TypeScript outputs are retained under `src-snapshot/*.ts.txt` so the repository lint gate does not treat failed experiment outputs as source.
