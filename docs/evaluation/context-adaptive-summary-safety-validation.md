<!-- cspell:ignore artifactized -->

# Context-Adaptive Summary Safety Validation

## Status

Bounded evaluation note for bead `prompt-language-0ovo.4.3`.

Current conclusion: **not closure-ready**.

This note is intentionally narrower than a completed benchmark report. It documents what the repo already proves about large-output handling and why that evidence is still insufficient to close the summary-safety bead.

## Scope

The bead asks whether summary-based output handling harms:

- correction quality
- diagnosis quality
- recovery safety

This note checks whether the repo already contains enough evidence to answer that question honestly.

## Evidence basis checked for this note

Primary checked-in inputs:

- [`docs/research/context-adaptive-rendering.md`](../research/context-adaptive-rendering.md)
- [`docs/evaluation/context-adaptive-rendering-results-template.md`](context-adaptive-rendering-results-template.md)
- [`src/application/advance-flow.ts`](../../src/application/advance-flow.ts)
- [`src/application/advance-flow.test.ts`](../../src/application/advance-flow.test.ts)
- [`src/application/evaluate-completion.test.ts`](../../src/application/evaluate-completion.test.ts)
- [`docs/operations/troubleshooting.md`](../operations/troubleshooting.md)
- [`docs/reference/runtime-variables.md`](../reference/runtime-variables.md)

Repo-level absence checks performed for this note:

- no checked-in `docs/evaluation/context-adaptive-rendering-results.md`
- no checked-in `experiments/results/` report set for context-adaptive render-mode or large-output summary comparisons
- no checked-in artifactized-output evaluation suite specific to `0ovo.4`

## What the repo already proves

## 1. Large command outputs are already truncated in shipped runtime paths

The current runtime is not neutral with respect to large output. It already applies bounded truncation in baseline behavior:

- `advance-flow.ts` truncates `last_stdout` and `last_stderr` to `MAX_OUTPUT_LENGTH`
- `let x = run "..."` also truncates oversized captured values and emits a warning
- gate diagnostics truncate long stderr/stdout when persisted for completion-gate evidence

This matters because future summary safety work is not starting from a pristine full-fidelity baseline. The shipped product already accepts a bounded information-loss tradeoff for large outputs.

## 2. The repo has unit evidence for truncation mechanics, not task-quality impact

The checked-in tests show that truncation behavior exists and is intentional:

- `advance-flow.test.ts` covers truncation of long stdout and stderr after `run:`
- `advance-flow.test.ts` covers truncation of oversized `let = run` values plus warning emission
- `evaluate-completion.test.ts` covers gate-diagnostic truncation with explicit `[truncated]` markers

That is useful implementation evidence, but it is not yet evaluation evidence for the bead's acceptance criteria. The tests validate mechanics, not whether task outcomes degrade.

## 3. The docs already acknowledge a real safety concern in the current baseline

`docs/operations/troubleshooting.md` states that `last_stdout` and `last_stderr` are truncated at 2,000 characters and explicitly warns that Claude may miss failure details beyond the truncation point.

That is the strongest currently checked-in safety signal for this bead:

- large-output handling can already hide actionable detail
- the current mitigation is manual output narrowing by the flow author
- this is a baseline caveat, not a completed summary-safety validation

## 4. The context-adaptive program knows large-output safety must be measured

The research plan and results template are aligned on the right target:

- the research plan names **large-output scenarios** and **resume/compaction recovery scenarios** as required fixture categories
- the results template has explicit rows for `large-output` and `resume/compaction`
- the research plan says results should be published with wins, ties, losses, and regressions all reported

This is good planning discipline, but it is still planning. The repo does not yet contain the filled results artifact.

## What the repo does not yet prove

## 1. No checked-in benchmark comparison for full vs summary-based output handling

The bead acceptance criteria require benchmark comparison completion. That evidence is not present.

Missing today:

- a completed results note comparing full vs compact or summary-oriented output handling
- locked result artifacts under `experiments/results/` for large-output summary scenarios
- a checked-in comparison showing whether fix quality or diagnosis quality changed

