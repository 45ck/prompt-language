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

### --dry-run

Parse, lint, and render a flow without executing it. Useful for validating syntax before a live run.

```bash
claude -p --dry-run "Goal: test

flow:
  prompt: Hello
  run: npm test

done when:
  tests_pass"
```

Outputs the rendered flow with lint warnings but takes no actions and starts no gates.

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
