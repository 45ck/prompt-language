# HA-HR1 H14 Live Evidence

Date: 2026-05-08

## Summary

The first task-shaped HA-HR1 runs used the H14 TDD red-green fixture with
`qwen3:8b` through the WSL-reachable Windows Ollama endpoint and Codex as the
frontier runner.

Result so far: local-only and advisor-only fail; frontier-only passes.

## Runs

### `HA-HR1-H14-local-ollama-001`

The generic local-bulk flow allowed premature completion because
`local-worker-summary.md` was the only completion gate. The model wrote a summary
after inventory and did not edit `src/contacts.js` or `src/test.js`.

Outcome:

- step exit code: `0`
- step wall time: `43.496s`
- private oracle: failed
- classification: model failure

Oracle result:

```text
Results: 2/6 passed
```

### `HA-HR1-H14-local-ollama-002`

The H14-specific local flow added public gates for `mergeDuplicates` structure and
`npm test`. This prevented the false pass. The local runner exited unsuccessful
after the gates stayed red.

Outcome:

- step exit code: `1`
- step wall time: `282.942s`
- private oracle: failed
- classification: model failure

The model replaced the fixture with a shallow `mergeContacts` helper and
comment-only tests while claiming the implementation and tests were complete. The
public gates rejected the run before the private oracle result was considered a
pass.

Representative runner outcome:

```json
{
  "status": "unsuccessful",
  "reason": "Completion gates failed: h14_public_contract. Fix the failing checks before completing the task. Last assistant output: Summary written with file changes and test status."
}
```

Oracle result:

```text
Results: 2/6 passed
```

## Interpretation

This supports the routing hypothesis that local `qwen3:8b` is useful for cheap
connectivity and narrow smoke work, but it should not be trusted for H14 TDD
implementation without stronger decomposition, smaller edit steps, or escalation.
The H14 public-gated flow is a better harness than the generic local-bulk flow
because it turns false completion into explicit model failure evidence.

### `HA-HR1-H14-frontier-codex-001`

The frontier-only baseline used the same H14 public-gated flow with Codex.

Outcome:

- step exit code: `0`
- step wall time: `210.182s`
- private oracle: passed
- classification: pass

Oracle result:

```text
Results: 6/6 passed
```

The run implemented `mergeDuplicates`, exported it, added five public
merge/duplicate tests, and passed the hidden behavior checks.

### `HA-HR1-H14-advisor-codex-ollama-001`

The advisor-only run executed frontier advice first, then asked local `qwen3:8b`
to apply the H14 public-gated flow.

Outcome:

- frontier-advice exit code: `0`
- frontier-advice wall time: `89.671s`
- local-apply exit code: `1`
- local-apply wall time: `291.338s`
- private oracle: failed
- classification: model failure

Representative local-apply outcome:

```json
{
  "status": "unsuccessful",
  "reason": "Completion gates failed: h14_public_contract. Fix the failing checks before completing the task. Last assistant output: Summary written with file changes and test status."
}
```

Oracle result:

```text
Results: 2/6 passed
```

Interpretation: frontier advice alone did not rescue this local model on H14. The
local lane still replaced the fixture with a shallow helper and comment-only tests.
For this fixture, successful completion required frontier execution, not just
frontier review/advice.
