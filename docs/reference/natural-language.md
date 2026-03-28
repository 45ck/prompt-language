# Natural Language

prompt-language can detect control-flow intent in ordinary English and ask Claude to emit a structured flow.

## Typical inputs

- "keep going until the tests pass"
- "retry three times"
- "don't stop until lint passes"

## Semantics

- Detection is best-effort, not a deterministic compiler.
- Claude translates the intent into DSL with the runtime's help text.
- When precision matters, write explicit DSL instead of relying on natural language conversion.

## Related

- [Program Structure](program-structure.md)
- [DSL Reference](../dsl-reference.md)
