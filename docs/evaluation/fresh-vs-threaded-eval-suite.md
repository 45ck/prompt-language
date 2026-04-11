# Fresh vs Threaded Eval Suite

## Status

Design note for a future checked-in evaluation suite. This is a runner and evidence contract, not shipped product syntax.

## Why this suite exists

The current evaluation bank proves gated-vs-vanilla behavior on repeated-failure prompts through the seeded E1 suite. The next missing comparison is whether the same bounded task set performs better when each case starts from a clean run versus when related cases execute inside one continuing thread with accumulated context.

This suite is intended to sit beside the existing dataset bank and future smoke/eval work:

- it should become a checked-in dataset under `experiments/eval/datasets/`
- it should produce locked reports under `experiments/results/`
- it should stay separate from smoke, but reuse smoke-style artifact capture and blocker classification

## Exact comparison question

Primary question:

> For the same fixture-backed task set, does a fresh-run execution strategy outperform a threaded execution strategy on correctness, containment, and recovery once prior-case context is allowed to accumulate?

Comparison setup:

- `fresh`: each dataset case runs in an isolated workspace with no prior conversation state and no cross-case memory beyond the checked-in fixture itself
- `threaded`: cases from the same scenario family run in sequence inside one continuing conversation or harness thread, preserving prior-case context, generated outputs, and any assistant assumptions that naturally carry forward

The suite should answer four concrete questions:

1. Does threading improve completion rate for tasks that benefit from immediate prior context?
2. Does threading degrade scope control by carrying wrong assumptions into later cases?
3. Does threading improve recovery speed after a near-miss or soft failure?
4. Does threading increase stale-context regressions compared with the fresh baseline?

## Relationship to the current evaluation bank

This suite extends the existing bank without replacing it.

- E1 remains the repeated-failure starter and the current baseline proof.
- This suite should become the first checked-in bank that treats run-to-run context as the independent variable.
- The suite should stay compatible with the current `prompt-language eval` runner model: JSONL datasets, fixture directories, repeated runs, machine-readable reports, and locked comparisons.
- The suite should eventually feed future smoke work by identifying which stale-context failure classes deserve targeted live smoke scenarios.

Recommended dataset path:

```text
experiments/eval/datasets/e6-fresh-vs-threaded.jsonl
```

Recommended report path:

```text
experiments/results/e6-fresh-vs-threaded/v1/
  codex-fresh.json
  codex-threaded.json
  compare.json
```

## Candidate semantics

The suite should compare two candidates over the same dataset rows:

- `fresh`: execute each row as a standalone eval case
- `threaded`: execute rows grouped by `thread_group`, in declared `thread_order`, reusing the same conversation/session between rows in that group

Required dataset metadata beyond the current bank:

- `thread_group`: stable group identifier for rows that must share one threaded run
- `thread_order`: positive integer ordering within the group
- `scenario_family`: stable category label used for reporting and failure aggregation
- `context_dependency`: `none`, `helpful`, or `hazardous`

The runner should treat missing `thread_group` or `thread_order` as invalid for this suite.

## Scenario categories

The suite should be balanced across categories so it can detect both helpful and harmful carry-over.

### 1. Immediate follow-up clarification

Purpose: test whether a prior step genuinely helps the next step.

Expected signal:

- threaded may outperform fresh on speed or completion
- threaded should not change the requested scope

Example shape:

- case 1 produces or inspects a narrow artifact
- case 2 updates that same artifact with a clearly bounded follow-up request

### 2. Scope reset after a nearby task

Purpose: detect stale assumptions when a new task looks similar but requires a fresh boundary.

Expected signal:

- fresh should outperform threaded on scope discipline
- threaded should show higher risk of editing the wrong file or reusing the wrong plan

Example shape:

- case 1 modifies `app.js`
- case 2 asks for an unrelated change in a different file within the same fixture family

### 3. Recovery after failed or partial prior work

Purpose: test whether threading helps the model recover from a recent failure, or whether failure residue poisons the next attempt.

Expected signal:

- threaded may outperform fresh if the prior failure teaches a useful local constraint
- threaded may underperform if it anchors on a wrong diagnosis

Example shape:

- case 1 intentionally ends with a failing verification step
- case 2 requests a nearby but not identical correction in the same fixture

