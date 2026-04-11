# Live Validation Evidence

This note defines the live-validation requirements for the evaluation stack in repo-native terms.

It is an operational QA checklist, not a replacement for the existing product contract in [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), or the current support limits in [Codex Parity Matrix](eval-parity-matrix.md).

## Authoritative command set

Use these commands as the validation authority for evaluation-stack work:

| Command              | Role                                                   | Required result                                                           |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `npm run test`       | repo-side regression signal after changes              | pass                                                                      |
| `npm run ci`         | final repo-side quality gate before claiming complete  | pass                                                                      |
| `npm run eval:smoke` | live end-to-end validation through the real agent loop | pass on a supported host, or fail fast with an explicit host/auth blocker |

## Mandatory versus advisory live smoke

### Live smoke is mandatory

Run `npm run eval:smoke` and record evidence when the change touches any of the following:

- hook behavior
- parsing
- advancement
- state transitions
- gate evaluation
- application layer behavior
- presentation layer behavior
- new DSL primitives or syntax
- runner or harness behavior that can change real agent-loop execution

This matches the repo rules in `AGENTS.md` and `CLAUDE.md`: unit tests, mocked tests, and `npm run ci` do not replace live smoke for these changes.

### Live smoke is advisory

Live smoke may be recorded as advisory rather than release-blocking only when the change is genuinely outside the live execution path, for example:

- docs-only edits
- static evaluation notes
- dataset-bank commentary that does not change runner behavior
- analysis artifacts that do not affect parser, runtime, hooks, advancement, or state

When classifying smoke as advisory, the evidence note must say why the slice is host-independent.

## Supported-host expectation

A supported host is one where the selected live harness can both start and authenticate, and where the repo already treats the host as valid for live parity work.

Minimum expectation:

- `npm run eval:smoke` can invoke the underlying live harness
- the harness can authenticate instead of failing before scenario execution
- the run can execute real scenarios and produce scenario-level outcomes

Current repo expectations already established elsewhere:

- native Windows is not the supported parity target for hooks and live smoke
- Linux, macOS, or WSL-style supported-host runs are the expected parity path when live Claude access is required
- historical smoke reports or quick-smoke notes do not backfill supported-host evidence for a later slice
- a Windows docs-only pass may document the gap, but it must not silently convert the gap into a parity claim

## Blocked-host expectation

A blocked host is not a product regression by itself. It is an environment that cannot currently produce valid live-smoke evidence.

Typical blocked-host conditions:

- missing Claude login or authorization
- harness command unavailable on the machine
- unsupported host/runtime combination
- external runtime outage that prevents scenario execution before product behavior is exercised

Required handling on a blocked host:

- run `npm run eval:smoke`
- confirm the failure is an external host/auth/runtime blocker
- record the blocker explicitly
- do not relabel the run as a product failure unless a scenario actually ran and the product behavior regressed
- reroute required live validation to a supported host

Required handling on an unsupported host such as native Windows:

- keep the unsupported-host status explicit in the evidence note
- record any repo-local evidence you did gather, such as test, CI, or smoke-history inspection
- do not rewrite a stored historical smoke result as if it were a fresh host validation
- name the supported-host rerun still required to close the gap

## Evidence fields to capture

Every live-validation record should capture the same fields so the result is checkable.

| Field                       | Required content                                                     |
| --------------------------- | -------------------------------------------------------------------- |
| `date`                      | local date of the run                                                |
| `commit`                    | commit SHA or exact worktree description                             |
| `operator`                  | who ran the command                                                  |
| `host`                      | OS, shell, and whether the host is supported or blocked              |
| `runtime`                   | harness/CLI used for the live run                                    |
| `change_scope`              | short statement of what changed                                      |
| `smoke_classification`      | `mandatory` or `advisory`                                            |
| `commands`                  | exact commands executed                                              |
| `test_result`               | result for `npm run test`                                            |
| `ci_result`                 | result for `npm run ci`                                              |
| `smoke_result`              | `passed`, `failed`, or `blocked`                                     |
| `scenario_summary`          | pass/fail counts or explicit note that no scenarios ran              |
| `blocker_type`              | auth, host support, runtime availability, external outage, or `none` |
| `blocker_detail`            | concrete stderr or failure summary                                   |
| `regression_classification` | `product regression`, `environment blocker`, or `not applicable`     |
| `next_action`               | rerun target, fix owner, or reason no further action is required     |

## Classification rules

Apply these rules consistently:

| Situation                                                                                         | Classification      | Release meaning                      |
| ------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------ |
| `npm run test` fails                                                                              | product regression  | work is not complete                 |
| `npm run ci` fails                                                                                | product regression  | work is not complete                 |
| `npm run eval:smoke` runs scenarios on a supported host and a scenario fails                      | product regression  | work is not complete                 |
| `npm run eval:smoke` is blocked before scenarios run because auth/runtime/host support is missing | environment blocker | live evidence is still missing       |
| Change is docs-only and does not affect live execution path                                       | advisory live smoke | repo-side evidence may be sufficient |

## Recording blocked external conditions

Blocked external conditions must stay visible without being misclassified.

Use this pattern:

1. Record the attempted command exactly.
2. Record whether any scenarios actually started.
3. Record the external blocker in the evidence note.
4. Mark the run as `blocked`, not `passed`.
5. Mark the classification as `environment blocker`, not `product regression`, unless product code was exercised and failed.
6. Name the supported host or follow-up path needed to close the gap.

Example:

```text
command: npm run eval:smoke
smoke_result: blocked
scenario_summary: 0 scenarios run
blocker_type: auth
blocker_detail: Claude CLI authorization unavailable; harness failed before scenario execution
regression_classification: environment blocker
next_action: rerun on supported host with valid Claude access
```

## Checkable acceptance bar

Do not call live validation complete unless all applicable statements are true:

- `npm run test` result is recorded
- `npm run ci` result is recorded
- the note states whether live smoke was mandatory or advisory
- if live smoke was mandatory, `npm run eval:smoke` was attempted
- supported-host smoke failures are treated as product regressions
- blocked-host or blocked-auth runs are treated as environment blockers
- blocked runs still include a concrete rerun path

## Recommended evidence template

```text
date:
commit:
operator:
host:
runtime:
change_scope:
smoke_classification:
commands:
  - npm run test
  - npm run ci
  - npm run eval:smoke
test_result:
ci_result:
smoke_result:
scenario_summary:
blocker_type:
blocker_detail:
regression_classification:
next_action:
```
