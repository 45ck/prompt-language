# Time Policy

Local inference can be slow. This experiment is not primarily a speed benchmark.

## Recording

Record:

- prompt-turn duration
- wall-clock duration per arm
- verifier duration
- timeout classification
- GPU-active notes if available

## Scoring

Runtime is telemetry for this phase. It should not decide the winner unless two
arms are otherwise equivalent and one is operationally extreme.

## Timeout Classification

- `solution-timeout`: the model did useful work but exceeded the arm budget.
- `capture-timeout`: the model did not return a usable response.
- `command-timeout`: tests or verifier exceeded command budget.
- `no-edit-timeout`: no workspace progress occurred before timeout.
