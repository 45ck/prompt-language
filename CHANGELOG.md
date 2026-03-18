# Changelog

All notable changes to this project will be documented in this file.

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
