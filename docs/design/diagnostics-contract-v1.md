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
- `PLC-005` required gate evaluator unavailable

Current CLI behavior:

- `validate --runner ... --json` emits the shared envelope and exits `2` when preflight is blocked.
- `run` and `ci` execute the same preflight before starting the selected runner and exit `2` when blocked.
- `validate` without `--runner` stays parse/lint/render only.

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
- runner-mode compatibility checks such as `approve` in non-interactive mode

Those remain separate backlog slices under `prompt-language-d1ag`.
