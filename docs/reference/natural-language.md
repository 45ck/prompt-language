# Natural Language

prompt-language can detect control-flow intent in ordinary English and ask the active harness to emit a structured flow.

## Typical inputs

- "keep going until the tests pass"
- "retry three times"
- "don't stop until lint passes"

## Semantics

- Detection is best-effort, not a deterministic compiler.
- Claude Code and Codex hook entrypoints both use the same NL detector plus a confirmation turn before emitting the DSL helper prompt.
- When NL meta-prompting is enabled, the hook first asks for confirmation. A trivial reply such as `yes`, `ok`, or `go ahead` then expands into the DSL helper prompt.
- When precision matters, write explicit DSL instead of relying on natural language conversion.

## Toggle Controls

NL meta-prompting is enabled by default. You can override it with environment variables:

- `PROMPT_LANGUAGE_META_PROMPT=0` disables NL meta-prompting for all supported hooks.
- `PROMPT_LANGUAGE_CLAUDE_META_PROMPT=0` disables it only for the Claude hook.
- `PROMPT_LANGUAGE_CODEX_META_PROMPT=0` disables it only for the Codex hook.

Accepted true values: `1`, `true`, `on`

Accepted false values: `0`, `false`, `off`

When disabled, natural-language prompts pass through unchanged and no pending confirmation state is recorded.

## Related

- [Program Structure](program-structure.md)
- [DSL Reference](dsl-reference.md)
