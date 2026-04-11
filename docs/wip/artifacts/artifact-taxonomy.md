# Artifact Taxonomy

This document does not choose the first shipped built-ins. That belongs to `prompt-language-50m6.2`.

Its job in `prompt-language-50m6.1` is narrower: define which families belong inside the artifact concept at all, and which outputs should stay outside that concept even if they are stored on disk.

## Inclusion test

An output belongs in the artifact taxonomy only if all of these are true:

1. it is intentionally emitted as a named deliverable rather than being an incidental file
2. a human can inspect it as a proof, handoff, request, or review object
3. a machine can identify its type and validate basic structure
4. it still has meaning outside the immediate execution trace

If any of those fail, the output is probably a log, state snapshot, scratch file, attachment, or renderer by-product instead of a first-class artifact.

## Artifact families that are in bounds

### Intent artifacts

Intent artifacts explain planned work before or during execution.

Representative examples:

- `task_list`
- `implementation_plan`
- `decision_record`
- `risk_assessment`

Why they fit:

- they are reviewable by a human before later work proceeds
- they can be validated for structure and required sections
- they remain meaningful after the originating prompt completes

Not included in this family:

- transient planner scratchpads
- hidden reasoning traces
- internal agent memory about future tasks

### Change artifacts

Change artifacts explain what changed or what is proposed to change.

Representative examples:

- `code_diff_summary`
- `changed_files_report`
- `migration_report`
- `config_change_report`

Why they fit:

- they package change evidence for review or handoff
- they can summarize multiple side effects without becoming the side effects themselves

Not included in this family:

- raw `git diff` output with no artifact envelope
- the changed files themselves
- audit events that merely record that a side effect happened

### Verification artifacts

Verification artifacts prove what was checked and what the outcome was.

Representative examples:

- `test_report`
- `benchmark_report`
- `walkthrough`
- `screenshot_set`
- `browser_recording`
- `before_after_comparison`

Why they fit:

- they capture evidence intended for later inspection
- they can support approval, release, or debugging workflows without being raw logs

Not included in this family:

- stdout/stderr dumps by default
- low-level event traces
- replay state snapshots

### Oversight artifacts

Oversight artifacts support explicit human governance.

Representative examples:

- `approval_request`
- `rollback_plan`
- `exception_report`
- `blocked_reason`

Why they fit:

- they package decision-ready context for a reviewer
- they support governance without becoming the gate primitive itself

Not included in this family:

- the approval state machine itself
- branch conditions
- policy flags stored in runtime state

### Learning artifacts

Learning artifacts preserve reusable lessons after execution.

Representative examples:

- `postmortem`
- `failure_pattern`
- `rule_candidate`
- `workflow_candidate`

Why they fit:

- they are human-facing outputs meant to be read and reused
- they can later inform memory or policy systems without being memory records themselves

Not included in this family:

- long-term memory storage entries
- embedding indexes
- background training or tuning data

## Outputs intentionally outside the taxonomy

The following may coexist with artifacts, but they are not artifacts by default:

- execution state and snapshots
- audit logs and execution traces
- arbitrary exported files
- renderer caches and temporary views
- raw model transcripts
- hidden chain-of-thought or internal deliberation
- large-output retention blobs used only to avoid prompt bloat

Some of those outputs may later be attached to an artifact package, referenced by an artifact, or summarized by an artifact. That relationship does not make them first-class artifact types.

## Consequences for later slices

This boundary constrains later work:

- `prompt-language-50m6.2` must choose initial built-ins from these in-bounds families instead of inventing a taxonomy that absorbs logs or state.
- `prompt-language-50m6.3` must treat attachments and rendered views as parts of an artifact package, not as separate artifact families by default.
- `prompt-language-50m6.8` can decide custom type declaration and attachment typing later, but not by redefining traces, memory, or snapshots as artifacts.
