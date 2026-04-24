# R1-B qwen3:8b PL-full rep 2 invalidated

run_id: qwen3-8b-pl-full-r1b-20260424
timestamp_utc: 2026-04-23T23:56:35Z
fixture: e-small
oracle: verify.cjs
flow_commit: 862137a9c5bb1de2f01838b01b254af11f929f58
flow_file: experiments/aider-vs-pl/rescue-viability/runs/r1/qwen3-8b-pl-full-r1b-20260424/r1-pl-full.flow
runner: aider
model: qwen3:8b
pl_intensity: full
arm_label: R1-B-qwen8b-plfull-rep2-invalid
wall_seconds: 1173
passes: 4
total: 11
pass_rate: 0.364
retries: unrecorded
excluded: true
excluded_reason: Missing local CommonJS package metadata; Node inherited parent repo ESM mode while generated solution used require.

## Outcome

This run is retained as an artifact but excluded from aggregate scoring. The oracle reported 4/11, but the functional checks were dominated by `ReferenceError: require is not defined in ES module scope`, not by the CSV parser's actual behavior.

## Artifact

`runs/r1/qwen3-8b-pl-full-r1b-20260424/`
