# Troubleshooting

Common issues and how to resolve them.

## Flow not advancing

**Symptom**: Claude keeps receiving the same step, or the flow seems stuck.

**Diagnosis**: Check the session state file:

```bash
cat .prompt-language/session-state.json | head -50
```

Look for `currentNodePath` (which node is active), `status` (should be `"active"`), and `nodeProgress` (iteration counts for loops).

**Common causes**:

- A `run:` command is failing silently. Check `last_exit_code` and `last_stderr` in the variables section.
- A `let x = prompt` capture is stuck in phase 1 — Claude didn't write the capture file to `.prompt-language/vars/`. The plugin retries up to 3 times, then sets the variable to empty string and continues.
- A loop hit its `max` iteration limit. The loop exits and the flow continues to the next step, but if a gate checks the same condition, the agent will be sent back.

**Fix**: Use `/flow:reset` to clear all state and start over.

## Gates not passing

**Symptom**: Claude keeps working but the gate never lets it stop.

**Diagnosis**: Run the gate command manually to see its output:

```bash
npm test          # for tests_pass
npm run lint      # for lint_pass
git diff --quiet  # for diff_nonempty (exit 0 = no diff, exit 1 = diff exists)
```

**Common causes**:

- Flaky tests that pass sometimes and fail others. The gate runs the command fresh each time Claude tries to stop, so intermittent failures will block completion.
- The gate predicate is inverted from what you expect. `tests_fail` passes when tests _fail_ (exit non-zero). `diff_nonempty` passes when there _are_ changes.
- A custom gate command has a typo or isn't installed. Run it manually to verify.

**Fix**: If a gate is genuinely unsatisfiable (e.g., flaky test you can't fix), use `/flow:reset` to abandon the flow.

## Gates not running at all

**Symptom**: Claude stops without running the gate commands. The `done when:` block is ignored.

**Diagnosis**: Check if the state file exists and is valid JSON:

```bash
cat .prompt-language/session-state.json
```

**Common causes**:

- The state file is corrupted or contains invalid JSON. The plugin fails open for safety — if it can't read the state, it allows Claude to stop without gate enforcement.
- The prompt wasn't parsed as DSL. The `done when:` syntax requires the exact format — `done when:` on its own line, followed by indented predicates.
- The plugin isn't installed. Run `npx @45ck/prompt-language status` to check.

**Fix**: Delete `.prompt-language/` and re-submit your prompt to create a fresh session.

## Variable not resolving

**Symptom**: `${varName}` appears literally in prompts or commands instead of being replaced.

**Diagnosis**: Check the variables section in the rendered flow (shown at the top of Claude's context on each turn) or in the state file:

```bash
cat .prompt-language/session-state.json | grep -A 20 '"variables"'
```

**Common causes**:

- Typo in the variable name. Unknown `${vars}` pass through silently — no error is raised.
- The variable hasn't been set yet. Variables from `let x = run` are set when the `let` node executes. If the flow hasn't reached that node, the variable doesn't exist.
- The `let x = prompt` capture failed. If Claude didn't write the capture file, the variable is set to empty string (not left unset). Check `.prompt-language/vars/` for the capture file.

**Default value syntax**: Use `${varName:-fallback}` to provide a default when a variable is unset:

```
prompt: Using version ${ver:-unknown}.
```

## `let x = prompt` not capturing

**Symptom**: A `let x = prompt` node shows `[awaiting response...]` and never advances.

**How it works**: `let x = prompt` uses a two-phase capture:

1. Phase 1: The plugin tells Claude to answer the question AND write its response to `.prompt-language/vars/{varName}`.
2. Phase 2: The plugin reads the file and stores the value.

**Common causes**:

- Claude answered the question but didn't write the file. The plugin retries up to 3 times, then falls back to empty string.
- The working directory changed between phases, so the plugin can't find the file.

> **Warning**: When capture fails, the variable is set to `""` (empty string) and the flow continues. If `${x}` is later interpolated into a `run:` command, the command will receive an empty argument. Design flows to handle this: use `${x:-default}` or add an `if` check before using captured values in commands.

## Long sequential flows hanging

**Known issue**: Flows with 10+ sequential auto-advancing nodes (e.g., 5 `let` + 5 `prompt` nodes in a row) may hang indefinitely.

**Workaround**: Keep sequential chains of auto-advancing nodes (`let`, `var`, `run`) under 8 nodes. Break long sequences with `prompt:` nodes that require agent interaction, or split into multiple shorter flows.

**Status**: Under investigation.

## Output truncation

`last_stdout` and `last_stderr` are truncated at 2,000 characters. If a test failure message is beyond the truncation point, Claude won't see it.

**Workaround**: Pipe command output to capture only the relevant portion:

```
let errors = run "npm test 2>&1 | tail -30"
```

## Resetting state

To clear all flow state and start fresh:

- **Slash command**: `/flow:reset`
- **Manual**: `rm -rf .prompt-language/`

Both approaches delete the session state file. The next prompt with `flow:` or `done when:` creates a new session.

## Spawned process issues

**Symptom**: `await` hangs indefinitely or the flow never completes after spawning children.

**How spawn works**: Each `spawn` block launches a separate `claude -p` process with its own state directory (`.prompt-language-{name}/`). The parent flow polls the child's state file to detect completion. `await` blocks until the child's status is `completed` or `failed`.

**Common causes**:

- The child process crashed or was killed before writing its final state. The parent sees the child as perpetually "running."
- The child's flow is stuck (e.g., a gate that never passes, a loop that never exits). The parent will wait indefinitely.
- Too many spawned children exhausted system resources.
- Name collision: spawning two children with the same name orphans the first child process.

**Diagnosis**: Check for child state directories:

```bash
ls -la .prompt-language-*/session-state.json
```

If a child's state file doesn't exist, the child never started or crashed early. If the state shows `"status": "active"`, the child is still running or stuck.

**Fix**:

- Kill orphan child processes: `ps aux | grep 'claude -p'`
- Clean up child state directories: `rm -rf .prompt-language-*/`
- Use `/flow:reset` to clear the parent flow and start over.

**Prevention**: Keep spawn count low (2-4 children). Ensure child flows have bounded loops (`max N`) to prevent infinite execution.

## Aborting a flow mid-execution

If a flow is stuck or you want to stop it without completing all gates, you can cancel it using escape hatch phrases. Type any of these as your next message:

- `abort flow`
- `cancel flow`
- `stop flow`
- `reset flow`

The plugin detects these phrases in your prompt and immediately sets the flow status to `cancelled`, clearing all state. Claude will confirm the cancellation and stop enforcing the flow.

Alternatively, use the `/flow:reset` slash command to clear all flow state and start fresh.

**Note**: Escape hatch phrases are matched case-insensitively and can appear anywhere in the prompt (e.g., "please abort flow now" works). They only take effect when a flow is actively running (`status: "active"`).

## Checking plugin status

```bash
npx @45ck/prompt-language status   # verify installation
```

If the plugin isn't installed or hooks aren't registered, `done when:` blocks will be ignored.

## Getting help

If you hit an issue not covered here, [open a GitHub issue](https://github.com/45ck/prompt-language/issues) with:

1. The prompt you submitted (with `flow:` and `done when:` blocks)
2. The contents of `.prompt-language/session-state.json`
3. The error output or unexpected behavior
