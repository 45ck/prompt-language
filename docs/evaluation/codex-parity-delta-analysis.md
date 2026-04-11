# Codex Parity Delta Analysis

This note answers a narrower question than the full parity epic: given the evidence currently checked into this repo, what gaps remain between the Codex path and the established Claude-oriented baseline, and how should those gaps be classified?

As of April 11, 2026, the repo has enough checked-in evidence to say where Codex is already credible and where the remaining parity claim is still blocked by missing live-host proof.

## Evidence base actually checked into the repo

| Evidence surface                      | What the repo currently says                                                                                                             | Date anchor                                | Source                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Repo-side validation bar              | `npm run test`, `npm run ci`, and `npm run eval:e2e` are recorded as passed in the current workspace evidence                            | checked-in state as of April 11, 2026      | [Codex Parity Matrix](eval-parity-matrix.md)                                                                                          |
| Quick Codex smoke                     | `npm run eval:smoke:codex:quick` is recorded as passing `27/27` scenarios                                                                | checked-in state as of April 11, 2026      | [Codex Parity Matrix](eval-parity-matrix.md), [What Works Now](what-works-now.md), [Smoke Coverage Status](test-design-smoke-gaps.md) |
| Locked Codex eval artifact pair       | the seeded E1 `codex-vanilla` and `codex-gated` reports were regenerated through the Codex harness on this workstation                   | April 10, 2026                             | [Dataset Bank](dataset-bank.md), [E1 repeated failure README](../../experiments/results/e1-repeated-failure/v1/README.md)             |
| Live Claude smoke on this workstation | `npm run eval:smoke` is still blocked before scenario execution by missing Claude login/access                                           | checked-in state as of April 11, 2026      | [Codex Parity Matrix](eval-parity-matrix.md), [What Works Now](what-works-now.md), [Smoke Coverage Status](test-design-smoke-gaps.md) |
| Supported-host rule                   | native Windows is not the supported parity target for hooks or live smoke; Linux, macOS, or WSL-style hosts are the supported rerun path | current repo contract as of April 11, 2026 | [Codex Parity Matrix](eval-parity-matrix.md), [Live Validation Evidence](eval-live-validation-evidence.md)                            |

## Delta classification

| Surface                                    | Current Codex status from checked-in evidence                                                      | Baseline expectation                         | Classification                           | Why                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo-local tests, CI, and eval runner path | Passing in the current parity notes                                                                | Pass                                         | Parity                                   | The repo-side quality bar is green in the checked-in matrix, so there is no visible deterministic Codex delta on those surfaces.                              |
| Quick Codex smoke subset                   | `27/27` passed through `npm run eval:smoke:codex:quick`                                            | Pass on the quick subset                     | Parity                                   | The fast headless Codex regression slice no longer shows unresolved scenario failures in the current evidence set.                                            |
| Locked seeded eval artifacts               | Codex produced a checked-in E1 baseline pair, with gated beating vanilla `1/3` to `0/3`            | A real runner path with saved reports        | Partial parity evidence                  | This proves the Codex eval/tooling path is real and can produce durable artifacts, but it is still only the seeded E1 bank rather than the full parity suite. |
| Supported-host live smoke                  | No passing supported-host live Claude smoke is checked in                                          | Required for host-dependent parity claims    | Open evidence gap                        | The gap is still real because the repo contract requires live smoke for parity, and no supported-host pass is recorded yet.                                   |
| Missing Claude auth on this workstation    | `npm run eval:smoke` is blocked before scenarios run                                               | Explicit blocker if auth is unavailable      | Environment blocker, not product failure | The checked-in notes consistently classify this as a missing-auth condition, not as a prompt-language regression.                                             |
| Native Windows parity                      | Native Windows remains outside the supported live-smoke parity path                                | Honest support matrix, not a fake green bar  | Unsupported-host caveat                  | The repo already says native Windows should not be treated as live-smoke parity proof for hooks or the real agent loop.                                       |
| Comparative eval reruns                    | `npm run eval:compare:quick` and `npm run eval:compare:v4:quick` are not rerun in the current pass | Needed for broader comparative parity claims | Open evidence gap                        | Missing reruns prevent a broader parity claim, but they do not establish a product bug by themselves.                                                         |
| Verification reruns                        | `npm run eval:verify` is not rerun in the current pass                                             | Needed for stronger verification claims      | Open evidence gap                        | This is missing proof, not proof of semantic failure.                                                                                                         |

## What the repo can honestly claim today

- Codex is credible for repo-local validation and the quick headless smoke subset.
- Codex has a real checked-in eval/report path, with locked artifacts regenerated on April 10, 2026.
- Codex has not yet earned a full Claude-equivalent lifecycle claim, because no supported-host live-smoke pass is checked in and the broader compare and verify reruns are still open.

## What is not currently showing up as a product bug

The current evidence does **not** point to a concrete Codex-specific prompt-language regression in the surfaces above.

The visible risk is overclaiming parity from incomplete host-side evidence, not ignoring a known quick-smoke break.

## Caveats that must stay explicit

- As of April 11, 2026, the checked-in docs still record `npm run eval:smoke` as blocked on this workstation by missing Claude login/access.
- As of April 11, 2026, native Windows still remains outside the supported live-smoke parity path for hooks and real agent-loop validation.
- The April 10, 2026 locked Codex E1 reports prove the eval harness path, but they do not replace supported-host live smoke or broader compare and verify reruns.

## Follow-up ownership already in the backlog

The remaining gaps already map to existing beads:

| Gap                                                                     | Existing bead            | Reason                                                                            |
| ----------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| Supported-host smoke and host support matrix evidence                   | `prompt-language-72a5.6` | The repo still needs supported-host smoke proof and a maintained support story.   |
| Full parity run for tests, CI, smoke, and experiments                   | `prompt-language-5pej.2` | This is the execution step that converts the matrix into supported-host evidence. |
| Evaluation-stack live validation expectations and blocked-host handling | `prompt-language-5vsm.8` | The repo needs reusable live-validation rules, not just one-off parity notes.     |

No additional follow-up bead is justified from the current workspace evidence alone.

## Current verdict

The honest current verdict is **partial parity**.

Codex is at parity for the repo-local validation bar that this workspace can execute today, and it has a strong quick-smoke signal. It is **not yet at supported-host parity** because the remaining host-side smoke and broader comparative and verification evidence are still open.

That means the repo can reasonably say:

- Codex is credible for headless repo-local validation and quick smoke regression detection
- Codex has not yet earned a claim of full Claude-equivalent lifecycle parity
- the remaining open work is mostly evidence completion and supported-host validation, not a known prompt-language semantic break
