# Current DSL Workarounds

The current prompt-language DSL does not yet have first-class artifact syntax.

But artifact-like behavior can already be approximated by:

- writing structured files with `run`
- capturing summaries with `let x = prompt "..."` or `let x = run "..." `
- using `approve`
- using `done when:` with file existence or test gates

## Example: produce a release packet as files

```text
Goal: prepare a release packet for auth-service

flow:
  run: mkdir -p .prompt-language/artifacts/release-packet
  let summary = prompt "Write a short release-readiness summary for auth-service."
  let risks = prompt "List the top release risks."
  run: printf '%s\n' "${summary}" > .prompt-language/artifacts/release-packet/summary.md
  run: printf '%s\n' "${risks}" > .prompt-language/artifacts/release-packet/risks.md
  run: npm test
  run: npm run lint
  approve "Review the release packet in .prompt-language/artifacts/release-packet"

done when:
  tests_pass
  lint_pass
  file_exists .prompt-language/artifacts/release-packet/summary.md
```

## Example: browser QA proof bundle

```text
Goal: create a browser QA packet for checkout

flow:
  run: mkdir -p .prompt-language/artifacts/browser-qa
  run: npx playwright test tests/checkout.spec.ts
  let qa_summary = prompt "Summarize the checkout QA result."
  run: printf '%s\n' "${qa_summary}" > .prompt-language/artifacts/browser-qa/summary.md
  approve "Inspect the browser QA folder and confirm whether checkout is ready."

done when:
  file_exists .prompt-language/artifacts/browser-qa/summary.md
```

These workarounds are useful, but they lack:

- a typed artifact registry
- schema validation
- review state on the artifact itself
- renderer-aware outputs
- artifact-aware gates
