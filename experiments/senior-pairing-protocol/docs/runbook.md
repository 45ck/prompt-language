# Runbook

## Preconditions

- Ollama is running and the selected local model is available.
- The task workspace contains `TASK.md`, `package.json`, `npm test`, and
  `verify.js`.
- The runner timeout is large enough for local inference. Use long process
  timeouts; do not treat slow local inference as failure unless it exceeds the
  run budget.
- The branch is clean before each run.

## Suggested Models

| Role                   | Suggested Route                                    |
| ---------------------- | -------------------------------------------------- |
| Bulk implementation    | Local Ollama model through Aider-compatible runner |
| Senior-pairing flow    | Same local model, controlled by prompt-language    |
| Final high-risk review | Codex/GPT-class external judge when available      |

## Run Order

1. Copy the task fixture to a fresh workspace.
2. Run `solo-local`.
3. Reset to a fresh copy of the same task fixture.
4. Run `persona-only-control`.
5. Reset to a fresh copy of the same task fixture.
6. Run `pl-senior-pairing-local`.
7. If the task is high-risk or ambiguous, run `pl-hybrid-judge`.
8. Score deterministic outcome first.
9. Score senior-behavior rubric second.
10. Record runtime as telemetry.

## Flow Validation

Validate flow syntax before live runs:

```sh
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/solo-baseline.flow
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/persona-control.flow
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/senior-pairing-v1.flow
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/hybrid-judge-v1.flow
```

## Result Artifact Requirements

Each run should produce:

- `run-manifest.json`
- `runner-stdout.txt`
- `runner-stderr.txt`
- `verify-stdout.txt`
- `verify-stderr.txt`
- `final-diff.patch`
- `scorecard.json`
- `notes.md`

## Timeout Policy

Runtime is not a primary score. Use generous timeouts:

- Local model prompt turn: at least 900 seconds.
- Test command: at least 300 seconds.
- Verifier command: at least 300 seconds.
- Whole arm: record wall time; classify timeouts separately.

Timeouts matter operationally, but the first research question is quality.
