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

## Concrete evaluation plan required for this bead

This bead should close only on a completed comparison, not on design intent.

The evaluation plan for `0ovo.4.3` is:

1. compare the current full-detail baseline against one summary-oriented candidate behavior
2. run the comparison on large-output fixtures where the decisive clue is easy to lose
3. repeat the comparison on recovery-sensitive turns, not only clean single-pass tasks
4. publish inspectable evidence showing what the agent saw, what it did, and whether it stayed safe

The goal is not just to show that summary output is shorter. The goal is to prove that summary handling does not silently reduce:

- root-cause identification quality
- correction quality
- recovery and resume safety
- caution around unsafe broad fixes

## Candidate and baseline definition

This note should not treat "compact mode" as a vague idea. The comparison must name exact run families:

| Run family                 | Required role in the comparison                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `full_baseline`            | Current best non-summary rendering path with ordinary raw-detail visibility                                                 |
| `summary_candidate`        | Candidate path that summarizes or externalizes large output while preserving a reference back to raw evidence               |
| `summary_resume_candidate` | Same candidate exercised through interruption, resume, compaction, or recovery-sensitive turns when the fixture requires it |

If the candidate behavior is not stable enough to define these run families precisely, the bead is not closure-ready.

## Benchmark design

The minimum benchmark slice for this bead is smaller than the full context-adaptive program, but it must still be comparison-based and recovery-aware.

### Required fixture categories

At minimum, the comparison pack for this bead must include all of the following:

| Category                              | Minimum fixture count | Why it is required                                                              |
| ------------------------------------- | --------------------: | ------------------------------------------------------------------------------- |
| large-output diagnosis                |                     2 | proves whether late failure clues survive summary handling                      |
| artifact-reference navigation         |                     2 | proves whether moving raw output out of the main render remains usable          |
| safety-sensitive correction           |                     2 | proves the agent does not take broad unsafe shortcuts when detail is summarized |
| resume or recovery with large outputs |                     2 | proves summary handling does not weaken interrupted or compacted recovery paths |

That yields a minimum of **8 fixtures** for `0ovo.4.3`.

### Required fixture shape

Each fixture must define all of the following before runs start:

- stable fixture id
- starting repo state or deterministic task setup
- decisive evidence location
- expected correct diagnosis
- expected safe correction
- required validation commands
- whether interruption or resume is mandatory
- whether raw output must be consulted through an artifact or reference handle

### Required large-output properties

The large-output fixtures must not be trivial "big text" examples. Each one should include at least one of these pressure patterns:

- the decisive clue appears late in stderr or test output
- the decisive clue is surrounded by many irrelevant failures or repeated stack frames
- the wrong fix looks plausible if the agent sees only the early portion of the output
- successful completion requires consulting the raw evidence after reading the summary

## Regression checks

The comparison must record explicit regression checks instead of relying on a single pass or fail label.

### Correction-quality checks

For every fixture, record:

- whether the agent identified the true root cause
- whether the first attempted fix was directionally correct
- whether the final fix passed required validation
- whether the agent introduced a broad or unsafe shortcut such as weakening tests, broadening allowlists, or removing controls

### Diagnosis-quality checks

For every fixture, record:

- whether the decisive clue was cited or clearly used
- whether the agent had to consult the raw output artifact or reference
- whether the candidate path missed a clue the full baseline used successfully
- number of corrective attempts before success

### Recovery-safety checks

For every recovery-sensitive fixture, record:

- whether the resumed run preserved the correct current-step understanding
- whether summary handling preserved blocked state, pending gates, and child or await status where relevant
- whether the agent reopened or re-broke already-solved work after resume
- whether fallback to full-detail handling occurred when recovery risk was present

### Material regression rules

This note should treat any of the following as a material regression that must be written up explicitly:

- `summary_candidate` fails a fixture that `full_baseline` completes correctly
- `summary_candidate` chooses a wrong broad fix that `full_baseline` avoids
- `summary_candidate` misses the decisive clue until after an unnecessary unsafe attempt
- `summary_resume_candidate` loses recovery context, blocked state, or child topology that remains visible in the baseline
- the candidate path depends on hidden manual operator intervention that the baseline does not require

Ties are not automatically acceptable. A suspicious tie must still be explained if the candidate required weaker visibility standards, extra human steering, or untracked artifact lookup behavior.

## Evidence requirements for every completed run

This bead should not close on prose-only claims. Each run needs inspectable evidence.

Minimum required artifacts per run:

- run manifest with fixture id, run family, date, model, and repo commit
- rendered-context sample or equivalent capture showing what the agent actually saw
- raw-output evidence location, including artifact or reference handle when used
- validation transcript or normalized command results
- concise evaluator judgment covering diagnosis quality, correction outcome, and safety outcome

Minimum required comparison outputs per fixture:

- side-by-side baseline versus candidate result row
- note explaining any loss, suspicious tie, fallback, or unsafe attempt
- explicit statement of whether the decisive clue survived summary handling

Minimum required report outputs for the bead:

- a checked-in completed results note under the planned context-adaptive evaluation area
- locked result artifacts under `experiments/results/` or another accepted canonical evidence path
- a regression section naming every meaningful loss or unresolved ambiguity

## Closure evidence standard

`prompt-language-0ovo.4.3` is closure-ready only if all of the following are true:

1. the repo has a stable summary-oriented candidate behavior to evaluate, rather than only planning notes
2. the comparison includes `full_baseline` and `summary_candidate` runs across the required fixture categories above
3. recovery-sensitive fixtures also include `summary_resume_candidate` coverage where applicable
4. the results are backed by inspectable run artifacts, not summary prose alone
5. the final report states wins, ties, losses, regressions, and unresolved gaps explicitly

## Explicit non-closure conditions

This bead must remain open if any of the following are still true:

- `0ovo.4.1` or `0ovo.4.2` is still missing the stable summarization or artifactization behavior being evaluated
- the repo still lacks a completed results report for summary-safety comparison
- the comparison omits large-output fixtures where the decisive clue appears late or outside the main summary
- the comparison omits recovery-sensitive or resumed runs
- artifact or reference lookups are required in practice but were not captured as evidence
- the candidate loses any fixture to the baseline and the loss is not explained and bounded
- the candidate succeeds only by allowing weaker diagnosis quality or hidden human intervention
- raw artifacts, manifests, or validation evidence are missing or not reproducible enough for review

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
2. targeted large-output fixtures that compare `full_baseline` against `summary_candidate` and, where relevant, `summary_resume_candidate`
3. a checked-in results note, likely under `docs/evaluation/context-adaptive-rendering-results.md` or a sibling report, that explicitly reports:
   - fix/correction outcomes
   - diagnosis outcomes
   - recovery/resume/debug outcomes
   - any regressions or unresolved gaps
4. locked result artifacts under `experiments/results/` or equivalent canonical evidence storage
5. explicit write-up of any baseline wins, candidate losses, suspicious ties, or unsafe shortcut behavior

## Recommendation

Do not close `prompt-language-0ovo.4.3` on current evidence.

Use this note as the pre-implementation evaluation baseline:

- it captures the existing large-output caveat
- it records that current evidence stops at truncation mechanics and docs warnings
- it makes the missing benchmark/report gap explicit so later work can close the bead cleanly without overstating completion
