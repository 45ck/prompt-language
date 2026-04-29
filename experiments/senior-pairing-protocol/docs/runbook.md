# Runbook

## Preconditions

- Ollama is running and the selected local model is available.
- The task workspace contains `TASK.md`, `package.json`, `npm test`, and
  `verify.js`.
- The runner timeout is large enough for local inference. Use long process
  timeouts; do not treat slow local inference as failure unless it exceeds the
  run budget.
- `PROMPT_LANGUAGE_AIDER_TIMEOUT_MS`, `PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS`,
  `PROMPT_LANGUAGE_CODEX_TIMEOUT_MS`, and `PROMPT_LANGUAGE_GATE_TIMEOUT_MS` are
  set to the budgets in `manifests/experiment-manifest.json`.
- The branch is clean before each run.

## Suggested Models

| Role                   | Suggested Route                                    |
| ---------------------- | -------------------------------------------------- |
| Bulk implementation    | Local Ollama model through Aider-compatible runner |
| Senior-pairing flow    | Same local model, controlled by prompt-language    |
| Final high-risk review | Codex/GPT-class external judge when available      |

## Run Order

1. Choose a randomized arm order for the task/repeat pair and record the seed.
2. Copy the task fixture to a fresh workspace.
3. Run exactly one arm.
4. Archive the raw result bundle.
5. Reset to a fresh copy before the next arm.
6. Run `pl-senior-pairing-full-local` only after the compact PL arm is valid.
7. Run `pl-hybrid-judge` from a fresh fixture when frontier review is part of
   the planned arm order; do not run it as a rescue over a previous workspace.
8. Score deterministic outcome first.
9. Score senior-behavior rubric second.
10. Record runtime as telemetry.

## Flow Validation

Validate flow syntax before live runs:

```sh
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/solo-baseline.flow
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/persona-control.flow
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/senior-pairing-v1.flow
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/senior-pairing-full.flow
node bin/cli.mjs validate experiments/senior-pairing-protocol/flows/hybrid-judge-v1.flow
```

Validate the local-runner execution surface before a live run:

```sh
node bin/cli.mjs validate --runner aider --mode headless --file experiments/senior-pairing-protocol/flows/senior-pairing-full.flow
node bin/cli.mjs validate --runner ollama --mode headless --file experiments/senior-pairing-protocol/flows/senior-pairing-full.flow
```

For spawned child flows, route children through the intended local runner:

```sh
$env:PL_SPAWN_RUNNER = "aider"
$env:PROMPT_LANGUAGE_AIDER_TIMEOUT_MS = "900000"
$env:PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS = "900000"
$env:PROMPT_LANGUAGE_CODEX_TIMEOUT_MS = "900000"
$env:PROMPT_LANGUAGE_GATE_TIMEOUT_MS = "300000"
node bin/cli.mjs run --runner aider --file experiments/senior-pairing-protocol/flows/senior-pairing-full.flow
```

For `pl-hybrid-judge`, set `PL_SPAWN_RUNNER=codex` before running the arm so the
`external_reviewer` child uses the frontier route. Keep bulk implementation on
the parent local runner.

## Result Artifact Requirements

Each run should produce:

- `run-manifest.json`
- `runner-stdout.txt`
- `runner-stderr.txt`
- `verify-stdout.txt`
- `verify-stderr.txt`
- `final-diff.patch`
- `senior-frame.json`
- `risk-report.json`
- `test-plan.json`
- `final-self-review.json`
- `oracle-access-log.txt`
- `scorecard.json`
- `notes.md`

## Timeout Policy

Runtime is not a primary score. Use generous timeouts:

- Local model prompt turn: at least 900 seconds.
- Spawned child await budget: at least 900 seconds for read-only reviewers and
  1800 seconds for implementation.
- Test command: at least 300 seconds.
- Verifier command: at least 300 seconds.
- Whole arm: record wall time; classify timeouts separately.

Timeouts matter operationally, but the first research question is quality.
