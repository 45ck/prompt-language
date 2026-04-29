# Experiment Plan

## Summary

The Senior Pairing Protocol tests prompt-language as a supervision system for
local LLM coding agents. The core hypothesis is that explicit senior-engineer
metacognition improves task outcomes more reliably than a plain persona prompt.

## Hypotheses

| ID     | Hypothesis                                                                      | Expected Signal                                         |
| ------ | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| SPP-H1 | PL senior pairing improves deterministic task score versus solo local prompting | Higher oracle score or pass rate                        |
| SPP-H2 | PL senior pairing improves risk handling versus solo local prompting            | More correct risk flags and fewer unsafe edits          |
| SPP-H3 | PL senior pairing improves repair behavior after failed tests                   | More failures converted to passes after grounded repair |
| SPP-H4 | Hybrid judging catches failures local self-review misses                        | Stronger model rejects or repairs unsafe local outputs  |
| SPP-H5 | Runtime increases but should not dominate quality interpretation                | Runtime recorded, not primary ranking                   |
| SPP-H6 | PL senior pairing beats persona-only prompting on artifact quality              | Higher oracle or rubric score than persona-only control |

## Acceptance Criteria

- The experiment includes at least four arms: solo local, persona-only control,
  PL local, and PL hybrid judge.
- Every scored task has deterministic verification through `npm test` and
  `node verify.js`.
- Scoring separates deterministic correctness from senior-behavior quality.
- Runtime is captured in manifests but weighted lightly or not at all.
- Each task includes an ambiguity, a risk dimension, and an oracle that can catch
  shallow success.
- Every run stores raw logs, final diff, manifest, and scorecard.
- The protocol documents when the model must escalate rather than proceed.

## Non-Goals

- Proving local models can replace frontier models.
- Optimizing for fastest completion.
- Using a senior persona as a substitute for grounded verification.
- Adding new prompt-language syntax.
- Creating a broad benchmark suite before the first task shape is validated.

## Experimental Arms

### `solo-local`

The local model receives the task brief and may solve it directly. It gets the
same task files and the same verification commands as the other arms.

### `persona-only-control`

The local model receives a strong senior-engineer persona prompt but no
structured PL checkpoints. This controls for prompt theater and tests whether
the PL program adds value beyond better instruction wording.

### `pl-senior-pairing-local`

The local model runs under `flows/senior-pairing-v1.flow`. The flow forces
structured clarification, risk assessment, plan capture, implementation,
grounded review, and repair.

### `pl-hybrid-judge`

The local model performs the work under the same senior-pairing structure, then a
named model judge reviews the output against the senior-engineering rubric. The
hybrid route should be used only for high-risk decisions or final review, not for
bulk implementation.

## Primary Metrics

| Metric               | Weight | Notes                                                             |
| -------------------- | -----: | ----------------------------------------------------------------- |
| Oracle correctness   |     40 | Deterministic `verify.js` result and assertion score              |
| Risk handling        |     20 | Correctly identifies security, data, architecture, and test risks |
| Test quality         |     15 | Tests fail before the fix and cover the intended edge cases       |
| Minimality and scope |     15 | Avoids broad rewrites and unrelated changes                       |
| Repair discipline    |     10 | Uses actual failing output and converges without thrashing        |

Runtime is recorded as telemetry and is not part of the initial weighted score.

## Threats To Validity

- A flow can produce better-looking reasoning without better code.
- The local model may time out before emitting useful artifacts.
- The hybrid judge may rubber-stamp persuasive but wrong output.
- Tasks may overfit to the protocol if they are too similar.
- Deterministic oracles may miss maintainability or risk defects.

## Mitigations

- Score final artifacts before transcript quality.
- Require deterministic gates before model-judge approval.
- Keep task-specific oracle output hidden until repair loops need it.
- Record no-edit, timeout, and capture-failure states separately from solution
  failures.
- Rotate task shapes: ambiguity, security, migration, TDD, and performance.
