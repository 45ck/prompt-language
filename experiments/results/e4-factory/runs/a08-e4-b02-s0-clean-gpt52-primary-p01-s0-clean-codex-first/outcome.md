# Outcome

Run: `a08-e4-b02-s0-clean-gpt52-primary-p01-s0-clean-codex-first`
Order: `codex-first`

## Lane Results

- `prompt-language`: `success` (completed)
- `codex-alone`: `success` (completed)

## Verification

- `prompt-language`: lint=pass, typecheck=pass, test=pass
- `codex-alone`: lint=pass, typecheck=pass, test=pass

## Throughput

- `prompt-language` time to green: 1274.08s
- `prompt-language` time to first relevant write: 133.15s
- `codex-alone` time to green: 717.36s
- `codex-alone` time to first relevant write: 154.33s
- admissible for throughput claim: false

## Verdict

- comparative verdict: `codex-alone-better`
- admissibility: `primary-comparison`
- reason: This is a clean paired timed run on the same common product contract, but throughput superiority remains provisional until order effects are counterbalanced or repeated clean pairs agree.
