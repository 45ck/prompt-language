# Design: Evaluation Stack V1 Boundary

## Status

Accepted implementation boundary for the first evaluation-stack slice.

This is a design note for backlog execution, not shipped syntax documentation.
Shipped behavior still lives in [reference/](../reference/index.md).

## Why this note exists

The broader proposal in [docs/wip/tooling/evals-and-judges.md](../wip/tooling/evals-and-judges.md)
is directionally strong, but it is too broad to hand directly to parser and runtime work.

The repo needs one bounded contract that says:

- what belongs in v1 syntax
- what remains CLI or artifact tooling
- what the canonical judge-result shape is
- how `review strict` relates to the current shipped `review`
- how `done when:` stays deterministic

This note is the execution boundary for `prompt-language-5vsm.1`.

## Anchors

- Proposal: [docs/wip/tooling/evals-and-judges.md](../wip/tooling/evals-and-judges.md)
- Research roadmap: [docs/strategy/thesis-roadmap.md](../strategy/thesis-roadmap.md)
- Shipped `review` behavior: [docs/reference/review.md](../reference/review.md)
- Deterministic completion principle: [docs/wip/vnext/adrs/ADR-002-deterministic-completion-vs-judges.md](../wip/vnext/adrs/ADR-002-deterministic-completion-vs-judges.md)

## Decision summary

The first evaluation-stack slice is split into two layers:

1. Parser and runtime layer:
   - named `rubric` declarations
   - named `judge` declarations
   - `review strict`
   - `review ... using judge "name"`
   - a stable typed judge-result envelope
2. Tooling and runner layer:
   - dataset execution
   - repeated runs
   - metrics aggregation
   - baseline comparison
   - replay
   - annotation
   - pairwise comparison

The important boundary is that v1 does not try to land every evaluation feature as ordinary flow syntax at once.

## Governing rules

### 1. `done when:` stays deterministic

`done when:` remains the hard completion boundary for ordinary flows.

Allowed there:

- built-in deterministic gates
- custom command-backed gates
- composite deterministic predicates

Not allowed there in v1:

- model judges
- human judges
- score thresholds derived from rubric output
- hidden evaluator behavior masquerading as completion logic

If a future workflow wants to branch on a judge result, it must do so explicitly. It must not smuggle evaluator semantics into `done when:`.

### 2. `review strict` is the first runtime consumer

The first runtime-facing use of named judges is not a general inline judge node.
It is `review strict`, because that is where fail-closed evaluator behavior is immediately useful and easiest to reason about.

### 3. `eval` is a runner concern before it is a general flow concern

`eval` is a real product capability, but its first delivery value is dataset execution and report generation.
That belongs with the runner and artifact layer before the repo adds broad in-flow suite syntax.

## V1 scope

| Capability                       | V1 status           | Why                                                             |
| -------------------------------- | ------------------- | --------------------------------------------------------------- |
| `rubric` declaration             | In scope as syntax  | Needed so judges have a reusable scoring contract               |
| `judge` declaration              | In scope as syntax  | Needed so `review strict` and eval tooling can share evaluators |
| `review strict`                  | In scope as syntax  | Smallest fail-closed quality loop with immediate runtime value  |
| `review using judge "name"`      | In scope as syntax  | Reuses named judges instead of embedding evaluator prompts      |
| Eval suite execution             | In scope as tooling | Critical for experiments, but belongs in runner/report layer    |
| Pairwise compare                 | Tooling only in v1  | Report mode, not core flow control                              |
| Replay by run ID                 | Tooling only in v1  | Artifact system concern                                         |
| Baseline lock                    | Tooling only in v1  | Comparison and storage concern                                  |
| Human annotation queues          | Tooling only in v1  | Calibration workflow, not parser-critical                       |
| Judge-driven ordinary flow nodes | Out of scope in v1  | Avoids a larger control-surface explosion                       |

## Syntax boundary

### In scope for parser work

The parser may introduce:

```text
rubric "bugfix_quality"
  ...
end

judge "impl_quality"
  ...
end

review strict using judge "impl_quality" max 3
  ...
end
```

### Not in scope for first parser work

The following remain out of scope for the first parser slice:

- standalone `run judge "name"` execution syntax
- `if judge "name"` or `while judge "name"` control-flow forms
- judge references inside `done when:`
- flow-embedded pairwise compare constructs
- first-class replay or annotation keywords

This keeps `prompt-language-5vsm.2` bounded enough to ship.

## Canonical judge-result schema

The runtime and tooling should share one minimal v1 result shape:

```json
{
  "pass": true,
  "confidence": 0.91,
  "reason": "Tests pass and the diff stays within the intended scope.",
  "evidence": ["All required checks passed", "Only auth-related files changed"],
  "abstain": false
}
```

### Required fields

| Field        | Type       | Meaning                                                       |
| ------------ | ---------- | ------------------------------------------------------------- |
| `pass`       | `boolean`  | Final verdict when the judge has enough evidence to decide    |
| `confidence` | `number`   | Normalized confidence in `[0,1]`; low precision is acceptable |
| `reason`     | `string`   | Short human-readable explanation                              |
| `evidence`   | `string[]` | Concrete support, not chain-of-thought                        |
| `abstain`    | `boolean`  | True when the judge lacks evidence or cannot evaluate safely  |

