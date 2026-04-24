# R1-D gemma4-opencode:e4b PL-full floor check

run_id: gemma4-opencode-e4b-pl-full-r1d-commonjs-20260424
timestamp_utc: 2026-04-24T01:03:42Z
fixture: e-small
oracle: verify.cjs
flow_commit: dbf174109993cef603e07f6c20d10d9a788c36a8
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r1/gemma4-opencode-e4b-pl-full-r1d-commonjs-20260424/r1-pl-full.flow
runner: aider
model: gemma4-opencode:e4b
pl_intensity: full
arm_label: R1-D-gemma4-e4b-plfull-floor
wall_seconds: 901
passes: 3
total: 11
pass_rate: 0.273
retries: 0
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "local package.json type commonjs"]
local_inference: ollama ps reported gemma4-opencode:e4b resident at 68%/32% CPU/GPU

## Outcome

The PL run exhausted the 900s aider timeout and produced no `csv2json.js`. The oracle reported 3/11 passing because process-level error exits still returned non-zero when no implementation file existed.

This confirms the expected floor behavior for the smaller gemma4 opencode variant on E-SMALL: PL orchestration did not lift it above the literal-code-emission threshold in this run.

## Artifact

`runs/r1/gemma4-opencode-e4b-pl-full-r1d-commonjs-20260424/`
