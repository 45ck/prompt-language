# Task

Implement only:

```text
src/route-predicate-hooks.mjs
```

Do not edit:

```text
src/route-decision-scaffold.mjs
test/public-gate.mjs
package.json
README.md
TASK.md
```

## Boundary

The scaffold owns all policy tables and output envelopes. The hook file must not
hard-code route decisions, unsafe-key constants, selected-route fields, or
escalation reason order.

Implement the two exported predicate helpers:

- `matchesAnyEvidenceTextPattern(value, patterns)`: return true only when the
  value is a string and at least one provided regular expression matches it.
- `isRelativeArtifactReference(value)`: return true only for repository-relative
  artifact references with no URL scheme, no absolute path, no query/fragment,
  and no `..` path segment.

The public gate and hidden oracle will verify the scaffold-owned route record
builder through `src/route-decision-scaffold.mjs`.
