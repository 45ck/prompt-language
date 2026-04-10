# Artifact Taxonomy

## First-class built-in artifact families

### 1. Intent artifacts

Used before or during execution to explain planned work.

- `task_list`
- `implementation_plan`
- `decision_record`
- `risk_assessment`

### 2. Change artifacts

Used to explain what changed.

- `code_diff_summary`
- `changed_files_report`
- `migration_report`
- `config_change_report`

### 3. Verification artifacts

Used to prove that work was validated.

- `test_report`
- `benchmark_report`
- `walkthrough`
- `screenshot_set`
- `browser_recording`
- `before_after_comparison`

### 4. Oversight artifacts

Used for human governance and control.

- `approval_request`
- `rollback_plan`
- `exception_report`
- `blocked_reason`

### 5. Learning artifacts

Used to capture reusable improvement.

- `postmortem`
- `failure_pattern`
- `rule_candidate`
- `workflow_candidate`

## Recommended built-ins for an initial release

If prompt-language starts small, the best initial built-ins are:

- `implementation_plan`
- `task_list`
- `walkthrough`
- `test_report`
- `approval_request`

That set covers planning, proof, and human oversight.

## Why custom artifacts still matter

Built-ins will not cover:

- client handoffs
- SEO audits
- browser QA packets
- release readiness packets
- migration board outputs
- domain-specific compliance reports
- business-specific review packets

So the runtime should ship core artifact protocols plus a user-defined type system.
