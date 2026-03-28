# Runtime Variables

These variables are updated automatically after command execution and are available to conditions, prompts, and later steps.

## Built-in variables

| Variable            | Type    | Meaning                              |
| ------------------- | ------- | ------------------------------------ |
| `last_exit_code`    | number  | Exit code of the last command        |
| `command_failed`    | boolean | True when the last command failed    |
| `command_succeeded` | boolean | True when the last command succeeded |
| `last_stdout`       | string  | Captured stdout, truncated           |
| `last_stderr`       | string  | Captured stderr, truncated           |

## Resolution model

- Flow conditions prefer current runtime variables when available.
- Gates re-run their command instead of trusting a same-named variable.

## Related

- [run](run.md)
- [Gates](gates.md)
- [if](if.md)
