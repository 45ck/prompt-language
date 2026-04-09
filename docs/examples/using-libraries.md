# Example: Using Libraries

This example shows the smallest useful pattern for `import` + prompt libraries:

- one shared library file with exported `flow`, `prompt`, and `gates`
- three separate flow files that import and reuse that shared library
- one top-level project file that coordinates the three consumers without copy-pasting shared steps

## Example layout

```text
examples/ilex-libraries/
  project.flow
  libraries/
    common.flow
    discovery.flow
    implementation.flow
    release.flow
```

## What it demonstrates

- `import "libraries/common.flow" as common` registers a reusable namespace
- `use common.review_prompt(...)` expands an exported prompt into a normal `prompt:` node
- `use common.fix_and_test(...)` expands an exported flow block into the consumer flow
- `use common.all_tests_pass(...)` expands exported gates into `done when:`
- each consumer file stays small and focused, while the shared logic lives in one place

## Top-level project flow

```yaml
Goal: validate shared imports and prompt libraries across multiple flow files

import "libraries/common.flow" as common
import "libraries/discovery.flow" as discovery
import "libraries/implementation.flow" as implementation
import "libraries/release.flow" as release

flow:
  use discovery.map_shared_scope()
  use implementation.fix_shared_flow(pkg_mgr="pnpm")
  use release.prepare_release()

done when:
  use common.all_tests_pass(test_cmd="pnpm test")
  gate docs: test -f docs/examples/using-libraries.md
```

## How to validate locally

Run validation from the example directory so the relative imports resolve correctly:

```bash
cd examples/ilex-libraries
node ../../bin/cli.mjs validate --file project.flow
```

If you want to inspect the imported files separately, you can also list the expanded project inputs:

```bash
node ../../bin/cli.mjs list
```

## Why this example exists

The goal is to prove that reusable prompt-language assets can be shared across multiple flow files without turning the project into copy-paste soup. The shared library carries the reusable logic, while each consumer flow owns only its stage-specific orchestration.
