# Codex Parity Matrix

This note is the closure-review matrix for `prompt-language-5pej.1`.

As of `2026-04-12`, the latest executed evidence comes from:

- [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)
- [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)
- [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md)

Historical April 11 green results remain useful context, but they do not override newer April 12 failures or blockers.

## Evidence Format

Use the same fields for every matrix row so closure review stays checkable.

| Field             | Required content                                                       |
| ----------------- | ---------------------------------------------------------------------- |
| `check`           | exact command or host-specific rerun path                              |
| `date`            | execution date or explicit `not rerun` marker                          |
| `host`            | OS, shell, runtime, and support posture                                |
| `result`          | exit code plus the shortest honest outcome summary                     |
| `classification`  | `pass`, `failed`, `blocked`, `not rerun`, or `historical context only` |
| `closure meaning` | whether the row blocks parity, supports parity, or is advisory only    |
| `source`          | checked-in evidence note or explicit `none in current note set`        |

## Exact Environment Constraints

| Constraint                 | Exact state                                                                                                                                         | Date         | Closure meaning                                                                 | Source                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows workspace          | Native Windows, `PowerShell`, Node `v22.22.0`, repo path `D:\Visual Studio Projects\prompt-language`                                                | `2026-04-12` | Valid for repo-local checks and evidence capture                                | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)                                                                     |
| Windows live-smoke support | Native Windows is still not the supported host for hooks or full live-smoke parity claims                                                           | `2026-04-12` | Do not treat Windows live-smoke attempts as supported-host closure proof        | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md), [Live Validation Evidence](eval-live-validation-evidence.md) |
| Windows auth state         | Claude CLI is installed but `npm run eval:smoke` blocked before scenarios because login/access was unavailable                                      | `2026-04-12` | External blocker for live smoke from this workspace                             | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)                                                                     |
| WSL runtime state          | WSL2 Ubuntu exists, but Node is `v18.19.1`, below repo engine floor `>=22.0.0`                                                                      | `2026-04-12` | WSL live smoke is blocked until the runtime is upgraded                         | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)                                                               |
| macOS execution            | Native macOS smoke cannot be executed from this Windows host                                                                                        | `2026-04-12` | macOS evidence must come from a real macOS host or hosted CI                    | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)                                                               |
| CI-safe smoke posture      | `npm run eval:smoke:ci` passed on Windows native and WSL Ubuntu; hosted CI already runs it on `ubuntu-latest`, `macos-latest`, and `windows-latest` | `2026-04-12` | Useful non-auth cross-platform evidence, but not a substitute for live smoke    | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md)                                                               |
| Worktree state             | Dirty worktree with unrelated existing changes                                                                                                      | `2026-04-12` | Results apply to the checked-out branch state, not a pristine baseline snapshot | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)                                                                     |

## Check Families

This is the exact required-versus-advisory split for `prompt-language-5pej.1`.

| Family                    | Checks                                                                               | Required now?                                                  | Why                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Repo-local regression bar | `npm run test`, `npm run ci`, `npm run eval:e2e`                                     | yes                                                            | These are the deterministic repo-local checks that must be green before any honest repo-local parity claim.                             |
| Supported-host live smoke | `npm run eval:smoke`                                                                 | yes                                                            | This is the mandatory live-loop proof for supported-host parity and for behavior touching hooks, parsing, advancement, state, or gates. |
| Fast runner regression    | `npm run eval:smoke:codex:quick`                                                     | advisory but high-signal                                       | This is the fastest Codex-specific regression signal, but it does not replace supported-host live smoke.                                |
| Broader comparative evals | `npm run eval:compare:quick`, `npm run eval:compare:v4:quick`, `npm run eval:verify` | advisory for `5pej.1`; required only for broader parity claims | These widen the claim beyond repo-local and live-smoke parity.                                                                          |

## Required Checks

These checks define the authoritative parity bar.

