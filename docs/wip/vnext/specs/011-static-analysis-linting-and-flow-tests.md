# Spec 011 — Static analysis, linting, simulation, and flow tests

## Problem

A serious execution language needs its own testing and static analysis. Without this, flows remain hard to trust and hard to evolve.

## Goals

- Add strong lint/static analysis
- Add simulation/dry-run support
- Add unit-style flow tests
- Detect trust/policy/scope errors before runtime

## Proposed CLI

```bash
prompt-language lint flows/fix-auth.flow
prompt-language simulate flows/fix-auth.flow
prompt-language test flows/**/*.spec.flowtest
```

## Static checks

The linter should catch:

- unknown vars/schema/judge/contract refs
- unreachable nodes
- loops without budgets
- risky effects without approval/policy
- contradictory contracts
- overlapping ownership in parallel branches
- missing locks
- strict-mode violations
- impossible expectations

## Simulation

Simulation should allow mocked:

- gate results
- command exits
- judge results
- budget triggers
- child flow outcomes

### Example

```yaml
simulate "flows/fix-auth.flow"
  mock gate tests_pass: [false, true]
  mock judge impl_quality: [pass]
  mock command "npm test -- auth": exit 1 -> exit 0
end
```

## Flow tests

### Example

```yaml
test "review strict fails after 3 bad rounds"
given judge "impl_quality" => fail, fail, fail
expect flow_status == "failed"
end
```

```yaml
test "strict mode rejects unknown variable"
given trust.mode = strict
expect compile_error contains "unknown variable"
end
```

## Acceptance criteria

- Linter exists and catches trust/scope/effect errors
- Simulation exists for common runtime primitives
- Flow tests can assert compile/runtime behavior
- CI can run flow tests separately from code tests
