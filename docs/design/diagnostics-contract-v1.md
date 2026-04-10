# Diagnostics Contract V1

This note accepts the first diagnostics contract for prompt-language.

It is intentionally narrow. The goal is to make blocked preflight behavior explicit without pretending the full runtime and outcome reclassification is already shipped.

## Accepted contract

Prompt-language uses one machine-readable envelope:

```json
{
  "status": "ok | blocked",
  "diagnostics": [],
  "outcomes": []
}
```

Rules:

- `diagnostics[]` is for parse, profile/preflight, runtime, and internal problems.
- `outcomes[]` is for normal flow results such as completion, gate false, review rejection, approval denial, or budget exhaustion.
- A blocked preflight is a diagnostic, not an outcome.

## Stable code ranges

These prefixes are public and stable even though the individual code set will grow later:

- `PLP-*` parse / shape
- `PLC-*` compatibility, preflight, profile
- `PLR-*` runtime
- `PLI-*` internal
- `PLO-*` outcomes

## Shipped V1 subset

The product now ships the following preflight diagnostics:

- `PLC-001` missing runner binary
- `PLC-003` unsupported runner / mode combination
- `PLC-004` `approve` in a non-interactive profile
- `PLC-005` required gate evaluator unavailable
- `PLC-006` required `send` / `receive` semantics unavailable for Claude profiles without message passing
- `PLC-007` warning-only UX gap for headless profiles

Current CLI behavior:

- `validate --runner ... --json` emits the shared envelope and exits `2` when preflight is blocked.
- `validate --runner ... --mode interactive|headless` adds static profile-compatibility checks before execution.
- `run` and `ci` execute the same preflight before starting the selected runner and exit `2` when blocked.
- `validate` without `--runner` stays parse/lint/render only.

Current shipped profile matrix:

- `runner=claude mode=interactive` is the full-fidelity interactive profile.
- `runner=claude mode=headless` blocks non-interactive `approve` and still does not expose `send` / `receive` message passing.
- `runner=codex|opencode|ollama mode=headless` preserves the shipped headless runtime semantics for `ask` / capture and `spawn` / `await`, but still blocks `approve`.
- Headless profiles emit warning-only UX diagnostics for interactive-only affordances such as the status line and watch mode.

Current gate-prerequisite coverage:

- generic `tests_pass` / `tests_fail` require a detectable test surface in the workspace
- `lint_pass` / `lint_fail` require `package.json` with a `lint` script
- `pytest_*`, `go_test_*`, `cargo_test_*`, and `diff_nonempty` require their expected workspace markers
- `file_exists ...` remains a goal-state gate, not a preflight blocker

## Explicit boundary

This decision does not claim that prompt-language has already shipped:

- parse blocking codes in the CLI
- runtime/internal reclassification
- run/ci JSON reports
- broader runner-mode coverage beyond the currently shipped `approve`, unsupported-profile, Claude-profile message-passing checks, and warning-only UX reporting in `validate`

Those remain separate backlog slices under `prompt-language-d1ag`.
