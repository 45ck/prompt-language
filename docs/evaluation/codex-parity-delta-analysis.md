# Codex Parity Delta Analysis

This note answers the narrower review question behind `prompt-language-5pej.3`: given the latest checked-in execution evidence, what is still at parity, what has regressed, and what remains blocked for external reasons?

As of `2026-04-12`, the repo has enough evidence to classify the remaining gaps precisely. It does not have enough evidence to claim a green full-parity run.

## Evidence Base Used

| Surface                           | Current checked-in evidence                                                                                                                                | Date         | Source                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Repo-local execution matrix       | Required versus advisory versus blocked checks now separated with exact April 12 outcomes and host constraints                                             | `2026-04-12` | [Codex Parity Matrix](eval-parity-matrix.md)                                                    |
| Full workspace parity run         | `npm run test` failed, `npm run ci` failed, `npm run eval:smoke` blocked on Claude auth, and `npm run eval:smoke:codex:quick` failed `AK`                  | `2026-04-12` | [2026-04-12 Codex Parity Full Run Evidence](2026-04-12-codex-parity-full-run-evidence.md)       |
| Cross-platform smoke posture      | Windows and WSL `eval:smoke:ci` passed; Windows live smoke blocked on auth; WSL live smoke blocked on Node `v18.19.1`; macOS not executable from this host | `2026-04-12` | [2026-04-12 Cross-Platform Smoke Verification](2026-04-12-cross-platform-smoke-verification.md) |
| Earlier green quick-smoke context | Historical `27/27` Codex quick-smoke pass remains recorded, but only as prior context                                                                      | `2026-04-11` | [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md)     |
| Live-validation contract          | Supported-host versus blocked-host handling is already defined and remains unchanged                                                                       | `2026-04-11` | [Live Validation Evidence](eval-live-validation-evidence.md)                                    |

## Delta Classification

| Surface                         | Latest status                                                                       | Baseline expectation                                             | Classification                                      | Why it matters                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Repo-local `npm run test`       | Exit `1`; `2442` passed, `2` failed                                                 | Pass                                                             | Deterministic branch-state regression               | Blocks any honest claim that the current branch is green on the repo-local validation bar.    |
| Repo-local `npm run ci`         | Exit `1`; stopped at `format:check` on Prettier violations                          | Pass                                                             | Deterministic branch-state regression               | Blocks any honest claim that the current branch is green on the full repo-local quality gate. |
| Repo-local `npm run eval:e2e`   | No fresh rerun in the April 12 evidence set                                         | Pass                                                             | Fresh evidence gap                                  | The matrix can still require it, but the current slice cannot claim it was rerun.             |
| Codex quick smoke               | Exit `1`; `26/27` passed and `AK` failed                                            | Pass on the quick subset                                         | Deterministic regression in the current Codex slice | This is the clearest April 12 Codex-specific regression signal in the checked-in evidence.    |
| Historical Codex quick smoke    | Prior `27/27` pass still recorded                                                   | Historical context only                                          | Expected variance in time, not current proof        | Useful for comparison, but it cannot override the newer failure.                              |
| Supported-host live smoke       | No passing supported-host `npm run eval:smoke` is checked in                        | Required for full parity                                         | Open evidence gap                                   | The repo still lacks supported-host live-smoke proof through the real agent loop.             |
| Windows live smoke              | Blocked before scenarios by missing Claude auth/login                               | Either pass on supported host or fail fast with explicit blocker | Environment blocker                                 | This is a real blocker, but it is external to product behavior because no scenarios ran.      |
| WSL live smoke                  | Blocked by Node `v18.19.1` and `ERR_INVALID_ARG_TYPE` before live smoke could start | Runnable supported-host path                                     | Environment blocker                                 | WSL is present, but the local runtime does not yet meet the repo engine floor.                |
| Windows and WSL `eval:smoke:ci` | Passed `73/0` on both paths                                                         | Pass                                                             | Supporting evidence, not parity proof               | Confirms cross-platform CI-safe smoke posture, but not live authenticated smoke.              |
| Comparative reruns              | `npm run eval:compare:quick` and `npm run eval:compare:v4:quick` not rerun          | Fresh comparative evidence for broader parity claims             | Open evidence gap                                   | Prevents a broader baseline-comparison claim.                                                 |
| Verification rerun              | `npm run eval:verify` not rerun                                                     | Fresh verification evidence                                      | Open evidence gap                                   | Prevents a stronger verification claim.                                                       |

## What Changed Since The April 11 Snapshot

- The docs can no longer describe the current branch as green for `npm run test` or `npm run ci`.
- The quick Codex smoke result moved from historical `27/27` pass context to a fresh April 12 `26/27` failure.
- The external blocker story is clearer, not weaker: Windows is blocked by auth, WSL is blocked by runtime age, and macOS cannot be claimed from this workstation.
- The matrix-definition work is stronger after this refresh because it now separates fresh failures, stale evidence, and external blockers instead of flattening them into one parity bucket.

## What The Repo Can Honestly Claim Today

- The parity matrix itself is now explicit and reviewable.
- Cross-platform CI-safe smoke posture exists and is evidenced.
- The live-validation contract is clear about supported-host versus blocked-host handling.
- The latest executed evidence does not support a green full-parity verdict for the current branch state.

## What Is Not Proven To Be A Codex-Only Product Bug

The April 12 evidence does not prove every open gap is a Codex-specific semantic defect.

- `npm run test` and `npm run ci` are branch-state failures and may reflect broader worktree drift rather than Codex-only behavior.
- Windows live smoke is blocked externally by Claude auth before scenarios begin.
- WSL live smoke is blocked externally by an outdated Node runtime.

The strongest currently checked-in Codex-specific regression signal is narrower:

- `npm run eval:smoke:codex:quick` failed scenario `AK` on April 12 after a prior April 11 `27/27` pass.

## Follow-Up Ownership

The remaining gaps still map cleanly to existing beads:

| Gap                                                   | Existing bead            | Reason                                                                |
| ----------------------------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| Supported-host smoke and support-matrix evidence      | `prompt-language-72a5.6` | Still the external blocker for supported-host smoke closure evidence. |
| Full parity run for tests, CI, smoke, and experiments | `prompt-language-5pej.2` | Still owns the actual execution reruns and branch-state green proof.  |
| Delta classification against the broader baseline     | `prompt-language-5pej.3` | Still owns the synthesized verdict once fresh reruns exist.           |

No new bead is justified from the docs refresh alone.

## Current Verdict

The honest verdict at `2026-04-12` is **not yet at parity for the current branch state**.

More precisely:

- `prompt-language-5pej.1` now has a closure-ready matrix definition and evidence format.
- `prompt-language-5pej.2` remains open because the latest executed evidence contains deterministic failures, a quick-smoke regression, and still-missing supported-host live smoke.
- The only blocker that is still external to this docs task is `prompt-language-72a5.6`, which owns supported-host smoke/support-matrix evidence.
