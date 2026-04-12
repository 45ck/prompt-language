# Trace Summary

Run: `20260412-0916-a03-core-proof-prebootstrapped`

## Lane Traces

### `pl-multiagent`

Primary traces:

- `pl-state/session-state.json`
- `pl-state/audit.jsonl`
- `pl-multiagent/lint.log`
- `pl-multiagent/typecheck.log`
- `pl-multiagent/test.log`

What they show:

- the prompt-language lane reached `status: completed` and passed all required gates
- the authoritative evidence is the persisted state plus audit trail rather than the redirected
  top-level report files
- the lane had launcher/path/runtime-timeout friction before the successful rerun

### `codex-alone`

Primary traces:

- `codex-alone/events.jsonl`
- `codex-alone/stderr.log`
- `codex-alone/last-message.txt`
- `codex-alone/lint.log`
- `codex-alone/typecheck.log`
- `codex-alone/test.log`

What they show:

- the direct Codex lane also completed the bounded CRM core slice and passed verification
- the raw event stream shows an intermediate typecheck miss that Codex fixed before the final pass
- the lane produced cleaner first-pass evidence than prompt-language

## Comparative Read

- the traces support product-level parity for the bounded CRM core slice
- the traces also support the claim that direct Codex had better operational simplicity while
  prompt-language had better auditable state and gate evidence

## Confounds

- the prompt-language lane needed rerun-level intervention on Windows before the valid trace set was
  produced
- because of that, A03 does not yet prove prompt-language is better for raw throughput