### 4. Contradictory instruction carry-over

Purpose: test whether the runner can contain prior guidance once a later case explicitly supersedes it.

Expected signal:

- fresh should be robust
- threaded should only pass if the later instruction cleanly overrides the earlier one

Example shape:

- case 1 says "preserve current API"
- case 2 says "rename the API surface to match the new contract"

### 5. Memory-worthy recurring pattern

Purpose: identify when threading should help because the same failure pattern repeats with stable local rules.

Expected signal:

- threaded may outperform fresh on later cases
- benefit should appear as fewer retries or faster verification success, not only verbose reasoning

Example shape:

- several cases in one family repeat the same edge-case bug with different concrete inputs

## Datasets and fixtures

The suite should start small and fixture-backed, like the seeded E1 bank.

### Phase 1 seed set

Use existing durable fixture style under `scripts/eval/fixtures/` and introduce one new fixture family dedicated to context carry-over. The initial suite should contain 12 rows:

- 3 rows for immediate follow-up clarification
- 3 rows for scope reset after a nearby task
- 2 rows for recovery after failed or partial prior work
- 2 rows for contradictory instruction carry-over
- 2 rows for memory-worthy recurring pattern

Recommended fixture layout:

```text
scripts/eval/fixtures/threaded-context/
  follow-up-edit/
  scope-reset/
  recovery-chain/
  contradiction-reset/
  recurring-pattern/
```

Each fixture directory should keep the same contract used by the current bank:

- checked-in task input file
- deterministic verify command
- bounded local files only

### Dataset row contract

Each JSONL row should keep the existing required keys:

- `id`
- `fixture`
- `input_type`
- `input_file`
- `verify`

This suite should additionally require:

- `candidate_mode`: always `fresh_vs_threaded` for this bank
- `thread_group`
- `thread_order`
- `scenario_family`
- `context_dependency`
- `expected_signal`

Optional but recommended:

- `notes`
- `stability`
- `risk_tags`

### Verify and gate rules

Prefer fixture-local deterministic verification, as in the seeded E1 bank.

- `verify` remains the authority for case pass/fail
- `gates`, if present, should mirror the fixture verify command or other deterministic completion checks
- no judge-only or model-scored pass conditions belong in this suite's core pass metric

## Success metrics

The suite should report both headline outcomes and context-specific failure signals.

### Primary metrics

- case pass rate by candidate
- pass rate by `scenario_family`
- threaded minus fresh delta for each family
- median attempts to first passing verify
- median wall-clock time to first passing verify

### Secondary metrics

- wrong-scope edit rate
- stale-context failure rate
- recovery success rate after prior failed case
- verify-cleanliness rate

`verify-cleanliness` means the case passes without leaving unrelated regressions or extra changed files outside the fixture's allowed surface.

### Promotion threshold

The suite should only be called informative when:

- each scenario family has at least 2 stable cases
- both candidates run the exact same dataset rows
- blocker-classified rows are reported separately from scored rows

## Failure classifications

Every non-pass outcome must be classified into one primary failure class so later smoke/eval work can target the right gap.

### Product regressions

- `scope_drift`: changed the wrong file, over-edited, or carried forward an obsolete plan
- `stale_context_anchor`: explicitly reused prior-thread assumptions that no longer matched the current case
- `verification_failure`: attempted the right surface but did not satisfy the deterministic verify command
- `recovery_failure`: remained stuck after a prior failure instead of correcting course
- `state_leakage`: cross-case artifacts or memory contaminated the later case in a way the candidate mode should have prevented

### Runner or evidence failures

- `artifact_missing`: expected transcript, diff, verify output, or metadata was not captured
- `dataset_contract_error`: invalid dataset row, missing fixture input, or malformed metadata
- `candidate_wiring_error`: fresh or threaded mode was not actually executed as declared

### Environment blockers

- `host_auth_blocked`: harness login, token, or permission failure prevented execution
- `host_tool_missing`: required executable, package, or shell capability was unavailable
- `host_timeout_external`: the host stalled for reasons not attributable to prompt-language logic
- `workspace_io_blocked`: filesystem or temp-workspace issue prevented normal execution

Environment blockers must never be counted as product failures.

## Evidence capture format

