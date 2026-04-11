# 2026-04-12 Codex Parity Full Run Evidence

Status: evidence note for `prompt-language-5pej.2`.

Run timestamp: `2026-04-12 05:37:45 +10:00` (Australia/Sydney).

This note records the parity matrix commands executed from this workspace on `D:\Visual Studio Projects\prompt-language`. It does not treat blocked live-host smoke as a pass, and it does not overwrite ownership of unrelated working-tree changes already present in the repo.

## Host and workspace context

- Host OS: `win32`
- Node: `v22.22.0`
- Workspace state before evidence capture: dirty worktree with unrelated changes already present outside this note
- In-scope quick Codex smoke script: `npm run eval:smoke:codex:quick`

## Command outcomes

| Command                          | Exit |           Duration | Classification           | Exact outcome                                                                                                         |
| -------------------------------- | ---- | -----------------: | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `npm run test`                   | `1`  | `00:00:49.8597441` | deterministic regression | Vitest failed `2` tests in `2` files; `2442` passed, `2` failed                                                       |
| `npm run ci`                     | `1`  | `00:03:06.7647857` | deterministic regression | Reached `format:check` and stopped on Prettier violations before later CI stages                                      |
| `npm run eval:smoke`             | `2`  | `00:00:12.7816911` | env/auth blocker         | Claude smoke preflight started, then blocked before any scenarios ran because Claude CLI login/access was unavailable |
| `npm run eval:smoke:codex:quick` | `1`  | `00:04:41.5162261` | deterministic regression | Codex quick smoke ran `27` scenarios in quick mode: `26` passed, `1` failed (`AK`)                                    |

## Deterministic regressions

### `npm run test`

The current branch state is not green in this workspace.

Failed tests:

- `src/presentation/validate-flow.test.ts`: `includes an expanded swarm flow preview when lowering occurs`
  - assertion expected `await all`
  - rendered flow instead showed `await "frontend"`
- `src/infrastructure/adapters/cli.test.ts`: `validate makes lowered swarm execution inspectable in the text preview`
  - assertion expected `Lowered swarm flow:`
  - actual output used `Expanded flow:`

These are deterministic product/test mismatches in the checked-out branch state, not host-auth blockers.

### `npm run ci`

`npm run ci` failed deterministically in the current branch state and did not reach the full CI tail because the chain short-circuited at formatting.

Observed blocker:

- `prettier --check` reported style issues in:
  - `docs/evaluation/context-adaptive-summary-safety-validation.md`
  - `src/application/artifacts/artifact-gate-state.ts`
  - `src/domain/flow-node.test.ts`
  - `src/domain/lint-flow.test.ts`

Because `ci` is a chained command, later stages after `format:check` did not execute in this run.

## Environment/auth blocker

### `npm run eval:smoke`

This command launched the live smoke harness and identified Claude CLI successfully, then stopped before scenario execution:

- Harness: `Claude CLI 2.1.45 (Claude Code)`
- Result: blocked before scenario start
- Scenario status: `0` scenarios run
- Classification: environment/auth blocker

Exact blocker text:

- `BLOCKED — Claude CLI login/access is unavailable in this environment.`
- ``claude -p` returned an authorization error; smoke scenarios were not run.`

This is not evidence of a prompt-language functional regression by itself. It is also not a supported-host pass.

## Codex quick smoke evidence

### `npm run eval:smoke:codex:quick`

This in-scope Codex smoke path was present and runnable in this workspace.

- Harness: `Codex CLI codex-cli 0.120.0`
- Result artifact: `scripts/eval/results/smoke-2026-04-11T19-37-30-499Z.json`
- Result timestamp in artifact: `2026-04-11T19:37:30.499Z`
- Quick-mode summary: `26` passed, `1` failed

Failed scenario:

- `AK: Grounded-by while loop`
  - error: `counter="count=0"`

This is a deterministic regression in the Codex quick smoke slice for the current branch state.

## Verdict

`prompt-language-5pej.2` should remain open from this workspace evidence.

What this run proves:

- repo-local validation is currently failing in this branch state
- live Claude smoke is still blocked here by auth/access before scenarios start
- the relevant Codex quick smoke exists and currently fails one scenario instead of passing cleanly

What this run does not prove:

- supported-host live parity through `npm run eval:smoke`
- a green full parity matrix for the current branch state
