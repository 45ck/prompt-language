# Codex Parity Matrix

This note records the validation bar for Codex parity runs and the evidence collected in this workspace.

## Required commands

| Command              | Expected outcome                            | Evidence to capture                                                               |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run test`       | Pass                                        | Exit code, test summary, date, environment                                        |
| `npm run ci`         | Pass                                        | Exit code, CI summary, coverage summary, date, environment                        |
| `npm run eval:e2e`   | Pass                                        | Exit code, phase summary, date, environment                                       |
| `npm run eval:smoke` | Pass on a supported host with Claude access | Exit code, scenario summary, blocked/unsupported reason if any, date, environment |

## Advisory commands

| Command                         | Why it matters                                            | Status in this workspace |
| ------------------------------- | --------------------------------------------------------- | ------------------------ |
| `npm run eval:compare:quick`    | Quick parity signal for comparative experiments           | Not rerun in this pass   |
| `npm run eval:verify`           | Stronger verification benchmark when the host supports it | Not rerun in this pass   |
| `npm run eval:compare:v4:quick` | Newer comparative eval for regression deltas              | Not rerun in this pass   |

## Supported-host expectation

- Live smoke is mandatory for feature-level QA, but it requires a host where `claude -p` can authenticate.
- Native Windows remains unsupported for hooks and live smoke parity.
- When auth is missing, the harness should fail fast with one explicit blocker instead of running empty scenarios.

## Workspace evidence

- `npm run test`: passed
- `npm run ci`: passed
- `npm run eval:e2e`: passed
- `npm run eval:smoke`: blocked by missing Claude login/access in this environment

## Notes

- This matrix is the current source of truth for the Codex parity task tracked in Beads.
- Unsupported or blocked commands stay in the matrix so the gap stays visible until a supported run is available.
