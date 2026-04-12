# Outcome

Run: `20260412-1407-a06-core-proof-paired-clean`
Order: `codex-first`

## Lane Results

- `prompt-language`: `success` (completed)
- `codex-alone`: `success` (completed)

## Verification

- `prompt-language`: lint=pass, typecheck=pass, test=pass
- `codex-alone`: lint=pass, typecheck=pass, test=pass

## Throughput

- `prompt-language` time to green: 1342.1s
- `prompt-language` time to first code: 150.11s
- `codex-alone` time to green: 770.94s
- `codex-alone` time to first code: 379.81s
- admissible for throughput claim: false

## Verdict

- comparative verdict: `mixed`
- admissibility: `primary-comparison`
- reason: Both lanes completed the same common product contract under the same frozen bootstrap with explicit timings, complete traces, and no runtime confounds. This is a clean paired timing read, but throughput superiority remains provisional because the run is a single fixed-order pair.
