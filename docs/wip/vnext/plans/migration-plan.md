# Migration plan

## Goal

Introduce vNext features without breaking current users or invalidating existing docs.

## Strategy

### Step 1 — additive only

All new features should be opt-in:

- strict mode
- contracts
- effect nodes
- policies
- event logs

Existing flows keep working.

### Step 2 — recommended templates

New project templates should default to:

- strict mode
- budgets
- checkpointing
- replay artifacts

### Step 3 — lint pressure, not immediate breaking changes

Use lints and warnings before hard errors for:

- unknown vars
- risky raw shell
- approval timeout semantics
- unbounded loops in production templates

### Step 4 — promote best practices

Over time, make recommended usage more opinionated:

- `review strict` examples
- contract libraries
- safe effect patterns
- baseline eval templates

### Step 5 — deprecate dangerous defaults carefully

Potential later deprecations:

- approval timeout => approve
- silent unknown-var passthrough in strict projects
- fail-open state corruption handling

## Backward compatibility rules

- current syntax should continue to parse
- permissive mode should remain for experimentation
- new warnings should have migration docs and fix hints