The report needs enough structure to support later comparisons, replay design, and smoke-target selection.

Required case-level record:

```json
{
  "id": "e6.scope-reset.2",
  "candidate": "threaded",
  "thread_group": "scope-reset-a",
  "thread_order": 2,
  "scenario_family": "scope_reset",
  "status": "failed",
  "failure_class": "stale_context_anchor",
  "environment_blocker": false,
  "verify_passed": false,
  "duration_ms": 41200,
  "attempt_count": 2,
  "files_changed": ["src/a.ts", "README.md"],
  "allowed_files_changed": false,
  "evidence": {
    "input_file": "task.txt",
    "verify_command": "node test.js",
    "verify_exit_code": 1,
    "stdout_path": "artifacts/e6/threaded/e6.scope-reset.2/stdout.txt",
    "stderr_path": "artifacts/e6/threaded/e6.scope-reset.2/stderr.txt",
    "diff_path": "artifacts/e6/threaded/e6.scope-reset.2/diff.patch",
    "transcript_path": "artifacts/e6/threaded/e6.scope-reset.2/transcript.md",
    "summary_path": "artifacts/e6/threaded/e6.scope-reset.2/summary.json"
  }
}
```

Required suite-level aggregates:

- total rows
- scored rows
- blocked rows
- pass rate by candidate
- pass rate by `scenario_family`
- failure class counts by candidate
- blocker counts by candidate
- per-group fresh vs threaded comparison

## Distinguishing environment blockers from product regressions

The suite must use a fail-closed classification rule so host issues do not get misreported as product quality signals.

### Classify as environment blocker when

- the harness never started the task
- auth or login failed before model execution
- the fixture could not be prepared due to host IO or missing tools
- the run timed out without usable prompt-language artifacts and the timeout is attributable to host instability rather than case behavior

### Classify as product regression when

- the task executed and produced enough evidence to inspect behavior
- prompt-language or the candidate workflow performed the wrong action, carried the wrong context, or failed deterministic verification
- threading changed the behavior in a way visible from transcript, diff, verify output, or state artifacts

### Tie-break rule

If task execution began and produced case artifacts, prefer product regression unless the captured evidence clearly shows the host failure happened first and made the behavior uninterpretable.

### Required blocker evidence

Any blocker-classified case must record:

- blocker code
- failing subsystem
- first failing command
- whether any model output was produced before the block
- whether rerun on the same fixture reproduced the block

## Execution procedure

The later runnable workflow should be:

1. Prepare a clean temp workspace per dataset row for `fresh`.
2. Prepare one clean temp workspace per `thread_group` for `threaded`.
3. Execute rows in `thread_order` within each threaded group.
4. Run fixture verification after every row.
5. Capture transcript, diff, stdout, stderr, and summary artifacts for every row.
6. Emit candidate reports and one comparison artifact under `experiments/results/e6-fresh-vs-threaded/v1/`.
7. Exclude blocker-classified rows from the headline score, but keep them visible in the report summary.

## How this feeds future smoke and eval work

This suite should guide later work in two directions.

### Eval bank growth

- promote repeated stale-context failures into stable fixture families
- reuse `scenario_family` labels in later E3 and E5 datasets where context and coordination interact
- keep the report shape compatible with baseline comparison and future replay artifacts

### Smoke growth

- any product failure class that appears repeatedly in `threaded` should become a candidate live smoke scenario
- blocker-heavy cases should not be promoted to smoke until the host path is stable enough to distinguish product behavior from harness failure
- the suite should help decide which continuing-thread flows deserve a quick smoke subset and which must stay in slower full-suite coverage

## Exit criteria for the first runnable version

The suite is ready for first locked evidence when:

- `experiments/eval/datasets/e6-fresh-vs-threaded.jsonl` exists with at least 12 rows
- every row has a deterministic fixture-local `verify`
- both `fresh` and `threaded` candidates emit machine-readable reports
- the report includes the failure and blocker classifications defined here
- at least one locked comparison exists under `experiments/results/e6-fresh-vs-threaded/v1/`

## Open design limits

This note intentionally does not define:

- replay UI or artifact browsing UX
- judge-based scoring for non-deterministic quality questions
- cross-host normalization beyond blocker classification

Those belong to later runner and artifact work once this suite produces stable evidence.
