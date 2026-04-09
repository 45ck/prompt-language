# Spec 003 — Spec layer and requirements

## Problem

The runtime assumes “requirements are correct,” but the language currently gives little structure to what a correct requirement means. `Goal:` is useful but too weak as the main representation of engineering intent.

Many forms of human babysitting are actually:

- requirements babysitting
- non-goal enforcement
- invariant recall
- scenario coverage checking

## Goals

- Add a lightweight spec layer above flows
- Make invariants, scenarios, and non-goals explicit
- Let flows depend on specs
- Improve reviewability and scenario coverage

## Non-goals

- This is not a full product management system
- This is not a giant ticketing or story system
- This is not an attempt to replace code/tests/docs entirely

## Proposed syntax

```yaml
spec "auth_regression"
  goal: "Fix the auth regression without widening scope"

  invariants:
    - unauthenticated requests return 401
    - expired sessions return 401
    - tenant A cannot access tenant B data
    - no database schema changes

  scenarios:
    - valid session returns 200
    - missing session returns 401
    - expired session returns 401

  non_goals:
    - no infra changes
    - no API contract changes
    - no schema migrations

  required_artifacts:
    - tests for expired session behavior
end
```

### Flow usage

```yaml
require spec "auth_regression"

flow:
  prompt: Fix the auth regression while preserving all spec invariants.
end
```

### Spec + contract linkage

```yaml
contract "safe_auth_fix"
  based_on spec "auth_regression"
  gates:
    - tests_pass
    - lint_pass
end
```

## Semantics

A `spec` is a declarative intent artifact. It does not execute. It should be usable by:

- prompts
- contracts
- evaluators
- documentation and review tooling
- static analysis

## Compiler behavior

The compiler should:

- verify referenced specs exist
- surface spec contents during explain/simulate
- detect flows that reference spec-required artifacts without producing them
- optionally map scenarios to tests/evals

## Why this matters

A runtime can only be as bounded as its declared intent.
Specs give the system something stronger than prose and lighter than a full formal method stack.

## Acceptance criteria

- Specs can define invariants, scenarios, and non-goals
- Flows can require specs
- Contracts can reference specs
- Tooling can surface spec coverage gaps

## Open questions

- Should scenario coverage remain purely descriptive at first, or should the runtime eventually map scenarios to tests?
- Should specs be versioned independently from flows?
