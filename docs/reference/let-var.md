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

Memory lookup:

```yaml
let preferred_language = memory "preferred-language"
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

### Structured JSON capture

Capture a prompt response and validate it against a schema:

```yaml
let analysis = prompt "Analyze the diff" as json {
  "summary": "string",
  "risk": "low | medium | high",
  "files_changed": "number"
}
```

- The agent is instructed to respond with JSON matching the given schema.
- On successful parse, `analysis` holds the raw JSON string.
- Individual fields are accessible as `${analysis.summary}`, `${analysis.risk}`, etc.
- If the response cannot be parsed, the capture retries up to 3 times before storing the raw text.

### Persistent memory lookup

Use `memory "key"` to read a keyed memory value into a variable.

- Missing keys resolve to an empty string.
- The `memory:` section can still prefetch keys at flow start.

## Semantics

- `let`/`var` auto-advance; they do not wait for manual confirmation.
- Prompt capture uses a two-turn capture flow.
- Variables are global within the session state. There is no block scope.

## Related

- [Runtime Variables](runtime-variables.md)
- [foreach](foreach.md)
- [ask](ask.md)
