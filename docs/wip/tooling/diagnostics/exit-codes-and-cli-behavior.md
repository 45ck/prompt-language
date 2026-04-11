# Exit Codes And CLI Behavior

## Exit codes

| Code | Meaning                                        |
| ---- | ---------------------------------------------- |
| `0`  | success                                        |
| `1`  | terminal unsuccessful flow outcome             |
| `2`  | blocked by parse/profile/preflight diagnostics |
| `3`  | runtime/internal failure                       |

## CLI rules

### `validate`

`validate` should:

- parse the flow
- lint and score as it does today
- optionally evaluate compatibility when `--runner` / `--mode` are provided
- emit a `Report` in `--json` mode

`validate` should never return exit code `1`. It does not execute the flow. It either succeeds (`0`) or is blocked (`2`).

### `run`

`run` should:

- perform preflight/profile checks
- execute the flow
- classify runtime problems separately from normal outcomes
- emit `Report` in `--json` mode on the shipped headless runner paths

`run` returns:

- `0` on success
- `1` if execution completes but the terminal outcome is unsuccessful
- `2` if blocked before execution
- `3` for runtime/internal failure

Current shipped boundary:

- `run --runner codex|opencode|ollama --json` emits `{ status, diagnostics, outcomes, reason? }`
- `run --runner claude --json` is still unsupported because the native Claude interactive path does not return machine-readable completion state

### `ci`

`ci` should follow `run` exit-code semantics exactly so local CLI and automation behavior stay aligned.

Current shipped boundary:

- `ci --runner codex|opencode|ollama --json` emits the same `{ status, diagnostics, outcomes, reason? }` envelope
- blocked preflight still exits `2`, but the blocked report is emitted as JSON when `--json` is set
- the native Claude path still does not expose machine-readable completion state

## Human-readable output guidance

Each surfaced diagnostic should include:

- code
- severity
- short summary
- one actionable fix

Example:

```text
PLC-004  error
approve is unsupported for runner=opencode mode=headless

Fix:
Use an interactive profile, or replace approve with a policy/pre-approval step.
```

Outcomes should be rendered differently from diagnostics because they represent valid execution paths rather than runtime failures.
