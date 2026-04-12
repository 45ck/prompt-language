# Trace Summary

Run: `20260412-1047-a05-core-proof-sequential-patched`

## Lane Traces

### `pl-sequential`

Primary traces:

- `pl-state/session-state.json`
- `pl-state/audit.jsonl`
- `pl-sequential/manifest.json`

What they show:

- the prompt-language sequential lane completed successfully and passed all required gates
- the persisted state and audit trail are the authoritative evidence for this run
- the lane manifest records the closed verdict and points to the canonical outcome, postmortem, and
  scorecard artifacts

Secondary traces:

- `pl-sequential/ci-report.json`
- `pl-sequential/ci-stderr.log`

What they show:

- the top-level redirected report files remained empty after the earlier supervisory interruption, so
  they are context only and not authoritative evidence

## Comparative Read

- the traces show that the earlier A04 failure was a runtime/runner issue rather than an inability
  to express the bounded software-factory slice in prompt-language

## Confounds

- A05 does not include a same-day direct Codex rerun, so it proves prompt-language viability more
  strongly than prompt-language superiority
- top-level reporting cleanliness is still weaker than ideal even though the state-level evidence is
  strong
