# Hooks Architecture

prompt-language enforces control-flow through three Claude Code hooks. Together they form a closed enforcement loop: the agent cannot start without a plan, cannot stop before the plan is finished, and cannot mark a task complete until all gates pass.

## Hook registration

Hooks are declared in `hooks/hooks.json` and run as Node.js scripts from the compiled `dist/presentation/hooks/` directory.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/presentation/hooks/user-prompt-submit.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/presentation/hooks/stop.js"
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/presentation/hooks/task-completed.js"
          }
        ]
      }
    ]
  }
}
```

## UserPromptSubmit

Fires when the user submits a prompt to Claude.

### Responsibilities

1. Receive the user's prompt text.
2. Attempt to parse it as DSL. If parsing fails, run natural language detection.
3. If control-flow intent is found, compile a FlowSpec.
4. Create a SessionState from the FlowSpec.
5. Write `.prompt-language/session-state.json`.
6. Return the first step as the agent's injected instruction.
7. If no control-flow intent is detected, pass through (no-op).

### Flow

```
User prompt
  -> Parse DSL
  -> (fail) Natural language detection
  -> (detected) Compile FlowSpec
  -> Create SessionState
  -> Write session-state.json
  -> Inject first step
```

### No-op case

If the prompt has no control-flow intent, the hook does nothing. Claude proceeds normally.

## Stop

Fires when Claude signals that it wants to stop working.

### Responsibilities

1. Check if `.prompt-language/session-state.json` exists.
2. If no active flow, allow the stop (no-op).
3. If a flow is active:
   a. Check if all nodes have been executed.
   b. Evaluate all completion gates.
   c. If nodes remain or any gate fails: block the stop, inject the next step.
   d. If all nodes are done and all gates pass: mark flow as completed, allow stop.

### Flow

```
Claude wants to stop
  -> Read session-state.json
  -> (no flow) Allow stop
  -> (flow active) Check nodes + gates
  -> (incomplete) Block stop, inject next step
  -> (all done) Mark completed, allow stop
```

### Blocking

When the Stop hook blocks, it returns the next step instruction. Claude must continue executing instead of stopping.

## TaskCompleted

Fires when a task is marked as done.

### Responsibilities

1. Check if `.prompt-language/session-state.json` exists.
2. If no active flow, allow completion (no-op).
3. If a flow is active:
   a. Run all gate verification commands (if specified).
   b. Evaluate all gate predicates.
   c. If any gate fails: re-inject the flow to continue.
   d. If all gates pass: mark flow as completed.

### Flow

```
Task marked complete
  -> Read session-state.json
  -> (no flow) Allow completion
  -> (flow active) Run gate commands
  -> Evaluate gate predicates
  -> (any fail) Re-inject flow
  -> (all pass) Mark completed
```

## Enforcement loop

The three hooks create a closed loop:

```
UserPromptSubmit: detect intent -> create flow -> inject first step
         |
         v
     Claude executes steps (via /flow:run or inline)
         |
         v
Stop: is the flow done? -> no: block, inject next step
                        -> yes: allow stop
         |
         v
TaskCompleted: do all gates pass? -> no: re-inject
                                  -> yes: complete
```

The agent cannot escape this loop until all nodes are executed and all gates pass, or the maximum iteration/attempt limits are reached.

## State management

All three hooks read and write `.prompt-language/session-state.json`. This file is the single source of truth. Hooks never hold state in memory across invocations -- they are stateless processes that operate on the state file.

## Spawned child state

Each `spawn` node launches an independent child `claude -p` process with its own state directory (`.prompt-language-{name}/`) and `session-state.json`. The parent's hooks poll these child state files during `await` advancement. Child processes run their own hook loop independently — they are full Claude sessions, not sub-routines of the parent. The `ProcessSpawner` port (`src/application/ports/process-spawner.ts`) abstracts child process creation and polling.

## Error handling

- If the state file is corrupted or unreadable, hooks log a warning and allow the operation (fail-open for safety).
- If a gate verification command fails, the gate is marked as failing.
- If max iterations or attempts are exceeded, the flow is marked as failed and the agent is allowed to stop.
