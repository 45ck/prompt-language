# Trace Summary

Run: `A02-crm-http-headless`

## Lane Traces

### `codex-plus-prompt-language`

Primary traces:

- `codex-plus-prompt-language/ci-stderr.log`
- `codex-plus-prompt-language/exit-code.txt`
- `codex-plus-prompt-language/ci-report.json`

What they show:

- the run failed on repeated `SessionState invariant violation` errors for
  `command_failed` / `command_succeeded`
- the wrapper then reported a missing `.factory-state/audit.jsonl`, which is secondary fallout from
  the earlier crash
- the top-level report file stayed empty, so stderr plus exit code are the authoritative traces

## Comparative Read

- this trace set explains why A02 cannot be used as evidence that prompt-language is worse at the
  product task itself

## Confounds

- there is no comparable product implementation trace because the run died in runtime plumbing
- this historical attempt has weaker evidence than the later repeatable runs
