# R2-B4 qwen3:8b PL-medium H8 semantic repair v3b

run_id: qwen3-8b-pl-medium-v3b-r2b-commonjs-20260424
timestamp_utc: 2026-04-24T02:39:51Z
fixture: h8-repair-v3
oracle: spec.cjs
flow_commit: 2dc2856f2852a0ad3c0f3743cef3793de18f4368
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r2/qwen3-8b-pl-medium-v3b-r2b-commonjs-20260424/r2-pl-medium-v3b.flow
runner: aider
model: qwen3:8b
pl_intensity: medium
arm_label: R2-B4-qwen8b-plmedium-h8-v3b
wall_seconds: 1239
passes: 19
total: 20
pass_rate: 0.950
retries: incomplete
excluded: true
excluded_reason: Prompt runner exited with code 1 before the PL-medium arm completed cleanly.
infra_workarounds: ["git init fixture dir", "semantic oracle", "pre-seeded repair fixture", "retry prompt explicitly names repair files"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

PL-medium v3b corrected the v3 retry prompt by writing oracle feedback to a file and explicitly naming all four repair targets in the retry prompt. The final workspace scored 19/20, improving on v3 PL-lite 15/20 and solo 18/20.

The run is still excluded from aggregate R2 scoring because `prompt-language ci` failed with `Prompt runner exited with code 1` before clean completion. The only remaining oracle failure was `Order.status` falsy preservation.

## Artifact

`runs/r2/qwen3-8b-pl-medium-v3b-r2b-commonjs-20260424/`

Generated TypeScript outputs are retained under `src-snapshot/*.ts.txt` so the repository lint gate does not treat failed experiment outputs as source.