| Check                | Why required                            | Latest executed evidence                                                                                           | Date         | Host                                        | Classification | Closure meaning                                                       | Source                                                                                    |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------- | -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run test`       | Required repo-local regression signal   | Exit `1`; Vitest reported `2442` passed and `2` failed tests in `2` files                                          | `2026-04-12` | Windows native, Node `v22.22.0`             | `failed`       | Blocks any green repo-local parity claim for the current branch state | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md) |
| `npm run ci`         | Required repo-local quality gate        | Exit `1`; stopped at `format:check` on Prettier violations before later CI stages                                  | `2026-04-12` | Windows native, Node `v22.22.0`             | `failed`       | Blocks any green repo-local parity claim for the current branch state | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md) |
| `npm run eval:e2e`   | Required repo-local eval runner signal  | No fresh executed evidence found in the checked-in April 11-12 note set                                            | `not rerun`  | No current executed-host record             | `not rerun`    | Prevents a fresh April 12 repo-local eval-runner claim                | none in current note set                                                                  |
| `npm run eval:smoke` | Required for supported-host live parity | Exit `2`; preflight started, then blocked before any scenarios ran because Claude CLI login/access was unavailable | `2026-04-12` | Windows native, unsupported for live parity | `blocked`      | Keeps supported-host parity open; do not convert this into a pass     | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md) |

## Advisory Checks

These checks add confidence or diagnostic context, but they do not replace the required bar.

| Check                                                          | Why advisory                                           | Latest executed evidence                                                                       | Date         | Host                                | Classification            | Closure meaning                                                                                                        | Source                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run eval:smoke:codex:quick`                               | Fast Codex runner regression signal                    | Exit `1`; quick suite ran `27` scenarios, `26` passed and `AK` failed                          | `2026-04-12` | Windows native, Codex CLI `0.120.0` | `failed`                  | Strong warning that the quick Codex slice regressed in the current branch state; still not a supported-host substitute | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)   |
| `npm run eval:smoke:codex:quick`                               | Historical comparison point                            | Prior checked-in quick suite recorded `27/27` passing                                          | `2026-04-11` | Windows native                      | `historical context only` | Useful for delta analysis only; does not override the April 12 failure                                                 | [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md) |
| `npm run eval:smoke:gemini:quick`                              | Fast Gemini regression signal over the same subset     | No fresh executed evidence found in the checked-in April 11-12 note set                        | `not rerun`  | No current executed-host record     | `not rerun`               | Runnable path exists, but no closure-relevant April 12 result is recorded                                              | none in current note set                                                                    |
| `node scripts/eval/smoke-test.mjs --history`                   | Summarizes stored smoke history and fail streaks       | Ran successfully and reported `31` stored smoke runs from `scripts/eval/results/history.jsonl` | `2026-04-11` | Windows native                      | `pass`                    | Trend evidence only; cannot backfill live-host proof                                                                   | [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md) |
| `npm run eval:compare:quick`                                   | Comparative parity signal against baseline experiments | No fresh executed evidence found in the checked-in April 11-12 note set                        | `not rerun`  | No current executed-host record     | `not rerun`               | Leaves broader comparative parity unproven                                                                             | none in current note set                                                                    |
| `npm run eval:compare:v4:quick`                                | Newer comparative parity signal                        | No fresh executed evidence found in the checked-in April 11-12 note set                        | `not rerun`  | No current executed-host record     | `not rerun`               | Leaves broader comparative parity unproven                                                                             | none in current note set                                                                    |
| `npm run eval:verify`                                          | Stronger verification benchmark                        | No fresh executed evidence found in the checked-in April 11-12 note set                        | `not rerun`  | No current executed-host record     | `not rerun`               | Leaves stronger verification claims unproven                                                                           | none in current note set                                                                    |
| `node scripts/eval/smoke-test.mjs --harness codex`             | Direct harness execution path                          | Implemented, but no fresh executed evidence found in the checked-in April 11-12 note set       | `not rerun`  | No current executed-host record     | `not rerun`               | Capability exists, but no current closure evidence                                                                     | none in current note set                                                                    |
| `node scripts/eval/smoke-test.mjs --harness gemini`            | Direct harness execution path                          | Implemented, but no fresh executed evidence found in the checked-in April 11-12 note set       | `not rerun`  | No current executed-host record     | `not rerun`               | Capability exists, but no current closure evidence                                                                     | none in current note set                                                                    |
| `AI_CMD=\"gemini -p --yolo\" node scripts/eval/smoke-test.mjs` | Custom command-template override                       | Supported path, but no fresh executed evidence found in the checked-in April 11-12 note set    | `not rerun`  | No current executed-host record     | `not rerun`               | Confirms configurability only, not parity                                                                              | none in current note set                                                                    |

## Current Claim-Level Status

This is the current parity status implied by the repo-local evidence above.

| Claim level                 | Current status | Why                                                                                                                                                        |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo-local Codex parity     | not satisfied  | `npm run test` and `npm run ci` are both failing in the latest checked-in evidence, and `npm run eval:e2e` has no fresh rerun in the April 11-12 note set. |
| Supported-host Codex parity | not satisfied  | `npm run eval:smoke` is still blocked before scenarios on this host, and no passing supported-host live-smoke rerun is checked in.                         |
| Broader eval parity         | not satisfied  | Compare and verify reruns are still missing from the latest checked-in evidence.                                                                           |

## Blocked Checks And External Reruns

These are the concrete blocked paths that still need external resolution.

| Check or path                            | Blocker class            | Exact reason                                                                                                                                      | Date         | Required rerun path                                                                       | Source                                                                                          |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run eval:smoke` on Windows native   | `BLOCKED_AUTH`           | Claude CLI login/access unavailable before scenario execution; `0` scenarios ran                                                                  | `2026-04-12` | Rerun on a supported Linux, macOS, or upgraded WSL host with authenticated harness access | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)       |
| Live smoke from WSL Ubuntu               | `BLOCKED_RUNTIME`        | WSL Node `v18.19.1` is below the repo engine floor `>=22.0.0`; smoke start failed with `ERR_INVALID_ARG_TYPE` before live auth could be validated | `2026-04-12` | Upgrade WSL Node to `22` or newer, then rerun limited live smoke                          | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md) |
| Native macOS smoke from this workstation | `NOT_EXECUTABLE_ON_HOST` | This Windows machine cannot execute native macOS smoke                                                                                            | `2026-04-12` | Run on a real macOS host or archive hosted CI/macOS evidence separately                   | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md) |

## Closure Review Reading

- `prompt-language-5pej.1` owns the matrix definition, required-versus-advisory split, and evidence format.
- The tables above are intentionally based on repo-local checked-in evidence only; they do not infer unsupported-host passes or carry forward stale green runs as current truth.
- The matrix is now explicit about April 12 failures, stale evidence, and external blockers instead of carrying forward the earlier all-green snapshot.
- This matrix refresh does not claim `prompt-language-5pej.2` is green. It records that full execution parity remains open.
- The only closure blocker that is still external to this docs task is the existing dependency on `prompt-language-72a5.6` for supported-host smoke/support-matrix evidence.
