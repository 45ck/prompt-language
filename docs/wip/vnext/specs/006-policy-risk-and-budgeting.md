# Spec 006 — Policy, risk, and budgeting

## Problem

The runtime already has approvals, but not yet a coherent policy model for how autonomy should differ by risk. It also lacks first-class budgets to bound long autonomous runs.

## Goals

- Add policy tiers keyed by risk
- Allow automatic, review-gated, or approval-gated execution by class
- Add hard run budgets
- Make risk and budget violations explicit and replayable

## Non-goals

- This spec does not define every possible enterprise policy
- This spec does not replace contracts or effects; it consumes them

## Proposed syntax

### Policy block

```yaml
policy:
  default_risk: low

  low:
    action: auto

  medium:
    action: review
    require: judge "scope_guard"

  high:
    action: approve
    require_checkpoint: true

  irreversible:
    action: approve
    require_checkpoint: true
```

### Budgets

```yaml
budget:
  max_turns: 30
  max_runtime: 25m
  max_cost_usd: 4.00
  max_commands: 60
  max_files_changed: 20
  max_child_flows: 4
```

### Per-node override

```yaml
effect "open_pr" risk medium once key="${branch_name}"
  run: gh pr create --title "${title}"
end
```

## Semantics

### Policy resolution

Policy should be determined from:

1. explicit per-node risk
2. inferred effect class
3. default risk if unspecified

### Budget handling

When a budget is exceeded, the runtime should:

- pause the flow
- record structured reason
- emit summary and checkpoint info
- optionally request human approval to continue

### Budget scopes

Support:

- whole flow budgets
- child-flow budgets
- effect budgets
- evaluator budgets

## Static analysis

The compiler/linter should flag:

- high-risk effects without policy
- budgets omitted on long-running templates
- policy tiers referring to undefined judges/contracts
- contradictory budget configurations

## Acceptance criteria

- Policies can differentiate auto/review/approve behavior
- Budgets can stop flows with structured results
- Risk annotations integrate with effect nodes
- Policy decisions are replayable and observable

## Open questions

- Should cost budgeting require provider-specific token/cost adapters?
- Should `max_files_changed` be a contract concern, a budget concern, or both?
