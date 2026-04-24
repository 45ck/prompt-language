# R2-B5 qwen3:8b PL-medium H8 semantic repair v3b clean rerun

run_id: qwen3-8b-pl-medium-v3c-r2b-diagnostic-20260424
timestamp_utc: 2026-04-24T03:16:16Z
fixture: h8-repair-v3
oracle: spec.cjs
flow_commit: 29e426d271deb09e24a56bc66a16537e0753df09
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r2/qwen3-8b-pl-medium-v3c-r2b-diagnostic-20260424/r2-pl-medium-v3b.flow
runner: aider
model: qwen3:8b
pl_intensity: medium
arm_label: R2-B5-qwen8b-plmedium-h8-v3b
wall_seconds: 476
passes: 20
total: 20
pass_rate: 1.000
retries: completed
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "semantic oracle", "pre-seeded repair fixture", "retry prompt explicitly names repair files", "PLR-007 diagnostics instrumentation present"]
local_inference: ollama ps reported qwen3:8b resident at 100% GPU

## Outcome

PL-medium v3b completed cleanly and the external oracle passed 20/20. This is the first clean hardened-H8 result showing retry-scoped PL beating the same semantic fixture's solo qwen3:8b comparator, which scored 18/20.

No prompt-runner failure diagnostic was emitted in this rerun. The diagnostic instrumentation was present, but not exercised.

## Artifact

`runs/r2/qwen3-8b-pl-medium-v3c-r2b-diagnostic-20260424/`

Generated TypeScript outputs are retained under `src-snapshot/*.ts.txt` so the repository lint gate does not treat experiment outputs as source.
