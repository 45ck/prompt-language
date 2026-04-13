# Trace Summary

Run: `20260414-0619-a19-core-proof-paired-clean`

## Lane Traces

### `pl-sequential`

Primary traces:

- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/pl-sequential/attempt-1/run-report.json`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/pl-state/session-state.json`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/pl-state/audit.jsonl`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/pl-sequential/lane-summary.json`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/pl-sequential/artifact-inventory.json`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/pl-sequential/run-report.json`

What they show:

- preflight status: ok
- run status: ok
- verification: lint=pass, typecheck=pass, test=pass
- interrupted: true
- resume to green seconds: 1011.81

### `codex-alone`

Primary traces:

- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/codex-alone/attempt-1/events.jsonl`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/codex-alone/events.jsonl`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/codex-alone/stderr.log`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/codex-alone/last-message.txt`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/codex-alone/lane-summary.json`
- `experiments/results/e4-factory/runs/20260414-0619-a19-core-proof-paired-clean/codex-alone/artifact-inventory.json`

What they show:

- main exit code: 0
- verification: lint=pass, typecheck=pass, test=pass
- artifacts complete: true
- interrupted: true
- resume to green seconds: 144.28

## Comparative Read

- current comparative verdict: `codex-alone-better`
- primary claim type: `recovery`
- primary endpoint: `resumeToGreenSec`
- prompt-language trace completeness: `strong`
- codex-alone trace completeness: `strong`
- prompt-language resume to green: `1011.81`
- codex-alone resume to green: `144.28`

## Confounds

- prompt-language failure class: `none`
- codex-alone failure class: `none`
