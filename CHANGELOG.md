# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-03-22

### Added

- **Break node** (H#15): `break` exits the nearest enclosing loop (while/until/retry/foreach).
- **Try/finally** (H#20): Optional `finally` block always executes after try/catch.
- **Comparison operators** (H#3): `==`, `!=`, `>`, `<`, `>=`, `<=` in condition evaluation.
- **Logical operators** (H#1): `and`/`or` connectives in conditions.
- **Variable references** (H#6): `${var}` and quoted strings in comparisons.
- **Custom gates** (H#26): `gate name: command` syntax in `done when:` section.
- **NL-to-DSL confirmation** (H#40): Asks user to confirm before generating a flow from natural language.
- **File locking** (H#58): Advisory file lock on state writes to prevent corruption.
- **Lint-flow** (H#75): Pure flow linter detecting anti-patterns (empty bodies, break outside loop, retry without run, missing goal).
- **List variables**: `let x = []`, `let x += "val"`, `${x_length}` auto-variable, foreach integration.
- **Foreach iteration**: `foreach item in collection` with automatic splitting (JSON arrays, newlines, whitespace).
- **Gate diagnostics**: `GateEvalResult` stores command/exitCode/stderr per gate; `renderFlow()` shows inline diagnostics.
- **Colorized flow output**: Hooks render flow with ANSI colors to stderr.
- **100 A/B comparative evaluation hypotheses** across 15 categories.
- **12 automated smoke tests** covering variables, gates, foreach, if/else, try/catch, let-prompt.

### Changed

- Updated flow-complexity, render-flow, and index exports for new node types.
- Expanded DSL parser to handle break, finally, custom gates.

## [0.1.0] - 2026-03-18

### Added

- Domain layer: FlowNode types (while, until, retry, if, prompt, run, try), FlowSpec, SessionState, Resolver.
- DSL parser for structured control-flow definitions.
- Natural language detector that converts plain English into FlowSpec.
- Application layer with use cases and port interfaces.
- Infrastructure adapters for file I/O, command execution, and condition evaluation.
- Three presentation hooks: UserPromptSubmit, Stop, TaskCompleted.
- Built-in resolvers: tests_pass, tests_fail, lint_pass, lint_fail, command_failed, command_succeeded, file_exists, diff_nonempty, last_exit_code.
- Completion gates with optional verification commands.
- Skills: /flow:run, /flow:status, /flow:reset.
- Full CI pipeline: typecheck, lint, format, spell, dependency-cruiser, knip, build, test, audit.
- Documentation: README, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, DSL reference, hooks architecture, examples.
