# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **`approve` node** — hard human approval checkpoint. `approve "message"` blocks execution until the human confirms (yes/no). `approve "message" timeout N` auto-continues after N seconds. Sets `approve_rejected = true` on decline.
- **`review` block** — generator-evaluator critique loop. Body runs, then Claude evaluates against optional `criteria: "..."`. Repeats up to `max N` times. Optional `grounded-by "cmd"` for deterministic grounding. Sets `_review_critique` variable.
- **`race` block** — competitive parallel execution. First child to complete (exit 0) wins. Sets `race_winner` to the winning child name. Optional `timeout N` seconds.
- **`foreach-spawn` block** — fan-out: spawns one child process per list item, all running in parallel. `foreach-spawn item in ${list} max N`. Use `await all` to join.
- **`remember` node** — writes free-form text or key-value pairs to the agent's persistent memory store. `remember "text"` or `remember key="k" value="v"`.
- **`memory:` section** — prefetch named keys from memory at flow start; values are available as `${key}` variables.
- **`send` / `receive` nodes** — inter-agent messaging. `send "target" "message"` sends a message to a named agent or `parent`. `receive varName [from "source"] [timeout N]` blocks until a message arrives.
- **`import` directive** — `import "file.flow"` inlines another flow file at parse time. `import "file.flow" as ns` creates a namespace for library access.
- **Prompt library system** — `library: name` declares a reusable library. `export flow name(params):` exports a flow block. `use ns.symbol(args)` inlines it at the call site.
- **VS Code extension** — basic DSL syntax highlighting for `.flow` and `PROMPT.md` files in `vscode-extension/`.
- **GitHub Actions integration** — `45ck/prompt-language-action` for running flows in CI pipelines (`action/action.yml`).
- **`approve`/`review`/`race`/`foreach-spawn`/`remember`/`send`/`receive`/`import`/`prompt-libraries` reference docs** added to `docs/reference/`.
- Test coverage thresholds met (statements 90.73%, branches 85%, functions 91.48%, lines 91.56%) with 1,898 tests across 56 files.

## [0.3.0] - 2026-03-26

### Added

- **`ask` keyword** — AI-evaluated conditions for `if`/`while`/`until` (`while ask "question?" max 5`, optional `grounded-by "cmd"` for deterministic grounding).
- **`continue` node** — skips to the next loop iteration (mirrors `break`).
- **`else if` / `elif`** — multi-branch conditional sugar; parser desugars to nested `if/else`.
- **`${var:-default}`** — default-value syntax in conditions; interpolated before evaluation.
- **Inline arithmetic** — `let count = ${count} + 1`; pure `evaluateArithmetic()` handles integer expressions.
- **Dry-run mode** — `--dry-run` flag parses, lints, and renders a flow without executing.
- **Gate composition** — `any(gate1, gate2)` in `done when:` passes when at least one gate passes.
- **Cross-directory spawn** — `spawn "name" in "path"` launches child flows in a different directory.
- **Environment-aware gates** — auto-detect `go.mod` → `go_test_pass`, `Cargo.toml` → `cargo_test_pass`, `pyproject.toml` → `pytest_pass`.
- **Capture tag nonce** — per-session UUID4 nonce prevents capture-injection attacks.
- **State file SHA-256 checksum** — integrity verification on every load; two-generation backups.
- **Atomic state writes** — write-tmp-then-rename pattern prevents partial-write corruption.
- **Gate command timeout** — 60 s default, configurable via environment variable.
- **Command audit trail** — append-only `.prompt-language/audit.jsonl` logs every command execution.
- **Flow heartbeat summary** — compact status injected on pre-compact for compaction resilience.
- **Error boundary** — uncaught runtime errors transition the flow to `failed` status with reason.
- **Unresolved variable lint** — warns on `${var}` references with no matching variable; "did you mean?" suggestions via Levenshtein distance.
- **Infinite loop lint** — warns when a `while`/`until` body contains no `run` node.
- **List variable display** — renders as `[3 items: "a", "b", "c"]`; selective rendering hides internal auto-vars.
- **Skip context for completed/failed flows** — saves 200–1000 tokens per turn.
- **Gate stdout diagnostics** — gate results include stdout; stderr truncation increased to 2000 chars.
- **Capture failure diagnostics** — explains why capture failed when the nonce tag is absent.
- **Flow completion banner** — stop hook renders `[PL] Flow completed/failed: …` to stderr.
- **Gate status in stop hook** — block reason includes per-gate pass/fail/pending count.
- **`/flow-validate` skill** — runs `lintFlow` + `flowComplexityScore` on the active flow.
- **`--help` / `--version` CLI flags** — `npx @45ck/prompt-language --version` prints the installed version.
- **26 automated smoke tests** — full end-to-end coverage including ask, arithmetic, continue, and multi-var interpolation.

### Fixed

- **Unresolved variable injection** (MAJOR defect) — variables without a value are no longer passed to the shell; lint warns instead.
- **State resilience** — structural validation on load; stale `.prompt-language/` directories are cleaned up automatically.
- **Advisory file locking** — prevents `EBUSY` on concurrent hook invocations.
- Dead code removed: `resolver.ts`, `pauseFlow`/`resumeFlow` (never wired to any hook).

### Docs

- `docs/dsl-cheatsheet.md` — single-page quick reference for all DSL primitives.
- `docs/examples/foreach-files.md` — foreach recipe for iterating over file lists.
- `docs/guide.md` — abort/cancel escape hatch section; `ask` keyword walkthrough.
- `docs/dsl-reference.md` — `ask` keyword reference with `grounded-by` examples.

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
- **198 A/B comparative evaluation hypotheses** across 27 categories (v2: H56-H155, v3: H156-H255).
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
