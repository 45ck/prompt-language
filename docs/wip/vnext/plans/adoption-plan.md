# Adoption plan

## Objective

Introduce vNext in a way that gives immediate value to current users without requiring a full mental-model rewrite.

## Recommended rollout ladder

### Level 1 — Safer current runtime

Adopt:

- strict mode
- `review strict`
- fail-closed approvals
- budgets

### Level 2 — Bounded engineering

Adopt:

- contracts
- basic policies
- effect nodes for risky actions

### Level 3 — Replay and analysis

Adopt:

- event logs
- checkpoints
- replay CLI
- structured reports

### Level 4 — Evaluation and learning

Adopt:

- rubrics/judges
- eval suites
- regression promotion
- memory governance

### Level 5 — Multi-agent and provider portability

Adopt:

- worktree spawn
- locks
- provider adapters

## Target personas

### Solo builder

Main value:

- fewer interrupted loops
- safer retries
- checkpoint/replay

### Senior developer / tech lead

Main value:

- bounded changes
- contract libraries
- reviewable run artifacts

### Platform / AI tooling engineer

Main value:

- policy
- provider adapters
- evals and regression banks
- memory governance
