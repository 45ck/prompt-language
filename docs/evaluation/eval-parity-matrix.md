# Codex Parity Matrix

This note records the validation bar for Codex parity runs and the evidence collected in this workspace.

## Required commands

| Command              | Expected outcome                                      | Evidence to capture                                                               |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run test`       | Pass                                                  | Exit code, test summary, date, environment                                        |
| `npm run ci`         | Pass                                                  | Exit code, CI summary, coverage summary, date, environment                        |
| `npm run eval:e2e`   | Pass                                                  | Exit code, phase summary, date, environment                                       |
| `npm run eval:smoke` | Pass on a supported host with selected harness access | Exit code, scenario summary, blocked/unsupported reason if any, date, environment |

## Advisory commands

| Command                                                      | Why it matters                                               | Status in this workspace |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------ |
| `node scripts/eval/smoke-test.mjs --history`                 | Local smoke-history summary with pass rates and fail streaks | Implemented              |
| `npm run eval:smoke:codex:quick`                             | Fast Codex regression signal over the quick smoke subset     | `27/27` passed           |
| `node scripts/eval/smoke-test.mjs --harness codex`           | Runs smoke through Codex CLI harness                         | Implemented              |
| `node scripts/eval/smoke-test.mjs --harness gemini`          | Runs smoke through Gemini CLI harness                        | Implemented              |
| `AI_CMD="gemini -p --yolo" node scripts/eval/smoke-test.mjs` | Uses a custom AI command template override                   | Implemented              |
| `npm run eval:compare:quick`                                 | Quick parity signal for comparative experiments              | Not rerun in this pass   |
| `npm run eval:verify`                                        | Stronger verification benchmark when the host supports it    | Not rerun in this pass   |
| `npm run eval:compare:v4:quick`                              | Newer comparative eval for regression deltas                 | Not rerun in this pass   |

## Supported-host expectation

- Live smoke is mandatory for feature-level QA, but it requires a host where the selected harness command can authenticate and execute.
- Native Windows remains unsupported for hooks and live smoke parity.
- When auth is missing, the harness should fail fast with one explicit blocker instead of running empty scenarios.
- `node scripts/eval/smoke-test.mjs --history` is a local analysis tool only. It summarizes stored smoke runs, pass rates, and fail streaks, but it does not validate the live host.

## How to read this matrix

- `npm run test`, `npm run ci`, and `npm run eval:e2e` are repo-side evidence.
- `npm run eval:smoke` is host-side evidence and is the only entry that proves the plugin works through a real agent loop.
- If smoke is blocked, the gap is environmental, not a passing signal.

## Workspace evidence

- `npm run test`: passed
- `npm run ci`: passed
- `npm run eval:e2e`: passed
- `npm run eval:smoke:codex:quick`: passed `27/27`
- `npm run eval:smoke`: blocked by missing Claude login/access in this environment

## Notes

- This matrix is the current source of truth for the Codex parity task tracked in Beads.
- The quick Codex pass is useful evidence for the headless runner path, but it does not replace supported-host live smoke.
- Unsupported or blocked commands stay in the matrix so the gap stays visible until a supported run is available.
