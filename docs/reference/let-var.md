# let / var

`let` and `var` store values in the runtime state. They are interchangeable.

## Syntax

Literal:

```yaml
let env = "prod"
```

Command capture:

```yaml
let version = run "node -v"
```

Prompt capture:

```yaml
let analysis = prompt "Summarize the failing tests"
```

## Features

### Interpolation

```yaml
prompt: Deploying ${version} to ${env:-development}.
```

### Default values

Use `${name:-fallback}` when a variable may be unset.

### Arithmetic

```yaml
let count = "0"
let count = ${count} + 1
```

### List variables

```yaml
let items = []
let items += "first"
let items += run "echo second"
```

### Pipe transforms

```yaml
let branch = run "git branch --show-current" | trim
```

Supported transforms:

- `trim`
- `upper`
- `lower`
- `first`
- `last`

## Semantics

- `let`/`var` auto-advance; they do not wait for manual confirmation.
- Prompt capture uses a two-turn capture flow.
- Variables are global within the session state. There is no block scope.

## Related

- [Runtime Variables](runtime-variables.md)
- [foreach](foreach.md)
- [ask](ask.md)
