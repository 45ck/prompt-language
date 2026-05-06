<!-- cspell:ignore Ollama qwen EPIPE -->

# Spawned Agent Team Rollout Evidence: 2026-05-06

This note records the evidence boundary for the local spawned-agent-team runtime
rollout on 2026-05-06.

## Commits

| Commit    | Subject                                           | Scope                                                                 |
| --------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| `d02bcae` | `feat(runtime): enable local spawned agent teams` | Runtime spawn model inheritance, named-agent profile use, WSL support |
| `0d4b43a` | `chore(hooks): enable local git hooks`            | `pre-commit` and `commit-msg` executable bits                         |
| `43aa46d` | `chore(hooks): enable pre-push hook`              | `pre-push` executable bit                                             |

All three commits were pushed to `origin/main`.

## Local Verification

The following checks passed locally from the rollout head:

| Check                          | Result                                              |
| ------------------------------ | --------------------------------------------------- |
| `npm run format:check`         | Pass                                                |
| `npm run lint`                 | Pass                                                |
| `npm run spell`                | Pass                                                |
| `npm run ci`                   | Pass                                                |
| `npm run test:coverage`        | `138` test files passed; `3168` passed; `2` skipped |
| `npm run eval:e2e`             | `6/6` passed                                        |
| Focused live Ollama team smoke | `4/4` passed for `AM,AN,AP,AQ`                      |

The focused live smoke used the local Ollama runner with
`ollama/qwen3-opencode-big:30b` against the spawned-agent/swarm scenarios. It is
success evidence for the team-spawn path, not full live-suite parity evidence.

## Hook Enforcement

The local Git hooks are now tracked as executable:

| Hook                   | Mode     |
| ---------------------- | -------- |
| `.githooks/pre-commit` | `100755` |
| `.githooks/commit-msg` | `100755` |
| `.githooks/pre-push`   | `100755` |

The final push exercised the `pre-push` hook. It ran typecheck and the full
non-coverage test suite successfully before publishing `43aa46d`.

## Remote CI Boundary

GitHub Actions triggered for `43aa46d`, but jobs did not start. GitHub reported:

> The job was not started because your account is locked due to a billing issue.

Affected pushed runs:

| Workflow                   | Run ID        | Status  | Boundary                        |
| -------------------------- | ------------- | ------- | ------------------------------- |
| `quality`                  | `25417800563` | Failure | GitHub billing lock before jobs |
| `Cross-Platform CI Matrix` | `25417800572` | Failure | GitHub billing lock before jobs |

These failures are not code failures. The remote blocker is account billing
state; after that is resolved, rerun the failed workflows.

## Claim Boundary

This rollout proves:

- Headless child spawns can inherit the selected parent model unless an explicit
  spawn, agent, or profile model overrides it.
- Named agent references now apply their configured profile context to child
  goals.
- Windows and WSL spawn-path edge cases are covered for state roots and runner
  binary probing.
- Local hook enforcement is active for commit and push operations.

This rollout does not prove:

- Full live smoke parity across all local-model scenarios.
- Remote GitHub CI success, because GitHub did not start jobs while the account
  was billing-locked.
