# Project Rules

## Quick reference

Quality gate: `npm run ci` then `npm run eval:smoke` (run **both** before claiming work complete).

## Tests

Run `npm run test` or `npm run test:watch` for feedback. Run `npm run test:coverage` before opening a PR.

## Architecture

Domain-driven design with four layers:

```
src/domain/          Pure types and functions. Zero external deps.
src/application/     Use cases, port interfaces.
src/infrastructure/  Adapters implementing ports.
src/presentation/    Hook entry points.
```

Dependency flow is strictly inward. Domain never imports from other layers.

## Rules

- Domain code must have zero external dependencies.
- Use `type` imports for type-only symbols.
- No `eslint-disable` comments.
- No weakening of ESLint, Prettier, TypeScript, Vitest, or dependency-cruiser rules.
- All node creation goes through factory functions in domain.
- SessionState is immutable; transitions return new objects.

## Naming conventions

- Use cases: `verb-noun.ts` (e.g., `parse-flow.ts`, `advance-step.ts`)
- Adapters: `noun-adapter.ts` (e.g., `file-state-adapter.ts`)
- Ports: `noun-port.ts` (e.g., `state-port.ts`)
- Tests: `*.test.ts` colocated with source

## DSL primitives

Nine node kinds: `prompt`, `run`, `while`, `until`, `retry`, `if`, `try`, `foreach`, plus `let`/`var` for variable storage.

### let/var nodes

`let` and `var` are aliases. Three source types:

- `let x = "literal"` — stores a string value
- `let x = prompt "text"` — stores the prompt text as context
- `let x = run "cmd"` — executes command, stores stdout

List variables (stored as JSON array strings):

- `let x = []` — initializes an empty list
- `let x += "val"` — appends literal to list (auto-creates array if needed)
- `let x += run "cmd"` — appends command stdout to list
- `let x += prompt "text"` — appends captured response to list

Auto-variable: `${x_length}` is set on every list modification. Lists integrate with `foreach` via `splitIterable()` which parses JSON arrays as highest priority.

Variables are interpolated via `${varName}` in prompt/run text. Unknown variables are left as-is. `let`/`var`, `run` (with command runner), and `prompt` nodes auto-advance (no agent interaction).

### Built-in variables (auto-set after `run:` and `let x = run`)

- `last_exit_code` — numeric exit code
- `command_failed` — boolean, true when exit code !== 0
- `command_succeeded` — boolean, true when exit code === 0
- `last_stdout` — stdout (truncated at 2000 chars)
- `last_stderr` — stderr (truncated at 2000 chars)

### Control-flow evaluation

- `while`/`until`: conditions resolve via variable lookup first, then `resolveBuiltinCommand()` + command execution
- `retry`: always enters body; re-loops when `command_failed === true` and iteration < max
- `if/else`: evaluates condition, enters then-branch or else-branch (or skips)
- `try/catch`: always enters body; on `run` failure, jumps to catch body if present

### Security note

`interpolate()` performs raw substitution — use `shellInterpolate()` for `run:` commands. It wraps substituted values in single-quotes to prevent shell injection.

Key implementation files:

- `src/domain/flow-node.ts` — `LetNode`, `LetSource`, `createLetNode()`
- `src/domain/list-variable.ts` — pure `initEmptyList()`, `appendToList()`, `listLength()` for list variables
- `src/domain/interpolate.ts` — pure `interpolate(template, variables)` + `shellInterpolate()` for commands
- `src/domain/evaluate-condition.ts` — pure condition evaluation against variable state
- `src/domain/format-error.ts` — safe error-to-string with stack trace preservation
- `src/domain/render-flow.ts` — renders let nodes with `[= value]` annotation (`var` renders as `let` — they are aliases)
- `src/application/parse-flow.ts` — `parseLetLine()` handles let/var parsing
- `src/application/inject-context.ts` — `autoAdvanceNodes()` + control-flow + interpolation
- `src/application/evaluate-completion.ts` — gate evaluation with `resolveBuiltinCommand()` for builtin predicates

## Plugin installation

One-command install: `npx @45ck/prompt-language`

