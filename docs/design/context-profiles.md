# Context Profiles

Status: implemented slice for `prompt-language-9uqe.2`

## Scope

This slice adds prompt-language-owned context profiles for flow defaults and per-turn overrides.
It does not add named agents or host-specific profile administration.

## Config schema

Profiles are loaded from the first file found at:

1. `prompt-language.config.json`
2. `.prompt-language/config.json`

Schema:

```json
{
  "profiles": {
    "reviewer": {
      "systemPreamble": "Review carefully.",
      "skills": ["security-review"],
      "memory": ["repo_rules", "style_guide"],
      "model": "gpt-5",
      "modelHints": ["fast", "low-latency"],
      "toolPolicy": "read-only"
    }
  }
}
```

Validation rules:

- each profile must set at least one field
- all strings must be non-empty after trim
- unknown fields are rejected

## Selection syntax

Flow default:

```yaml
use profile "default"
```

Per-turn prompt:

```yaml
prompt using profile "reviewer": Inspect the diff.
let plan = prompt using profile "planner" "Draft the plan"
```

Per-turn ask:

```yaml
if ask "is this safe?" using profile "reviewer" grounded-by "npm test" max-retries 2
  prompt: Ship it.
end
```

## Precedence

Deterministic merge order is:

1. flow default profile
2. node-level override profile
3. explicit runtime model config

Merge semantics:

- `systemPreamble`, `skills`, `memory`, and `modelHints` append in order
- list fields are de-duplicated while preserving first appearance
- scalar fields such as `model` and `toolPolicy` are last-writer-wins
- explicit runtime `model` input still overrides profile-selected `model`

## Runtime behavior

- resolved profile context is prepended to emitted `prompt` turns
- resolved profile context is prepended to emitted `ask` judge prompts
- profile `memory` keys are merged into `FlowSpec.memoryKeys` so they preload through existing memory hydration paths
- unknown profile references fail at parse time with an actionable error naming the config path

## Known gap

This slice does not bind profiles to named agents or spawn-time runner abstractions yet.
That remains separate from turn-level profile selection.
