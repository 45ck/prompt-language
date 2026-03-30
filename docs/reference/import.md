# import

`import` inlines a reusable flow file at parse time.

## Syntax

Anonymous import (nodes inlined directly):

```yaml
import "flows/setup.flow"
```

Named import (registers as a library namespace):

```yaml
import "libraries/testing.flow" as testing
```

## Semantics

- Anonymous import: all flow nodes from the file are inserted into the current flow block at the point of the `import` statement.
- Named import (`as ns`): registers the file as a library namespace. Its exported symbols are accessed via `use ns.symbol(args)`. See [prompt-libraries](prompt-libraries.md).
- Path must be relative. `..` traversal is not allowed.
- File extension must be `.flow`, `.prompt`, or `.txt`.
- Circular imports are detected and skipped with a warning logged to stderr.
- Imports are recursive — imported files may import other files.

## Example

```yaml
import "flows/common-setup.flow"
import "libraries/testing.flow" as testing

flow:
  use testing.fix_and_test(test_cmd="jest")
end
```

## Related

- [prompt-libraries](prompt-libraries.md)
