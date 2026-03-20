# @45ck/prompt-language

A prompt-shaped workflow language that compiles into enforced agent execution. Loops, conditionals, retries, and completion gates so the agent cannot stop early or skip steps.

## What it does

Claude Code stops when it thinks the task is done. Sometimes that is too early. prompt-language intercepts the agent's lifecycle through hooks and forces it to follow a structured control-flow program until all steps and gates pass.

The plugin provides:

- A small DSL for expressing control-flow programs (while, until, retry, if, try/catch, prompt, run).
- Natural language detection that converts plain English instructions into the DSL automatically.
- Three hooks (UserPromptSubmit, Stop, TaskCompleted) that form the enforcement engine.
- Completion gates that block the agent from finishing until verifiable conditions hold.
- Built-in resolvers that map command exit codes and outputs to boolean state variables.

## Install

### One command (recommended)

```bash
npx @45ck/prompt-language
```

This downloads the package, copies the plugin files to `~/.claude/plugins/local/prompt-language/`, and enables it in your Claude Code settings. Done.

```bash
# Check installation status
npx @45ck/prompt-language status

# Uninstall
npx @45ck/prompt-language uninstall
```

### Claude Code plugin manager

```bash
claude plugin marketplace add 45ck/prompt-language
claude plugin install prompt-language
```

### Install script (Unix/macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/45ck/prompt-language/main/scripts/install.sh | bash
```

Or after cloning the repo:

```bash
./scripts/install.sh
```

## Quick start

Tell Claude what to do using natural language with control-flow intent:

```
Keep running the tests and fixing failures until they all pass. Try up to 5 times.
```

prompt-language detects the control-flow structure and compiles it into an execution plan:

```
Goal: fix failing tests

flow:
  retry max 5
    run: npm test
    if tests_fail
      prompt: Fix the failing tests based on the error output above.
    end
  end

done when:
  tests_pass
```

The agent then executes step by step, unable to stop until the gate passes or the retry limit is hit.

## DSL reference

Six primitives plus try/catch compose into arbitrary control-flow programs. Blocks use indentation with explicit `end` keywords.

### prompt

Inject text as the agent's next instruction.

```
prompt: Refactor the auth module to use dependency injection.
```

### run

Execute a shell command and capture the result.

```
run: npm test
```

After every `run`, built-in resolvers update state variables automatically.

### while

Loop while a condition is true.

```
while tests_fail max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

### until

Loop until a condition becomes true.

```
until tests_pass max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

### retry

Retry a block up to N times on failure.

```
retry max 3
  run: npm run build
end
```

### if

Conditional branching.

```
if lint_fail
  prompt: Fix the lint errors.
  run: npm run lint
else
  prompt: Lint passed. Move on.
end
```

### try/catch

Execute a block and catch failures.

```
try
  run: npm run deploy
catch command_failed
  prompt: Deploy failed. Roll back and investigate.
end
```

### done when

Completion gates block the agent from finishing until the predicate holds. Listed after the `done when:` section.

```
done when:
  tests_pass
  lint_pass
```

## Natural language detection

You do not need to write DSL directly. Type whatever you want — natural language, pseudo-code, rough ideas — and prompt-language will detect control-flow intent and ask the agent to convert it into valid DSL for you.

When your prompt contains words like "until", "retry", "loop", "keep going", "don't stop", "on failure", etc., the plugin injects a meta-prompt with the full DSL reference. The agent reads your intent, writes the correct DSL, and on the next turn the plugin parses and executes it.

Examples of what you can type:

- "Keep fixing until all tests pass"
- "Retry the build 3 times"
- "Don't stop until lint passes"
- "Run tests, if they fail fix the errors, loop until green"
- "Try deploying, on failure roll back and try again"
- Pseudo-code like "while tests broken: fix and rerun, max 5 attempts"

The agent handles the translation — no regex, no exact phrasing required.

## Hooks

Three hooks form the enforcement engine. They are registered in `hooks/hooks.json`.

### UserPromptSubmit

Fires when the user submits a prompt. The hook:

1. Parses the prompt for control-flow intent (DSL or natural language).
2. If detected, compiles a FlowSpec and creates a SessionState.
3. Writes `.prompt-language/session-state.json`.
4. Injects the first step as the agent's instruction.

### Stop

Fires when Claude tries to stop. The hook:

1. Reads the current session state.
2. If the flow is still active, blocks the stop and injects the next step.
3. If all nodes are complete and all gates pass, allows the stop.

### TaskCompleted

Fires when a task finishes. The hook:

1. Evaluates all completion gates.
2. If any gate fails, re-injects the flow to continue.
3. If all gates pass, marks the flow as completed.

## Built-in resolvers

After each `run` step, these variables are updated automatically:

| Variable            | Type    | Meaning                        |
| ------------------- | ------- | ------------------------------ |
| `last_exit_code`    | number  | Exit code of the last command  |
| `command_failed`    | boolean | True if last exit code != 0    |
| `command_succeeded` | boolean | True if last exit code == 0    |
| `tests_pass`        | boolean | True if test command succeeded |
| `tests_fail`        | boolean | True if test command failed    |
| `lint_pass`         | boolean | True if lint command succeeded |
| `lint_fail`         | boolean | True if lint command failed    |
| `file_exists`       | boolean | True if a checked file exists  |
| `diff_nonempty`     | boolean | True if git diff has output    |

Resolver priority: deterministic > parsed > inferred > human.

## State file

All runtime state is stored in `.prompt-language/session-state.json` in the project root. This file is the single source of truth for flow execution. It contains:

- The compiled FlowSpec (goal, nodes, gates, defaults)
- Current position in the node graph
- Loop iteration counts per node
- Variable values
- Gate results
- Flow status (active/completed/failed/cancelled)

## Skills

### /flow:run

Execute the current flow step, advance state, and inject context. This is the main execution loop.

```
/flow:run
```

### /flow:status

Show current flow execution progress. Read-only.

```
/flow:status
```

### /flow:reset

Abandon the current flow and delete session state.

```
/flow:reset
```

## Architecture

```
src/
  domain/           Pure types and logic. Zero external dependencies.
    flow-node.ts      Node types (while, until, retry, if, prompt, run, try)
    flow-spec.ts      FlowSpec, CompletionGate, FlowDefaults
    session-state.ts  SessionState, runtime transitions
    resolver.ts       Resolver types, built-in resolver names

  application/      Use cases and port interfaces.
    ports/            Abstract interfaces for I/O

  infrastructure/   Adapters implementing ports.
    adapters/         File I/O, command execution, condition evaluation

  presentation/     Entry points. Hook handlers.
    hooks/            user-prompt-submit.js, stop.js, task-completed.js

hooks/
  hooks.json        Hook registration for Claude Code

skills/
  flow-executor/    /flow:run skill
  flow-status/      /flow:status skill
  flow-reset/       /flow:reset skill
```

Dependency flow is strictly inward: presentation -> infrastructure -> application -> domain.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