### Required invariants

- `abstain: true` means the result must not be treated as pass.
- `pass` remains boolean even when confidence is low. Abstention is how uncertainty becomes explicit.
- `evidence` is for durable artifacts and debugging, not hidden reasoning dumps.
- Per-criterion rubric detail is intentionally deferred from the canonical envelope. It may be added later as a backward-compatible extension once the runner and artifact model stabilize.

This matches the runtime target already implied by `prompt-language-5vsm.3`.

## Minimal supported judge inputs

The first slice should keep judge inputs narrow:

| Input           | V1 status | Why                                                           |
| --------------- | --------- | ------------------------------------------------------------- |
| `output`        | Yes       | Basic outcome judging                                         |
| `diff`          | Yes       | Essential for implementation-quality and scope judges         |
| `test_output`   | Yes       | Needed for grounded software-quality judgments                |
| `files`         | Deferred  | Useful, but potentially expensive and broad                   |
| `trace`         | Deferred  | Important later, but tied to the artifact/replay design       |
| `tool_calls`    | Deferred  | Better after artifact capture and cost boundaries are clearer |
| `state`         | Deferred  | Too easy to overexpose internal context in the first slice    |
| full transcript | Deferred  | High cost and weak default privacy boundary                   |

The first goal is not maximum evaluator flexibility.
It is a stable, explainable contract.

## `review strict` semantics

### Existing `review`

The shipped `review` block is generator-evaluator repair logic with a permissive end state:

- it reruns while critique says the result is not good enough
- if rounds exhaust, execution continues

### V1 `review strict`

`review strict` keeps the same loop shape but changes the exhaustion behavior:

- if a passing verdict is not reached before `max` rounds, the flow fails closed
- fail-closed exhaustion is explicit behavior, not an accidental side effect

### V1 supported forms

Supported:

```text
review strict max 3
  ...
end
```

```text
review strict using judge "impl_quality" max 3
  ...
end
```

Not in scope for the first slice:

- multiple judges on one review block
- judge aggregation inside the review header
- mixing `using judge "name"` with complex inline rubric definitions

## Eval boundary for v1

`eval` is still a first-class project concept, but its first concrete delivery is runner-side.

That means `prompt-language-5vsm.4` should own:

- checked-in dataset references
- repeated execution
- judge invocation
- metrics
- baseline comparison
- machine-readable reports

It should not wait for every eval detail to exist as in-flow runtime syntax.

### What this means in practice

- The repo may use checked-in eval manifests, suite files, or thin prompt-language wrappers.
- The core runner owns report generation and artifact persistence.
- Replay, compare, annotate, and baseline lock are CLI and artifact concerns first.

This keeps the experiment infrastructure moving without forcing a bloated parser milestone.

## Relationship to thesis work

This boundary is intentionally aligned to the experiment roadmap in [docs/strategy/thesis-roadmap.md](../strategy/thesis-roadmap.md):

- E1, E2, and E3 need repeatable suite execution and baseline comparison more than they need every evaluation concept in core flow syntax.
- `review strict` is directly useful for fail-closed self-hosting and quality loops.
- A typed judge-result envelope is the minimum reusable building block for later eval suites, dataset banks, and artifact replay.

## Parser and runtime implications

### For `prompt-language-5vsm.2`

The parser and render work should assume:

- `rubric` and `judge` are declaration forms
- `review strict` is a modifier on the existing review construct
- ordinary completion and control-flow syntax do not gain model-judge shortcuts in this slice

### For `prompt-language-5vsm.3`

The runtime work should assume:

- one canonical judge-result envelope
- one fail-closed review mode
- backward-compatible ordinary `review`
- named-judge reuse rather than inline evaluator drift

### For `prompt-language-5vsm.4`

The eval runner work should assume:

- suite execution is primarily a tooling concern
- artifact persistence and reports matter more than adding extra DSL keywords early
- pairwise compare and baseline lock belong in the runner/report layer first

## Explicit non-goals

The first slice does not try to do all of the following:

- replace `done when:` with judge-based quality grading
- turn prompt-language into a general statistics or experiment-analysis platform
- add arbitrary inline model evaluation anywhere a boolean is expected
- ship transcript-heavy judging by default
- solve annotation, replay, and baseline storage inside the parser milestone

## Deferred questions

These remain open on purpose:

1. Should future ordinary flows be able to capture judge outputs directly as values?
2. Should `eval` eventually become a dedicated suite-file syntax, a manifest format, or both?
3. What optional per-criterion detail should extend the v1 judge-result envelope later?
4. Which artifact inputs become safe enough to expose by default after replay and storage land?

## Backlog effect

This note narrows the next steps:

- `prompt-language-5vsm.1`: satisfied by this design note once linked into docs
- `prompt-language-5vsm.2`: implement declarations plus `review strict`, not the whole universe
- `prompt-language-5vsm.3`: use the five-field judge-result envelope above
- `prompt-language-5vsm.4`: treat eval as runner and artifact work first

That is the intended implementation order.
