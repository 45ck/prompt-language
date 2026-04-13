# Trace Summary

Run: `a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first`

## Lane Traces

### `pl-sequential`

Primary traces:

- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/pl-state/session-state.json`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/pl-state/audit.jsonl`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/pl-sequential/lane-summary.json`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/pl-sequential/artifact-inventory.json`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/pl-sequential/run-report.json`

What they show:

- preflight status: ok
- run status: ok
- verification: build=pass, noslop_doctor=pass, noslop_fast=pass, lint=pass, typecheck=pass, test=pass

### `codex-alone`

Primary traces:

- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/codex-alone/events.jsonl`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/codex-alone/stderr.log`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/codex-alone/last-message.txt`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/codex-alone/lane-summary.json`
- `experiments/results/e4-factory/runs/a14-e4-b04-fq1-gpt52-pilot-p01-factory-quality-codex-first/codex-alone/artifact-inventory.json`

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