The CLI (`bin/cli.mjs`) copies plugin files to `~/.claude/plugins/local/prompt-language/`, generates a marketplace catalog, registers it in `extraKnownMarketplaces`, and enables the plugin. No `--plugin-dir` flag needed after install.

Key constraints discovered during testing:

- `plugin.json` `author` field must be an object (`{"name":"..."}`) not a string.
- `marketplace.json` must follow the catalog schema with `owner` (object) and `plugins` (array).
- The marketplace directory must be the parent of the plugin directory (not the plugin dir itself). Source paths in the catalog use `"./prompt-language"`.
- DSL regexes (`FLOW_BLOCK_RE`, `extractFlowBlock`) must allow optional leading whitespace (`^\s*flow:`) since users may indent their input.

## Smoke testing (mandatory — never skip)

Unit tests and CI are necessary but **not sufficient**. Smoke tests are **required** before claiming any work complete. Do not ask the user whether to run them — just run them. Unit tests use mocks and in-memory stores; smoke tests prove the plugin actually works end-to-end through Claude's real agent loop.

### Automated smoke tests

```bash
npm run eval:smoke        # full suite (10 tests, ~4 min)
npm run eval:smoke:quick  # fast subset without gate test (~2 min)
```

The automated script (`scripts/eval/smoke-test.mjs`) builds, installs the plugin, and runs 10 live `claude -p` tests in temp directories:

- **A: Context file relay** — two prompts, second reads file created by first
- **B: Context recall** — second prompt recalls a code from the first
- **C: Variable interpolation** — let/var resolve and interpolate into prompt text
- **D: Gate evaluation** — `done when: tests_pass` blocks until app.js is fixed
- **E: Run auto-execution** — `run:` node auto-executes and creates a file
- **F: Foreach iteration** — `foreach item in "a b c"` creates per-item files
- **G: Let-prompt capture** — `let x = prompt` captures Claude's response into a variable
- **H: If/else branching** — `if command_succeeded` takes the correct branch
- **I: Try/catch handling** — `try` body failure triggers `catch` body execution
- **K: Variable chain** — `let x = run` + `if` + `${x}` interpolation pipeline

### When to smoke test

Always. Specifically:

- After **any** change to `inject-context.ts`, `parse-flow.ts`, `evaluate-completion.ts`, or hook files
- After **any** change to node advancement, state transitions, or gate evaluation
- After **any** new DSL primitive or syntax change
- Before **any** PR that touches application or presentation layers
- After completing a feature or fix — run `npm run eval:smoke` before reporting done

### Manual smoke tests

For one-off validation or debugging, run individual tests from a temp directory:

```bash
npm run build && node bin/cli.mjs install
mkdir -p /tmp/pl-test && cd /tmp/pl-test
rm -rf .prompt-language  # clean state between tests
```

#### Variable + prompt advancement

```bash
cd /tmp/pl-test && rm -rf .prompt-language
claude -p --dangerously-skip-permissions "Goal: test let/var

flow:
  var greeting = \"hello world\"
  let ver = run \"node -v\"
  prompt: Say the greeting: \${greeting}. Node version is \${ver}."
```

#### Gate evaluation (done when)

```bash
cd /tmp/pl-test && rm -rf .prompt-language
echo 'process.exit(1)' > app.js
claude -p --dangerously-skip-permissions "Goal: fix app

flow:
  prompt: Fix app.js so it exits 0
  run: node app.js

done when:
  tests_pass"
```

#### Control flow (retry, if)

```bash
cd /tmp/pl-test && rm -rf .prompt-language
claude -p --dangerously-skip-permissions "Goal: fix app.js

flow:
  retry max 3
    run: node app.js
    if command_failed
      prompt: Fix the error.
    end
  end

done when:
  tests_pass"
```

Note: `command_succeeded`/`command_failed` work as runtime variables (auto-set after each `run:` node) but are **not yet implemented as gate predicates** for `done when:`. Use `tests_pass` or `file_exists <path>` for gates.

## State file

Runtime state lives in `.prompt-language/session-state.json`. Never hard-code paths; use the infrastructure adapter.

## CI

Full pipeline: `npm run ci`

This runs: typecheck, lint, format check, spell check, dependency cruiser, knip, build, test with coverage, e2e eval, and audit.
