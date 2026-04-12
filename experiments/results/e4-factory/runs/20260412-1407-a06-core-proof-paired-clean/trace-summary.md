# Trace Summary

Run: `20260412-1407-a06-core-proof-paired-clean`

## Lane Traces

### `pl-sequential`

Primary traces:

- `experiments/results/e4-factory/runs/20260412-1407-a06-core-proof-paired-clean/pl-state/session-state.json`
- `experiments/results/e4-factory/runs/20260412-1407-a06-core-proof-paired-clean/pl-state/audit.jsonl`
- `experiments/results/e4-factory/runs/20260412-1407-a06-core-proof-paired-clean/pl-sequential/run-report.json`

What they show:

- preflight status: ok
- run status: ok
- verification: lint=pass, typecheck=pass, test=pass

### `codex-alone`

Primary traces:

- `experiments/results/e4-factory/runs/20260412-1407-a06-core-proof-paired-clean/codex-alone/events.jsonl`
- `experiments/results/e4-factory/runs/20260412-1407-a06-core-proof-paired-clean/codex-alone/stderr.log`
- `experiments/results/e4-factory/runs/20260412-1407-a06-core-proof-paired-clean/codex-alone/last-message.txt`

What they show:

- main exit code: 0
- verification: lint=pass, typecheck=pass, test=pass
- artifacts complete: true

## Comparative Read

- current comparative verdict: `mixed`
- both lanes closed the same common product contract; the raw timing read favors direct Codex on time-to-green, while prompt-language reached first code earlier and still preserves richer factory-control state
- prompt-language trace completeness: `strong`
- codex-alone trace completeness: `strong`

## Confounds

- prompt-language failure class: `none`
- codex-alone failure class: `none`
