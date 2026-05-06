# Harness Conformance Matrix

This page defines what it means for prompt-language to work on top of an
agent harness. It is a coverage contract, not a claim that every live provider
is always available on every workstation.

For live cloud and local inference evidence requirements, use the
[Live Inference Test Matrix](live-inference-test-matrix.md).

## Support Levels

| Level                  | Meaning                                                                                            | Claim boundary                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `native-flow-runner`   | `prompt-language ci --runner <name>` drives PL flow execution through that harness adapter.        | PL parsing, state, advancement, gates, traces, and runner wiring are in scope. |
| `prompt-template-only` | The eval harness can send prompts to the CLI, but there is no dedicated `ci --runner <name>` path. | Useful for comparison, not a full PL-on-top conformance claim.                 |
| `custom-command`       | `AI_CMD` runs an operator-provided command template.                                               | Only the template invocation is covered unless the command itself runs PL.     |

## Current Harnesses

| Harness  | Current level          | Prompt path                 | Flow path                              | Required deterministic coverage                                | Required live evidence                         |
| -------- | ---------------------- | --------------------------- | -------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| Claude   | `native-flow-runner`   | `claude -p`                 | `prompt-language ci --runner claude`   | adapter tests, hook tests, smoke catalog, conformance guard    | `npm run eval:smoke` on a supported auth host  |
| Codex    | `native-flow-runner`   | `codex exec`                | `prompt-language ci --runner codex`    | adapter tests, Codex runner tests, smoke catalog, guard        | `npm run eval:smoke:codex`                     |
| OpenCode | `native-flow-runner`   | `opencode run`              | `prompt-language ci --runner opencode` | adapter tests, OpenCode runner tests, smoke catalog, guard     | `npm run eval:smoke:opencode`                  |
| Ollama   | `native-flow-runner`   | `ollama run`                | `prompt-language ci --runner ollama`   | adapter tests, Ollama runner tests, smoke catalog, guard       | `npm run eval:smoke:ollama` with model pinned  |
| Aider    | `native-flow-runner`   | `python -m aider --message` | `prompt-language ci --runner aider`    | adapter tests, Aider runner tests, smoke catalog, guard        | `npm run eval:smoke:aider` with timeout budget |
| Gemini   | `prompt-template-only` | `gemini -p --yolo`          | prompt-template fallback               | harness selection, smoke command exposure, guard documentation | `npm run eval:smoke:gemini` as comparison only |
| `AI_CMD` | `custom-command`       | operator-provided command   | same template unless it invokes PL     | template parsing and precedence tests                          | command-specific evidence bundle               |

## Feature Coverage Bar

The live smoke catalog is the feature-level suite. The CI guard
`npm run harness:conformance` checks that the catalog still contains coverage
for these families:

| Family                   | Representative smoke ids                 | Why it matters                                           |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| Context relay            | `A`, `B`                                 | Proves context survives harness invocation boundaries.   |
| Variables/interpolation  | `C`, `K`, `Z`                            | Proves PL resolves values before the model sees prompts. |
| Gates                    | `D`, `M`, `R`, `AS`                      | Proves completion is decided by verifiable conditions.   |
| Runs and shell actions   | `E`                                      | Proves deterministic command nodes still execute.        |
| Foreach and lists        | `F`, `Q`, `S`, `T`, `Z1`                 | Proves repeated state mutation works across turns.       |
| Captures                 | `G`, `N`, `Z3`, `Z4`                     | Proves model output is captured and reusable.            |
| Branching                | `H`, `U`, `V`                            | Proves conditions route control flow correctly.          |
| Try/catch/finally        | `I`, `W`, `AU`                           | Proves failure handling and cleanup semantics.           |
| Loops                    | `J`, `O`, `Y`, `AK`, `AL`                | Proves bounded repetition and grounded conditions.       |
| Retry/backoff            | `L`, `AR`                                | Proves bounded retry does not become unbounded waiting.  |
| Break/continue           | `P`, `X`, `AI`, `AW`                     | Proves loop control semantics.                           |
| Approve/review/memory    | `AA`, `AB`, `AC`, `AJ`                   | Proves hook-dependent and memory behavior where valid.   |
| Spawn/swarm/race/IPC     | `AD`, `AE`, `AF`, `AM`, `AN`, `AP`, `AQ` | Proves multi-agent coordination and message flow.        |
| Imports/includes         | `AG`, `AH`, `AO`                         | Proves flow composition and file inclusion.              |
| Snapshots/state recovery | `AX`, `BA`                               | Proves checkpoint-style state behavior.                  |
| Agent/profile/skills     | `AY`, `AZ`                               | Proves spawned agent metadata and profile binding.       |

## CI Guard

`npm run harness:conformance` fails when:

- a supported harness is removed from selection or label routing
- a `native-flow-runner` loses its `exec<Name>Flow` path
- an npm full or quick smoke command disappears
- the harness selection or contract tests stop naming a supported harness
- a required smoke feature family loses all listed scenario ids
- the smoke JSON report loses harness/model/timeout/trace metadata
- the live inference matrix stops naming cloud/local harnesses and telemetry fields

`npm run harness:conformance:test` imports the same guard and keeps it under the
Node test runner. Both are part of `npm run ci`.

`npm run eval:harness:adapter:test` runs the low-level eval harness adapter
tests under `scripts/eval/harness.test.mjs`. This protects traced launch-spec
behavior, Windows binary selection, and Aider environment normalization.

## Claim Rules

Do not claim a harness fully works because this guard passes. The guard proves
that deterministic coverage is wired and that live smoke has a runnable entry
point.

Do claim a harness is live-conformant only when its deterministic tests pass and
the matching live smoke command has a fresh evidence bundle for the current
branch, model, OS, and auth state.

Treat Gemini and `AI_CMD` as comparison layers until they invoke a real
`prompt-language ci --runner ...` path or gain a native runner adapter.
