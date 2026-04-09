# Spec 002 — Contract system

## Problem

Developers supervise agents not only by checking whether tests pass, but by enforcing boundedness:

- touched files
- forbidden areas
- scope of change
- invariants
- artifact requirements
- public API expectations
- risk boundaries

`done when:` gates are necessary but too small to encode this whole supervision layer.

## Goals

- Introduce reusable, composable boundedness contracts
- Make contracts first-class and reviewable
- Reduce diff babysitting and scope babysitting
- Allow static and dynamic constraints to coexist

## Non-goals

- Contracts are not a general theorem prover
- Contracts do not replace all gates; they package them
- Contracts do not turn semantic reasoning into magic

## Proposed syntax

### Basic contract

```yaml
contract "safe_auth_fix"
  gates:
    - tests_pass
    - lint_pass
    - gate typecheck: npx tsc --noEmit

  allow_paths:
    - src/auth/**
    - tests/auth/**

  forbid_paths:
    - infra/**
    - migrations/**
    - billing/**

  limits:
    files_changed <= 12
    diff_lines <= 250
end
```

### Contract with invariants and artifacts

```yaml
contract "safe_release_prep"
  gates:
    - tests_pass
    - gate build: npm run build

  require_artifacts:
    - file_exists dist/index.js
    - file_exists dist/report.json

  invariants:
    - "no public API changes"
    - "no schema changes"
    - "tenant isolation preserved"
end
```

### Composition

```yaml
contract "ts_quality"
  gates:
    - lint_pass
    - gate typecheck: npx tsc --noEmit
end

contract "no_prod_touch"
  forbid_paths:
    - infra/**
    - ops/**
end

contract "safe_frontend_fix" extends "ts_quality", "no_prod_touch"
  allow_paths:
    - apps/web/**
end
```

### Usage

```yaml
done when: contract "safe_auth_fix"
```

or:

```yaml
use contract "safe_auth_fix"
```

## Semantics

Contracts should support three categories of checks:

### 1. Static constraints

Evaluated from changed files or declared topology:

- allow/forbid paths
- max files changed
- diff line caps
- required artifact presence

### 2. Dynamic deterministic checks

Evaluated from commands:

- tests
- lint
- typecheck
- build
- custom analyzers

### 3. Semantic analyzers

Evaluated through explicit analyzers/judges, not hidden magic:

- public API surface unchanged
- database schema unchanged
- no permission widening
- no secret reads

These should not silently collapse into vibes. If they require model judgment, they belong in a named analyzer or judge.

## Static analysis

The compiler/linter should:

- verify that referenced contracts exist
- detect conflicting `allow_paths` / `forbid_paths`
- detect impossible contracts
- detect contracts that permit no files
- detect unbounded contracts in risky flows

## Contract tests

Contracts should be testable artifacts.

### Proposed syntax

```yaml
test "safe_auth_fix rejects infra edits"
given changed_files = ["infra/prod.tf"]
expect contract "safe_auth_fix" fails
end
```

```yaml
test "safe_auth_fix accepts auth-only diff"
given changed_files = ["src/auth/session.ts", "tests/auth/session.test.ts"]
given checks.tests_pass = true
given checks.lint_pass = true
expect contract "safe_auth_fix" passes
end
```

## Runtime behavior

The runtime should emit structured contract results:

```json
{
  "contract": "safe_auth_fix",
  "pass": false,
  "violations": [
    { "type": "forbid_path", "path": "infra/prod.tf" },
    { "type": "diff_lines", "actual": 412, "limit": 250 }
  ]
}
```

## Migration path

### Phase 1

- static file/path and size limits
- contract packaging of existing gates

### Phase 2

- required artifact declarations
- analyzers for semantic checks

### Phase 3

- contract inheritance/composition
- contract tests

## Acceptance criteria

- Contracts can package gates and scope rules
- Contracts can be reused across flows
- Contract violations are structured and explainable
- Contracts can be linted
- Contracts can be tested in isolation

## Open questions

- Should contracts be allowed inside `spec` blocks only, or globally?
- How much semantic checking should be built in vs analyzer plugins?
