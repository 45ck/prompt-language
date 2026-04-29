# Risk Taxonomy

## Required Risk Categories

| Category              | Examples                                                           |
| --------------------- | ------------------------------------------------------------------ |
| Requirement ambiguity | Undefined priority, unclear edge case, conflicting instructions    |
| Data integrity        | Migration, deletion, merge semantics, persistence compatibility    |
| Security and auth     | Ownership checks, privilege escalation, injection, unsafe defaults |
| Architecture boundary | Wrong layer, external dependency in domain, circular dependency    |
| Test adequacy         | Tests pass without testing the new behavior                        |
| Operational safety    | Slow command, timeout, flaky service, missing environment          |

## Severity

- `low`: localized, easily reversible, deterministic tests cover it.
- `medium`: behavior change with edge cases or compatibility concerns.
- `high`: security, data loss, architectural boundary, or unclear requirement.

## Required Output

Each run should capture:

- top risks
- severity
- evidence
- mitigation
- escalation decision
