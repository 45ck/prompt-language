# Context-Adaptive Program Status

- Status: evidence-positioning note for `prompt-language-0ovo`
- Audience: maintainers, reviewers, and users checking whether compact context is proven yet

## Verdict

The context-adaptive rendering program is still in the planning-and-bounded-evidence stage.

The repo can honestly claim:

- the program is defined
- parts of the trigger vocabulary are grounded in current hook behavior
- benchmark and reporting scaffolding exist

The repo cannot yet honestly claim:

- a shipped compact-mode feature for ordinary active turns
- completed compact-versus-full evaluation results
- promotion evidence showing that compact context preserves correctness and recovery

## What evidence exists now

### Design and rollout anchors

- [ADR-00XX: Context-Adaptive Rendering](../adr/ADR-00XX-context-adaptive-rendering.md)
- [Context-Adaptive Recovery Fallback](../design/context-adaptive-recovery-fallback.md)
- [Compact-Mode Fallback Matrix](../design/compact-mode-fallback-matrix.md)
- [Roadmap](../roadmap.md)

These define the target behavior and the fail-closed rollout posture. They are not proof of runtime completion.

### Evaluation scaffolding

- [Context-Adaptive Benchmark Pack](context-adaptive-benchmark-pack.md)
- [Context-Adaptive Results Template](context-adaptive-rendering-results-template.md)
- [Context-Adaptive Summary Safety Validation](context-adaptive-summary-safety-validation.md)

These provide benchmark categories, report structure, and a bounded safety note. They do not yet constitute a finished evaluation report.

### Current implementation-alignment subset

The strongest grounded part of the program today is the narrow compaction-preservation subset described in the fallback notes:

- full rendering is still the active-turn baseline
- the `pre-compact` path has matrix-aligned trigger reporting
- recovery-sensitive triggers are documented with a fail-closed posture

That is useful progress, but it is still narrower than a generally shipped compact-context mode.

## Remaining evidence gaps

The main open gaps are explicit in the backlog and docs:

- no general compact-mode selector for ordinary active turns
- no completed compact-versus-full benchmark results document
- no promotion evidence covering wins, ties, regressions, and rollback criteria
- no proof that recovery-sensitive scenarios remain safe under a real compact-mode rollout

Open backlog slices that still matter to the evidence story include:

- `prompt-language-0ovo.3.*` for compact-rendering foundations
- `prompt-language-0ovo.4.*` for summary and artifact-backed output handling
- `prompt-language-0ovo.5.*` for fail-closed fallback and recovery-path tests
- `prompt-language-0ovo.6.*` for comparison harness, fixtures, and published evaluation report

## Release posture

This program should still be described as:

- WIP in roadmap/status surfaces
- design target in design notes
- unshipped in the reference docs

It should not be described as:

- product-ready
- default behavior
- a supported end-user feature

## Recommendation

Use the following wording when summarizing the current state:

> prompt-language is exploring context-adaptive rendering as a fail-closed runtime optimization. The repo has design contracts and evaluation scaffolding, but compact context is not yet a shipped user feature and does not yet have completed promotion evidence.

That is the shortest honest status line that matches the current repo.

Best next specialist if the program needs evidence closure rather than more framing: `evaluation-report-writer`.
