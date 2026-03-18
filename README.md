# @45ck/claude-flow

Control-flow enforcement plugin for Claude Code. Enforces loops, conditionals, retries, and completion gates so the agent cannot stop early or skip steps.

## What it does

Claude Code stops when it thinks the task is done. Sometimes that is too early. claude-flow intercepts the agent's lifecycle through hooks and forces it to follow a structured control-flow program until all steps and gates pass.

The plugin provides:

- A small DSL for expressing control-flow programs (while, until, retry, if, try/catch, prompt, run).
- Natural language detection that converts plain English instructions into the DSL automatically.
- Three hooks (UserPromptSubmit, Stop, TaskCompleted) that form the enforcement engine.
- Completion gates that block the agent from finishing until verifiable conditions hold.
- Built-in resolvers that map command exit codes and outputs to boolean state variables.

## Install

```
npm install @45ck/claude-flow
```

Or install as a Claude Code plugin directly.

## Quick start

Tell Claude what to do using natural language with control-flow intent:

```
Keep running the tests and fixing failures until they all pass. Try up to 5 times.
```

claude-flow detects the control-flow structure and compiles it into an execution plan:

```
retry(5) {
  run("npm test")
  if (tests_fail) {
    prompt("Fix the failing tests based on the error output above.")
  }
}
gate(tests_pass)
```

The agent then executes step by step, unable to stop until the gate passes or the retry limit is hit.

## DSL reference

Six primitives plus try/catch compose into arbitrary control-flow programs.

### prompt

Inject text as the agent's next instruction.

```
prompt("Refactor the auth module to use dependency injection.")
```

### run

Execute a shell command and capture the result.

```
run("npm test")
```

After every `run`, built-in resolvers update state variables automatically.

### while

Loop while a condition is true.

```
while (tests_fail, max=5) {
  prompt("Fix the failing tests.")
  run("npm test")
}
```

### until

Loop until a condition becomes true.

```
until (tests_pass, max=5) {
  prompt("Fix the failing tests.")
  run("npm test")
}
```

### retry

Retry a block up to N times on failure.

```
retry(3) {
  run("npm run build")
}
```

### if

Conditional branching.

```
if (lint_fail) {
  prompt("Fix the lint errors.")
  run("npm run lint")
} else {
  prompt("Lint passed. Move on.")
}
```

### try/catch

Execute a block and catch failures.

```
try {
  run("npm run deploy")
} catch (command_failed) {
  prompt("Deploy failed. Roll back and investigate.")
}
```

### gate

Completion gates block the agent from finishing until the predicate holds.

```
gate(tests_pass)
gate(lint_pass)
```

Gates can also specify a verification command:

```
gate(tests_pass, "npm test")
```

## Natural language detection

You do not need to write DSL directly. claude-flow detects control-flow intent in plain English and compiles it. Examples:

| Natural language                              | Detected structure                                   |
| --------------------------------------------- | ---------------------------------------------------- |
| "Keep fixing until tests pass"                | `until(tests_pass) { prompt(...); run("npm test") }` |
| "Try up to 3 times to build"                  | `retry(3) { run("npm run build") }`                  |
| "If lint fails, fix it"                       | `if(lint_fail) { prompt(...); run("npm run lint") }` |
| "Run tests, fix failures, repeat until green" | `until(tests_pass) { run("npm test"); prompt(...) }` |

## Hooks

Three hooks form the enforcement engine. They are registered in `hooks/hooks.json`.

### UserPromptSubmit

Fires when the user submits a prompt. The hook:

1. Parses the prompt for control-flow intent (DSL or natural language).
2. If detected, compiles a FlowSpec and creates a SessionState.
3. Writes `.claude-flow/session-state.json`.
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

All runtime state is stored in `.claude-flow/session-state.json` in the project root. This file is the single source of truth for flow execution. It contains:

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
