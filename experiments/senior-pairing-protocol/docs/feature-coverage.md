# Feature Coverage

This experiment has two PL supervision lanes:

- `pl-senior-pairing-local` is the primary evidence arm. It stays compact so the
  comparison against `solo-local` and `persona-only-control` is interpretable.
- `pl-senior-pairing-v2-local` is an exploratory senior-program arm. It expands
  the compact flow with ranked criteria, explicit invariants, and a decision
  policy so we can test whether more scaffolding improves quality or overloads
  the local model.
- `pl-senior-pairing-full-local` is an exploratory feature probe. It verifies
  that the richer PL orchestration surfaces work with local runners before those
  surfaces are promoted into the primary evidence arm.

## Runner Model

Aider and Ollama do not parse Prompt Language directly. The Prompt Language
runtime parses and advances the flow, then sends each prompt turn to the chosen
runner. This means features such as `spawn`, `await`, `review`, `judge`, command
timeouts, and gates belong to the PL runtime. The local runner only needs to
handle the prompt turn or file edits it receives.

For spawned children, set `PL_SPAWN_RUNNER` to the same local runner when child
work should also use local inference:

```sh
$env:PL_SPAWN_RUNNER = "aider"
node bin/cli.mjs run --runner aider --file experiments/senior-pairing-protocol/flows/senior-pairing-full.flow
```

Use `PL_SPAWN_RUNNER=ollama` when running direct Ollama child sessions. Use
`PL_SPAWN_RUNNER=codex` only for deliberate frontier-model escalation.

Named `judge` blocks are prompt-language review surfaces. They do not by
themselves switch to a different runner. The hybrid arm therefore uses an
explicit `spawn "external_reviewer" model "gpt-5.2"` step; route that child
through `PL_SPAWN_RUNNER=codex` when the external review must use a frontier
model.

## Feature Matrix

| Feature               | Primary arm | V2 exploratory | Full probe | Reason                                                                                    |
| --------------------- | ----------- | -------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `let run` capture     | Yes         | Yes            | Yes        | Reads task and runtime telemetry from deterministic commands                              |
| `let prompt as json`  | Yes         | Yes            | Yes        | Captures senior frame and final review as structured data                                 |
| decision ladder       | No          | Yes            | Partial    | Tests ranked criteria and explicit option rejection                                       |
| `until` repair loops  | Yes         | Yes            | Yes        | Bounds test and verifier repair attempts                                                  |
| command timeouts      | Yes         | Yes            | Yes        | Prevents stuck tests from blocking slow local inference                                   |
| `review strict`       | Yes         | Yes            | Yes        | Forces grounded repair instead of self-declared completion                                |
| `rubric` / `judge`    | Hybrid only | No             | Yes        | Keeps external judging separate from deterministic gates                                  |
| `spawn` / `await`     | No          | No             | Yes        | Tests parent-controlled senior/junior separation                                          |
| child variable import | No          | No             | Yes        | Feeds risk and test-plan child outputs back to parent flow                                |
| `try` / `catch`       | No          | No             | Yes        | Handles intentional red-test failures without losing state                                |
| final gates           | Yes         | Harness-level  | Yes        | V2 uses harness checks so final senior artifacts are not skipped by early gate completion |

## Interpretation Rule

The full probe should not be used as the first proof that senior pairing works.
It uses more orchestration, more model calls, and potentially more context than
the primary arm. Treat it as a capability and failure-mode probe. If it clearly
outperforms the compact primary arm, run a follow-up ablation before making a
research claim.

The v2 exploratory arm should be interpreted as a scaffold-depth test. If it
beats compact PL, the follow-up question is which added surface caused the lift:
risk register, decision ranking, explicit invariants, red-test assessment, or
final evidence review.

V2 intentionally relies on the experiment harness for final `npm test` and
`node verify.js` checks. In-flow completion gates can complete the flow
immediately after deterministic checks pass, which prevents post-verification
senior-review artifacts from being captured.
