# R1-C qwen3:8b PL-full rep 3 corrected

run_id: qwen3-8b-pl-full-r1c-commonjs-20260424
timestamp_utc: 2026-04-24T00:36:44Z
fixture: e-small
oracle: verify.cjs
flow_commit: 862137a9c5bb1de2f01838b01b254af11f929f58
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r1/qwen3-8b-pl-full-r1c-commonjs-20260424/r1-pl-full.flow
runner: aider
model: qwen3:8b
pl_intensity: full
arm_label: R1-C-qwen8b-plfull-rep3-commonjs
wall_seconds: 1173
passes: 5
total: 11
pass_rate: 0.455
retries: unrecorded
excluded: false
excluded_reason: ""
infra_workarounds: ["git init fixture dir", "local package.json type commonjs"]

## Outcome

The PL flow failed completion gates with `PLO-001 Completion gates failed: file_exists "csv2json.js", verify_passes`. Manual oracle execution reported 5/11 passing.

The failure pattern matched corrected R1-B: the generated parser returned only data rows, then the main logic treated `data[0]` as headers.

## Artifact

`runs/r1/qwen3-8b-pl-full-r1c-commonjs-20260424/`
