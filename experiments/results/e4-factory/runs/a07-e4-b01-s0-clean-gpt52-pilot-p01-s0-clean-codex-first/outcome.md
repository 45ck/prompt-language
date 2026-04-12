# Outcome

Run: `a07-e4-b01-s0-clean-gpt52-pilot-p01-s0-clean-codex-first`
Order: `codex-first`

## Lane Results

- `prompt-language`: `success` (completed)
- `codex-alone`: `success` (completed)

## Verification

- `prompt-language`: lint=pass, typecheck=pass, test=pass
- `codex-alone`: lint=pass, typecheck=pass, test=pass

## Throughput

- `prompt-language` time to green: 1582.81s
- `prompt-language` time to first relevant write: 132.88s
- `codex-alone` time to green: 856.94s
- `codex-alone` time to first relevant write: 293.67s
- admissible for throughput claim: false

## Verdict

- comparative verdict: `mixed`
- admissibility: `primary-comparison`
- reason: This is a clean paired timed run on the same common product contract, but throughput superiority remains provisional until order effects are counterbalanced or repeated clean pairs agree.
