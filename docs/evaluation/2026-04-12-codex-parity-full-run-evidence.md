# 2026-04-12 Codex Parity Full Run Evidence

Status: evidence note for `prompt-language-5pej.2`.

Run timestamp: `2026-04-12 10:00:02 +10:00` (Australia/Sydney).

This note records the latest parity-command reruns from the Windows workspace at
`D:\Visual Studio Projects\prompt-language`. Earlier April 12 snapshots are now
stale for closure review where they disagree with the command outputs below.

## Host and workspace context

- Host OS: `win32`
- Shell: `PowerShell`
- Node: `v22.22.0`
- Package version: `0.3.0`
- Workspace state before evidence capture: dirty worktree with unrelated changes
  already present outside this note
- In-scope quick Codex smoke script: `npm run eval:smoke:codex:quick`

## Command outcomes

| Command                          | Exit          | Classification           | Exact outcome                                                                                                                                            |
| -------------------------------- | ------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`                   | `1`           | deterministic regression | Vitest reported `109` files total with `108` passed and `1` failed; `2635` tests passed and `2` failed, both in `src/application/inject-context.test.ts` |
| `npm run ci`                     | `1`           | deterministic regression | `typecheck` passed, then `lint` failed on `src/application/advance-flow.ts:576` with `prefer-const`                                                      |
| `npm run eval:e2e`               | `1`           | deterministic regression | `build` succeeded, `e2e-eval` started, `A1` failed with `spawnSync C:\WINDOWS\system32\cmd.exe ETIMEDOUT`, then cleanup hit `EBUSY` on the temp dir      |
| `npm run eval:smoke`             | `1`           | env/auth blocker         | `build` and `install` succeeded, then live smoke blocked before scenarios because Claude CLI login/access was unavailable                                |
| `npm run eval:smoke:codex:quick` | local timeout | blocked/inconclusive     | Command did not complete within the local `604013 ms` timeout window; no closure-relevant result was captured                                            |

## Repo-local test signal

### `npm run test`

The current branch state is not green in this workspace.

Latest failed assertions:

- `src/application/inject-context.test.ts`
  - `falls back to full variable injection when interpolation syntax is uncertain`
  - expected prompt content to contain `repo = auth module`
- `src/application/inject-context.test.ts`
  - `truncates long stdout at 2000 chars`
  - expected captured `last_stdout` to contain `... (truncated)` but it was
    `artifact:s1/runtime-output-r1-stdout`

These are deterministic product or test mismatches in the checked-out branch
state, not environment-auth blockers.

## Repo-local quality gate

### `npm run ci`

`npm run ci` no longer stops in typecheck on this branch state. The latest rerun
got through `typecheck` and failed in `lint`.

Observed blocker:

- `src/application/advance-flow.ts:576`
  - ESLint: `'next' is never reassigned. Use 'const' instead`
  - rule: `prefer-const`

Because `ci` is a chained command, later stages after `lint` did not execute in
this run.

## Repo-local eval runner signal

### `npm run eval:e2e`

`npm run eval:e2e` now gets past `build`, so the current blocker is not the
earlier `render-flow.ts` typecheck failure.

Observed failure:

- `[e2e-eval] Phase A: Deterministic hook pipe-through`
- `FAIL  A1: NL input triggers meta-prompt — spawnSync C:\WINDOWS\system32\cmd.exe ETIMEDOUT`
- `[e2e-eval] Fatal error: EBUSY: resource busy or locked, rmdir 'C:\Users\Admin\AppData\Local\Temp\e2e-eval-WXZbCM'`

This still blocks a green repo-local eval-runner parity claim for the current
branch state.

## Environment and auth blocker

### `npm run eval:smoke`

This command successfully completed the local pre-build and install path, then
stopped before scenario execution:

- install step completed successfully
- harness version: `Claude CLI 2.1.45 (Claude Code)`
- scenario status: `0` scenarios run
- classification: environment/auth blocker

Exact blocker text:

- `BLOCKED — Claude CLI login/access is unavailable in this environment.`
- ``claude -p` returned an authorization error; smoke scenarios were not run.`

This is not evidence of a prompt-language functional regression by itself. It is
also not a supported-host pass.

## Codex quick smoke status

### `npm run eval:smoke:codex:quick`

The latest direct rerun did not finish inside the local timeout budget used for
this evidence refresh.

- local timeout window: `604013 ms`
- captured result: none beyond timeout
- classification: blocked/inconclusive

This means the repo still lacks a fresh closure-ready quick-smoke result from
this workspace for the current branch state.

## Verdict

`prompt-language-5pej.2` should remain open from this workspace evidence.

What this run proves:

- repo-local validation is currently not green in this branch state
- the current `ci` blocker is lint, not typecheck
- the current `eval:e2e` blocker is inside the evaluator after a successful
  build
- live Claude smoke is still blocked here by auth/access before scenarios start
- the latest quick Codex smoke rerun did not yield a usable result inside the
  local timeout window

What this run does not prove:

- supported-host live parity through `npm run eval:smoke`
- a green full parity matrix for the current branch state
- a fresh passing Codex quick-smoke result
