# Project Rules

## Quick reference

Quality gate: `npm run ci` (run before claiming work complete).

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

Seven node kinds: `prompt`, `run`, `while`, `until`, `retry`, `if`, `try`, plus `let`/`var` for variable storage.

### let/var nodes

`let` and `var` are aliases. Three source types:

- `let x = "literal"` — stores a string value
- `let x = prompt "text"` — stores the prompt text as context
- `let x = run "cmd"` — executes command, stores stdout

Variables are interpolated via `${varName}` in prompt/run text. Unknown variables are left as-is. All let/var nodes auto-advance (no agent interaction).

Key implementation files:

- `src/domain/flow-node.ts` — `LetNode`, `LetSource`, `createLetNode()`
- `src/domain/interpolate.ts` — pure `interpolate(template, variables)` function
- `src/domain/render-flow.ts` — renders let nodes with `[= value]` annotation
- `src/application/parse-flow.ts` — `parseLetLine()` handles let/var parsing
- `src/application/inject-context.ts` — `autoAdvanceLetNodes()` + interpolation

## Plugin installation

One-command install: `npx @45ck/prompt-language`

The CLI (`bin/cli.mjs`) copies plugin files to `~/.claude/plugins/local/prompt-language/`, generates a marketplace catalog, registers it in `extraKnownMarketplaces`, and enables the plugin. No `--plugin-dir` flag needed after install.

Key constraints discovered during testing:

- `plugin.json` `author` field must be an object (`{"name":"..."}`) not a string.
- `marketplace.json` must follow the catalog schema with `owner` (object) and `plugins` (array).
- The marketplace directory must be the parent of the plugin directory (not the plugin dir itself). Source paths in the catalog use `"./prompt-language"`.
- DSL regexes (`FLOW_BLOCK_RE`, `extractFlowBlock`) must allow optional leading whitespace (`^\s*flow:`) since users may indent their input.

To validate plugin installation end-to-end:

```bash
npm run build && node bin/cli.mjs install
```

Then in a **separate test directory** (not the prompt-language repo), run:

```bash
mkdir -p /tmp/pl-test && cd /tmp/pl-test
claude -p --dangerously-skip-permissions "Goal: test let/var

flow:
  var greeting = \"hello world\"
  let ver = run \"node -v\"
  prompt: Say the greeting: \${greeting}. Node version is \${ver}."
```

What to verify in the output:
- Flow context header (`[prompt-language] Flow: test let/var | Status: active`)
- Variables auto-advanced with resolved annotations (`[= hello world]`, `[= v22.x.x]`)
- `prompt:` node is `<-- current` (path advanced past let nodes)
- Claude's response references the interpolated values

To validate existing primitives (retry, if, done-when):

```bash
cd /tmp/pl-test
claude -p --dangerously-skip-permissions "Goal: fix app.js

flow:
  retry max 3
    run: node app.js
    if command_failed
      prompt: Fix the error.
    end
  end

done when:
  command_succeeded"
```

## State file

Runtime state lives in `.prompt-language/session-state.json`. Never hard-code paths; use the infrastructure adapter.

## CI

Full pipeline: `npm run ci`

This runs: typecheck, lint, format check, spell check, dependency cruiser, knip, build, test with coverage, e2e eval, and audit.
