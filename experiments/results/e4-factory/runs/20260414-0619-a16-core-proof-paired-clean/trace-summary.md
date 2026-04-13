# Trace Summary

Run: `20260414-0619-a16-core-proof-paired-clean`

## Lane Traces

### `pl-sequential`

Primary traces:

- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/pl-state/session-state.json`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/pl-state/audit.jsonl`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/pl-sequential/lane-summary.json`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/pl-sequential/artifact-inventory.json`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/pl-sequential/run-report.json`

What they show:

- preflight status: ok
- run status: ok
- verification: build=pass, noslop_doctor=pass, noslop_fast=pass, lint=pass, typecheck=pass, test=pass

### `codex-alone`

Primary traces:

- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/codex-alone/events.jsonl`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/codex-alone/stderr.log`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/codex-alone/last-message.txt`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/codex-alone/lane-summary.json`
- `experiments/results/e4-factory/runs/20260414-0619-a16-core-proof-paired-clean/codex-alone/artifact-inventory.json`

What they show:

- main exit code: 0
- verification: build=pass, noslop_doctor=pass, noslop_fast=pass, lint=pass, typecheck=pass, test=pass
- artifacts complete: true

## Comparative Read

- current comparative verdict: `prompt-language-better`
- primary claim type: `factory-quality`
- primary endpoint: `factoryQualityOverall`
- prompt-language trace completeness: `strong`
- codex-alone trace completeness: `strong`

## Confounds

- prompt-language failure class: `none`
- codex-alone failure class: `none`
