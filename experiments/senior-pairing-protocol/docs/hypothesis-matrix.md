# Senior Pairing Hypothesis Matrix

This matrix expands the current pilot into measurable hypotheses. It separates
what we have already observed from what the next experiments should test.

## Summary

The strongest working theory is not that a local model becomes "senior" because
of a persona. The theory is that prompt language can act as a senior-engineering
control system around a local model by forcing explicit decisions, evidence, and
bounded repair.

The next measurements should compare final artifacts first, then inspect
captured senior-behavior artifacts only as explanatory evidence.

## Confirmed Findings

| Finding                                                                    | Current support                                              | Limit                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| The primary Aider harness can execute SP01 and capture pass/fail evidence. | `live-sp01-r1-20260430` completed for three primary arms.    | One task, one repeat, one model.           |
| Compact PL can solve SP01 with the local model.                            | `pl-senior-pairing-local` passed tests and verifier.         | Solo also passed, so no superiority claim. |
| Persona-only did not produce a useful patch in the pilot.                  | The persona arm failed verifier and left no meaningful edit. | Failure cause is not fully auditable.      |
| PL produced a broader visible test surface than solo.                      | PL added an extra edge-case test.                            | Not yet blinded or rubric-scored.          |

## Benefit Hypotheses

| ID      | Hypothesis                                                                                                                                  | Expected outcome                                                                          | Leading measures                                                         | Lagging measures                                        | Main assumptions                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| SPP-H7  | If PL forces a ranked decision policy before editing, local models will make fewer broad or unsafe changes on ambiguous tasks.              | Higher minimality and risk scores than persona-only.                                      | Non-placeholder `decision_policy`; fewer unrelated diff hunks.           | Rubric minimality and risk-classification score.        | The model follows the policy rather than treating it as transcript decoration. |
| SPP-H8  | If PL separates red-test design from implementation, local models will write tests that better expose the missing behavior.                 | Higher test-quality score and fewer false-positive tests.                                 | Tests fail before implementation for the right reason.                   | Blinded test-quality score and oracle pass rate.        | Harness can preserve pre-implementation test evidence.                         |
| SPP-H9  | If PL requires explicit invariants and stop conditions, security and compatibility tasks will show fewer regressions.                       | Lower security/data regression rate on SP02 and SP03.                                     | Captured `risk_register` includes relevant invariant and stop condition. | Failure override rate and verifier assertions.          | Fixtures test the high-risk regressions directly.                              |
| SPP-H10 | If PL requires a final senior self-review grounded in command output, repair loops will be more disciplined.                                | Fewer speculative repair edits after failing output.                                      | Repair prompts cite command output and changed files only.               | Repair-discipline score and total repair iterations.    | Captured state is complete enough for audit.                                   |
| SPP-H11 | If a richer senior program adds observable decision scaffolding, it will improve quality more than compact PL on tasks with real ambiguity. | `senior-pairing-v2` beats `senior-pairing-v1` on rubric score for SP02/SP03.              | More complete senior artifacts without large runtime failure rate.       | Median total rubric score by task.                      | Extra structure does not overload the local model.                             |
| SPP-H12 | If hybrid review is reserved for explicit high-risk decisions, frontier calls can improve safety without replacing local bulk work.         | Hybrid beats local-only on risk-heavy tasks with fewer frontier calls than frontier-only. | Logged escalation reason and changed outcome after review.               | Oracle pass, safety override rate, frontier-call count. | Headless child-runner routing and oracle isolation are fixed first.            |

## Measurement Design

Primary next matrix:

| Dimension          | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Tasks              | `sp01`, `sp02`, `sp03` after fixtures exist                        |
| Arms               | `solo-local`, `persona-only-control`, `pl-senior-pairing-local`    |
| Repeats            | `3` per task per arm                                               |
| Runner             | Aider only until protected-file policy is runner-agnostic          |
| Primary endpoint   | Hidden verifier pass/fail                                          |
| Secondary endpoint | Blinded senior-engineering rubric                                  |
| Tertiary endpoint  | Runtime, no-edit timeout rate, repair count, artifact completeness |

Exploratory matrix after the primary matrix is clean:

| Question                                                                                | Arms                                                      |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Does richer senior scaffolding help or overload the model?                              | `pl-senior-pairing-local` vs `pl-senior-pairing-v2-local` |
| Do spawned reviewers add value after child cancellation and artifact capture are fixed? | compact PL vs full local probe                            |
| Does frontier escalation add value only where risk warrants it?                         | compact PL vs hybrid route                                |

## Evidence Gaps

- Real `senior_frame`, `risk_register`, `decision_policy`, `test_strategy`, and
  `final_self_review` artifacts must be extracted from flow state.
- SP02 and SP03 need runnable fixtures and hidden verifiers.
- Model digest capture must be reliable or explicitly marked unavailable.
- Scorecard exports must be blinded before human scoring.
- Oracle isolation must be runtime policy, not only prompt wording.

## Next Decision

The next implementation work should prioritize measurement infrastructure over
running more live trials. The clean order is:

1. Add `senior-pairing-v2.flow` as an exploratory richer senior-program arm.
2. Add fixtures for SP02 and SP03.
3. Fix real flow-state artifact export.
4. Run the primary 27-run matrix.
5. Only then compare compact PL against v2/full/hybrid arms.