## 2. No shipped output-summarization policy for `0ovo.4`

The upstream feature prerequisites remain open:

- `prompt-language-0ovo.4.1` asks for the deterministic summarization policy
- `prompt-language-0ovo.4.2` asks for storage/reference of large outputs as artifacts

Without those, there is no stable target behavior to validate end to end. The repo still has truncation and compact render behavior, but not the specific artifactized summary-handling path the epic describes.

## 3. No checked-in evidence for correction-quality or diagnosis-quality deltas

The current evidence does not answer questions such as:

- does summarizing large failure output cause the model to miss the true root cause more often?
- does diagnosis get slower or less accurate when only summary blocks are shown?
- do recovery and resume workflows remain safe when raw output moves out of the main render path?

Those are exactly the questions the bead asks, and the repo does not yet contain task-level evidence for them.

## 4. No checked-in regressions attributable to summary mode, because summary mode is not yet evaluated as a completed product path

This note must not invent regressions just to satisfy the template.

What can be said honestly:

- the current baseline already carries a known truncation caveat
- there is not yet a checked-in summary-mode benchmark from which to attribute new regressions

## Large-output scenarios currently covered by evidence

The repo has only **baseline-mechanics coverage**, not **task-outcome coverage**, for large outputs.

Covered today:

- long stdout truncation after `run:`
- long stderr truncation after `run:`
- oversized `let = run` capture truncation with warning emission
- gate-diagnostic truncation with visible marker
- documentation warning that truncated output can hide failure details

Not covered today:

- summary-block versus full-output correction quality
- diagnosis quality on real large-failure tasks
- recovery safety when summary output is used during resume/compaction/debug workflows
- artifact reference usability when raw output is moved out of the main render

## Safety concerns already visible before summary mode lands

Even without a completed summary-mode experiment, the current repo shows three concrete safety concerns that any future implementation must address.

### 1. Information loss is already present in the baseline

Large output can already be cut off before the relevant failure detail. A future summary path must show it improves prompt pressure without making this problem worse.

### 2. Manual narrowing is doing safety work today

The documented workaround is to pipe or tail output manually. That means safety currently depends partly on the flow author shaping output at the source rather than on the runtime preserving safe raw-access semantics.

### 3. Recovery and debugging still rely on raw state and raw outputs

The context-adaptive program explicitly treats recovery safety as a gating criterion, but the repo does not yet contain comparison evidence showing that a summary-oriented path preserves debugging quality when large outputs matter.

## Evaluation judgment

The strongest bounded judgment the repo currently supports is:

1. large-output handling is already a real correctness and UX concern in the shipped baseline
2. the repo has implementation and documentation evidence for truncation behavior
3. the repo does **not** yet have the benchmark comparison or filled evaluation report required to close `prompt-language-0ovo.4.3`

## Why the bead should remain open

The bead remains open because its acceptance criteria are still unmet:

- **benchmark comparison completed**: not present
- **large-output scenarios are covered**: covered only at truncation-mechanics level, not at task-quality comparison level
- **material regressions are documented explicitly**: no completed comparison exists from which to document regressions honestly

## Minimum evidence needed for closure

This bead becomes closure-ready only after the repo has all of the following:

1. a stable candidate behavior from `0ovo.4.1` and `0ovo.4.2`
2. targeted large-output fixtures that compare full rendering against summary/artifactized handling
3. a checked-in results note, likely under `docs/evaluation/context-adaptive-rendering-results.md` or a sibling report, that explicitly reports:
   - fix/correction outcomes
   - diagnosis outcomes
   - recovery/resume/debug outcomes
   - any regressions or unresolved gaps
4. locked result artifacts under `experiments/results/` or equivalent canonical evidence storage

## Recommendation

Do not close `prompt-language-0ovo.4.3` on current evidence.

Use this note as the pre-implementation evaluation baseline:

- it captures the existing large-output caveat
- it records that current evidence stops at truncation mechanics and docs warnings
- it makes the missing benchmark/report gap explicit so later work can close the bead cleanly without overstating completion
