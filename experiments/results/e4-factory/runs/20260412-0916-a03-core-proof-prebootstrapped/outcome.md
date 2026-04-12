# Outcome

Run: `20260412-0916-a03-core-proof-prebootstrapped`

Goal: compare a bounded CRM core slice built with `prompt-language` orchestration versus direct Codex in the same repo, with the same model family and the same verification contract.

## Prompt-Language (`pl-multiagent`)

Result: success with host/runtime caveats.

Evidence:

- `pl-state/session-state.json` records `status: completed`
- `pl-state/audit.jsonl` shows all required files created
- `pl-state/session-state.json` records passing completion gates for:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
- direct post-run verification logs are stored in:
  - `pl-multiagent/lint.log`
  - `pl-multiagent/typecheck.log`
  - `pl-multiagent/test.log`

Observed caveats:

- Windows launcher quoting broke one launch attempt before the valid rerun.
- Absolute `--state-dir` did not work correctly.
- `run` nodes timed out at 30 seconds for `lint` and `test`, even though gate evaluation later passed.
- redirected `ci-report.json` and `ci-stderr.log` were not populated, so session state and audit logs were the authoritative artifacts.

## Codex-Alone

Result: success.

Evidence:

- required docs and code artifacts were produced in the lane workspace
- direct Codex trace is stored in:
  - `codex-alone/events.jsonl`
  - `codex-alone/stderr.log`
  - `codex-alone/last-message.txt`
- direct verification logs are stored in:
  - `codex-alone/lint.log`
  - `codex-alone/typecheck.log`
  - `codex-alone/test.log`

Observed caveat:

- the raw event log shows an intermediate typecheck failure that Codex corrected before finishing

## Comparison

This run does not support the claim that prompt-language failed to build the bounded software-factory slice. It supports the opposite:

- `prompt-language` completed the bounded CRM core slice and passed its gates
- direct Codex also completed the bounded CRM core slice and passed verification

The main delta was operational:

- direct Codex produced cleaner primary evidence files
- prompt-language required Windows-specific launch/path handling and still has a misleading 30-second `run` timeout behavior for slower commands

Conclusion: for this bounded CRM core slice, prompt-language is working, but the Windows/headless runner path still has configuration and reporting defects that make successful runs harder to launch and interpret than the direct Codex baseline.
