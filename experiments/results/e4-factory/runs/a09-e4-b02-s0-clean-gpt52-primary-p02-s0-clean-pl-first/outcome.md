# Outcome

Run: `a09-e4-b02-s0-clean-gpt52-primary-p02-s0-clean-pl-first`
Order: `pl-first`

## Lane Results

- `prompt-language`: `success` (completed)
- `codex-alone`: `success` (completed)

## Verification

- `prompt-language`: lint=pass, typecheck=pass, test=pass
- `codex-alone`: lint=pass, typecheck=pass, test=pass

## Throughput

- `prompt-language` time to green: 1809.51s
- `prompt-language` time to first relevant write: 167.84s
- `codex-alone` time to green: 764.76s
- `codex-alone` time to first relevant write: 441.9s
- admissible for throughput claim: false

## Verdict

- comparative verdict: `codex-alone-better`
- admissibility: `primary-comparison`
- reason: This is a clean paired timed run on the same common product contract, but throughput superiority remains provisional until order effects are counterbalanced or repeated clean pairs agree.
