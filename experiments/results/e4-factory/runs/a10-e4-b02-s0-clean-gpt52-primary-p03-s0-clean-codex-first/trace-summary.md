# Trace Summary

Run: `a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first`

## Lane Traces

### `pl-sequential`

Primary traces:

- `experiments/results/e4-factory/runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/pl-state/session-state.json`
- `experiments/results/e4-factory/runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/pl-state/audit.jsonl`
- `experiments/results/e4-factory/runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/pl-sequential/run-report.json`

What they show:

- preflight status: ok
- run status: ok
- verification: lint=pass, typecheck=pass, test=pass

### `codex-alone`

Primary traces:

- `experiments/results/e4-factory/runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/codex-alone/events.jsonl`
- `experiments/results/e4-factory/runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/codex-alone/stderr.log`
- `experiments/results/e4-factory/runs/a10-e4-b02-s0-clean-gpt52-primary-p03-s0-clean-codex-first/codex-alone/last-message.txt`

What they show:

- main exit code: 0
- verification: lint=pass, typecheck=pass, test=pass
- artifacts complete: true

## Comparative Read

- current comparative verdict: `codex-alone-better`
- prompt-language trace completeness: `strong`
- codex-alone trace completeness: `strong`

## Confounds

- prompt-language failure class: `none`
- codex-alone failure class: `none`
