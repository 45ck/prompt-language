# CLI Reference

The `npx @45ck/prompt-language` CLI manages plugin installation and provides development utilities.

## Flags

### --help

Print usage and available commands.

```bash
npx @45ck/prompt-language --help
```

### --version

Print the installed plugin version.

```bash
npx @45ck/prompt-language --version
# prompt-language v0.3.0
```

## Commands

### install (default)

Install the plugin into Claude Code. This is the default command — running `npx @45ck/prompt-language` without arguments does the same thing.

```bash
npx @45ck/prompt-language
npx @45ck/prompt-language install
```

What it does:

1. Copies plugin files (dist, hooks, skills, bin) to `~/.claude/plugins/local/prompt-language/`
2. Generates a marketplace catalog (`marketplace.json`)
3. Registers the marketplace in Claude Code settings
4. Enables the plugin
5. Configures the status line (if not already configured)

### status

Check whether the plugin is installed and configured correctly.

```bash
npx @45ck/prompt-language status
```

Example output:

```
prompt-language v0.3.0
  Installed:    yes (~/.claude/plugins/local/prompt-language)
  Registered:   yes
  Marketplace:  yes
  Enabled:      yes
```

### uninstall

Remove the plugin from Claude Code.

```bash
npx @45ck/prompt-language uninstall
```

Removes plugin files, marketplace registration, and settings entries. Also removes the status line configuration if it was set by the plugin.

### init

Scaffold a starter flow in the current directory.

```bash
npx @45ck/prompt-language init
```

What it does:

1. Creates `.prompt-language/` directory with `.gitignore` (excludes session state files)
2. Creates `.prompt-language/vars/` directory for variable capture
3. Detects project type from `package.json` scripts
4. Generates `example.flow` with appropriate gates (`tests_pass`, `lint_pass`) based on available scripts

Run the generated flow:

```bash
claude -p "$(cat example.flow)"
```

### run

Execute a `.flow` file or inline flow text through Claude, Codex, or OpenCode.

```bash
npx @45ck/prompt-language run --file my.flow
npx @45ck/prompt-language run my.flow
cat my.flow | npx @45ck/prompt-language run
npx @45ck/prompt-language run --runner codex my.flow
npx @45ck/prompt-language run --runner opencode --model opencode/gpt-5-nano my.flow
```

Notes:

1. `--runner claude` is the default.
2. `--runner codex` and `--runner opencode` both use the headless flow runner rather than Claude's interactive hook loop.
3. When `--runner codex` is selected without an explicit `--model`, prompt-language defaults to `gpt-5.2` on this workstation because the ambient Codex default may fall back to a rate-limited Spark profile.
4. OpenCode models use the `provider/model` form, for example `opencode/gpt-5-nano`.
5. On this workstation, prefer hosted harness models for headless runner paths; do not install local models here just to exercise `run`.
6. As of April 10, 2026, `opencode/gpt-5-nano` passed smoke test `A` through the same OpenCode headless path, which confirms the runner surface can work when the model is tool-capable.
7. The bounded Gemma comparison remains documented in [OpenCode Gemma 4 Plan](../evaluation/opencode-gemma-plan.md); it is an evaluation note, not the default setup path.

### ci

Run a flow in headless mode for CI or automation.

```bash
npx @45ck/prompt-language ci --file my.flow
npx @45ck/prompt-language ci --runner codex my.flow
npx @45ck/prompt-language ci --runner opencode --model opencode/gpt-5-nano my.flow
```

This is the same headless runner path used by `run --runner codex|opencode`, so prompt quality and tool-use behavior depend on the selected model. On this workstation, `ci --runner codex` defaults to `gpt-5.2` when `--model` is omitted.

### eval

Run a checked-in JSONL eval dataset and emit a machine-readable report.

```bash
npx @45ck/prompt-language eval --dataset experiments/eval/datasets/e1-repeated-failures.jsonl
npx @45ck/prompt-language eval --harness codex --candidate vanilla --output experiments/results/e1-repeated-failure/v1/codex-vanilla.json --dataset experiments/eval/datasets/e1-repeated-failures.jsonl
npx @45ck/prompt-language eval --harness codex --candidate gated --baseline experiments/results/e1-repeated-failure/v1/codex-vanilla.json --output experiments/results/e1-repeated-failure/v1/codex-gated.json --dataset experiments/eval/datasets/e1-repeated-failures.jsonl
```

Notes:

1. `--candidate vanilla` runs the checked-in prompt or flow exactly as written.
2. `--candidate gated` wraps prompt cases as a one-step flow and appends the dataset case's `gates` as real `done when:` checks.
3. `--harness` accepts `claude`, `codex`, or `opencode`.
4. `--baseline` points at a locked JSON report to compare against. `--baseline-report` remains an alias.
5. `--out` is accepted as a short alias for `--output`.
6. Codex-backed eval runs default to `gpt-5.2` when no `--model` is provided.
7. `--baseline` must point at a locked report for the same dataset bank; the runner rejects mismatched datasets and case sets.
8. If you do not pass `--output`, the CLI writes a timestamped report under `.prompt-language/eval-reports/`.
9. The seeded dataset bank and locked-results layout are documented in [Dataset Bank](../evaluation/dataset-bank.md).
10. On this workstation, use hosted harnesses for this command; do not install local models just to populate eval artifacts.

### list

Recursively list `.flow` files under the current directory.

```bash
npx @45ck/prompt-language list
```

### validate

Parse, lint, score, and render a flow without executing it.

```bash
npx @45ck/prompt-language validate --file my.flow
npx @45ck/prompt-language validate my.flow
cat my.flow | npx @45ck/prompt-language validate
```

Outputs the rendered flow with lint warnings but takes no actions and starts no gates.

### demo

Print an annotated example flow to stdout.

```bash
npx @45ck/prompt-language demo
```

Shows a complete flow with comments explaining each section — useful as a quick syntax reference.

### statusline

Configure the Claude Code status line to show flow progress.

```bash
npx @45ck/prompt-language statusline
```

Sets up `~/.claude/settings.json` to run the status line script, which displays current flow status, active node, loop progress, and gate results in Claude Code's footer.

### watch

Launch a live TUI monitor that displays flow execution in real time.

```bash
npx @45ck/prompt-language watch
```

Shows a continuously-updating view of the flow state, including the current node, variable values, and gate status. Useful for watching long-running flows.

## Slash commands

These are available inside Claude Code sessions when the plugin is installed:

| Command          | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| `/fix-and-test`  | Retry loop: fix failing tests, re-run, repeat up to 5 times. Gate: `tests_pass`  |
| `/tdd`           | Red-green-refactor cycle. Gate: `tests_pass` + `lint_pass`                       |
| `/refactor`      | Incremental refactoring with test verification. Gate: `tests_pass` + `lint_pass` |
| `/deploy-check`  | Lint, test, build pipeline. Gate: `tests_pass` + `lint_pass` + `file_exists`     |
| `/flow:status`   | Show current flow state, active node, and gate results                           |
| `/flow:reset`    | Reset flow and clear all session state                                           |
| `/flow-validate` | Validate flow syntax: run `lintFlow` and show complexity score without executing |
| `/flow-audit`    | Query `.prompt-language/audit.jsonl` — supports `--failures`, `--slow`, `--type` |
| `/flow-vars`     | Inspect all session variables with full values, types, and list expansion        |
