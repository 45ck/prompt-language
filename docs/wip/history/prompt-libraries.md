# `prompt libraries` (WIP)

> **Status: shipped.** See [prompt-libraries](../../reference/prompt-libraries.md) in the Language Reference.

<!-- cspell:ignore jkfn -->

## Goal

Allow teams to define reusable prompt-language assets in files, import them with a namespace, and share them as local or packaged libraries.

This should cover the main reusable pieces users keep copy-pasting today:

- workflow fragments
- completion gate bundles
- prompt templates

The intent is to make reusable orchestration a first-class DSL concept rather than forcing everything into Claude Code skills.

## Proposed syntax

Library file:

```text
library: testing

export flow fix_and_test(test_cmd = "npm test", max = 3):
  retry max ${max}
    run: ${test_cmd}
    if command_failed
      prompt: Analyze the failures and fix the underlying code. Do not modify tests unless they are genuinely wrong.
    end
  end

export gates node_ci(typecheck_cmd = "npm run typecheck"):
  tests_pass
  lint_pass
  gate typecheck: ${typecheck_cmd}

export prompt review_findings(target):
  Review ${target} for bugs, regressions, and missing tests. Present findings first.
```

Consumer file:

```text
Goal: implement refresh token rotation

import "./libraries/testing.flow" as testing

flow:
  prompt: Implement refresh token rotation in src/auth.
  use testing.fix_and_test(test_cmd = "npm test -- auth", max = 5)
  use testing.review_findings(target = "src/auth")

done when:
  use testing.node_ci(typecheck_cmd = "npm run typecheck")
  file_exists docs/auth-rotation.md
```

Future package-style import:

```text
import "@acme/prompt-lib/testing" as testing
```

## Intended behavior

- library files are parsed statically, not executed dynamically
- `import ... as name` introduces a required namespace to avoid symbol collisions
- `use library.symbol(...)` expands to normal prompt-language syntax before runtime
- `export flow` expands into flow nodes
- `export gates` expands into one or more `done when:` predicates
- `export prompt` expands into a normal `prompt:` node
- parameters are named, support defaults, and are validated at parse time
- unknown parameters, missing required parameters, and missing symbols are lint errors
- expanded output is visible in render, validate, and dry-run output so users can audit what will execute

## Non-goals for the first version

- no remote URL imports
- no runtime network fetches
- no general-purpose user-defined functions with arbitrary return values
- no hidden gate execution; imported gates must remain visible after expansion
- no cross-workspace path traversal

## Why this is different from skills

- skills are agent-facing command packages with instructions and tool guidance
- prompt libraries are DSL-facing reusable workflow assets
- skills remain useful for packaging behavior around the agent
- prompt libraries make composition available inside `.flow` files themselves

## Beads breakdown

Umbrella feature:

- `prompt-language-9uqe.12` — Prompt libraries: namespaced exported reusable DSL assets

Tracked slices:

1. `prompt-language-jkfn` — Ship public local-file `import` with parse-time expansion and cycle detection.
2. `prompt-language-9uqe.12.6` — Add top-level `import ... as namespace` and namespaced symbol resolution.
3. `prompt-language-9uqe.12.1` — Add library/export syntax for reusable `flow`, `gates`, and `prompt` assets.
4. `prompt-language-9uqe.12.2` — Add `use namespace.symbol(...)` expansion inside `flow:`.
5. `prompt-language-9uqe.12.3` — Add `use namespace.symbol(...)` expansion inside `done when:`.
6. `prompt-language-9uqe.12.4` — Add parameter binding, defaults, and linting for missing or unknown arguments.
7. `prompt-language-9uqe.12.5` — Add library metadata and package-style resolution for shared prompt libraries.

## Current workaround

- copy-paste flow fragments between prompts or markdown notes
- encode reusable behavior in Claude Code skills
- keep shared gates in documentation and retype them into each flow
