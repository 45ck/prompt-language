# Codex Parity Delta Analysis

This note answers a narrower question than the full parity epic: given the evidence currently checked into this repo, what gaps remain between the Codex path and the established Claude-oriented baseline, and how should those gaps be classified?

## Current evidence base

The strongest current Codex evidence in this workspace is:

- `npm run test`: passed
- `npm run ci`: passed
- `npm run eval:e2e`: passed
- `npm run eval:smoke:codex:quick`: passed `27/27`

The strongest current Claude-oriented baseline is:

- historical comparative and smoke evidence already referenced across the eval docs
- the repo's existing requirement that host-dependent changes still prove themselves through `npm run eval:smoke`
- the current product claim that quick Codex smoke is useful, but not a substitute for supported-host live smoke

## Delta classification

| Surface                    | Current Codex status                                    | Baseline expectation                    | Classification                 | Why                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------- | --------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo-local tests and CI    | Passing in this workspace                               | Pass                                    | Parity                         | The shipped runner, parser, runtime, and repo automation survive the same local checks expected of the core product surface.                          |
| Quick smoke subset         | `27/27` passed through `npm run eval:smoke:codex:quick` | Pass on the quick subset                | Parity                         | There are no unresolved deterministic quick-suite deltas in the current workspace evidence.                                                           |
| Supported-host live smoke  | Not completed here                                      | Required for host-dependent parity      | Expected host/runtime variance | The blocking condition is missing Claude login/access in this environment, not a known prompt-language regression. This is still a real evidence gap. |
| Native Windows hook parity | Still limited                                           | Honest support matrix, not fake parity  | Expected host/runtime variance | The repo already treats native Windows as outside the supported live-smoke parity path while hook behavior remains constrained there.                 |
| Comparative eval runs      | Not rerun in this pass                                  | Needed for broader parity claims        | Evidence gap, not yet a bug    | The missing data means the repo cannot claim experiment-level parity yet, but the absence of reruns is not itself proof of a product defect.          |
| Verification eval runs     | Not rerun in this pass                                  | Needed for stronger verification claims | Evidence gap, not yet a bug    | This is unfinished validation, not a demonstrated semantic failure.                                                                                   |

## What is not currently showing up as a product bug

The current repo evidence does not point to a concrete Codex-specific prompt-language regression in the tested surfaces above.

In particular:

- the quick Codex smoke slice no longer shows unresolved scenario failures
- repo-local test and CI evidence is green
- the remaining visible gap is host-side and experimental-evidence completeness, not an identified deterministic runtime break

That means the main risk today is overclaiming parity, not missing a known quick-smoke bug.

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

Codex is at parity for the repo-local validation bar that this workspace can execute today, and it has a strong quick-smoke signal. It is **not yet at supported-host parity** because the remaining host-side smoke and broader comparative/verification evidence are still open.

That means the repo can reasonably say:

- Codex is credible for headless repo-local validation and quick smoke regression detection
- Codex has not yet earned a claim of full Claude-equivalent lifecycle parity
- the remaining open work is mostly evidence completion and supported-host validation, not a known prompt-language semantic break
