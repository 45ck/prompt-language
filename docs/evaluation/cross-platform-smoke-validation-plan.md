# Cross-Platform Smoke Validation Plan

This note defines the concrete supported-host smoke-validation plan for `prompt-language` on Linux and macOS.

It does not replace the repo-wide release contract in [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), [Live Validation Evidence](eval-live-validation-evidence.md), or [Codex Parity Matrix](eval-parity-matrix.md). It translates those rules into a checkable execution plan for the remaining supported-host gap.

## Goal

Produce host-side smoke evidence that:

- runs on supported hosts rather than native Windows
- exercises the real live smoke harness through an authenticated `claude -p` path
- records pass, fail, and blocked outcomes in the repo’s existing evidence format
- makes Linux and macOS parity claims concrete instead of implied

## Supported environments

Use one recent Linux host and one recent macOS host. The exact distro version matters less than the host being able to run the current repo toolchain and authenticate the selected harness.

| Environment | Minimum expectations                                                                                | Why it is in scope                             |
| ----------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Linux       | Node `>=22`, npm, Git, writable temp directory, `claude` CLI on `PATH`, authenticated Claude access | Primary supported parity target for live smoke |
| macOS       | Node `>=22`, npm, Git, writable temp directory, `claude` CLI on `PATH`, authenticated Claude access | Second supported parity target for live smoke  |

Native Windows is intentionally out of scope for closure of this plan because the repo already treats native Windows as unsupported for hooks and live smoke parity.

## Preflight checks

Run these checks before starting smoke on each host:

```bash
node -v
npm -v
git rev-parse --short HEAD
claude --version
```

Confirm:

- `node -v` reports a supported Node 22+ runtime
- `claude` is installed and callable from the same shell that will run smoke
- Claude authentication is already valid on the host
- the repo worktree is at the commit under validation

If `claude -p` cannot authenticate, classify the host as blocked and do not treat the run as passing evidence.

## Required commands

Run the same command sequence on Linux and macOS.

### 1. Repo-side gates

```bash
npm run test
npm run ci
```

Expected result:

- both commands pass before host-side smoke is treated as meaningful release evidence

### 2. Quick host sanity check

```bash
npm run eval:smoke:quick
```

Expected result:

- quick smoke passes on the same host before the full run
- if quick smoke is blocked by auth or host availability, stop and classify the host as blocked

### 3. Full supported-host smoke

```bash
npm run eval:smoke
```

Expected result:

- the plugin builds and installs
- the smoke harness starts real scenarios instead of failing before execution
- the full suite completes with a passing scenario summary on the supported host

### 4. Local history summary

```bash
node scripts/eval/smoke-test.mjs --history
```

Expected result:

- history output is captured as supporting analysis only
- this command is not treated as a substitute for the live smoke run

## Expected evidence

Capture the following for each host:

| Evidence item      | Required content                                                  |
| ------------------ | ----------------------------------------------------------------- |
| Host identity      | OS, shell, Node version, Claude CLI version, date                 |
| Commit identity    | exact commit SHA or exact worktree description                    |
| Repo-side results  | `npm run test` result and `npm run ci` result                     |
| Quick smoke result | exit code and scenario summary for `npm run eval:smoke:quick`     |
| Full smoke result  | exit code and scenario summary for `npm run eval:smoke`           |
| Harness artifacts  | path to the generated `scripts/eval/results/smoke-*.json` file    |
| History summary    | captured output from `node scripts/eval/smoke-test.mjs --history` |
| Blocker detail     | exact auth, runtime, or host-support error if the run is blocked  |

At minimum, the evidence record for each host should include these fields from [Live Validation Evidence](eval-live-validation-evidence.md):

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
  - npm run eval:smoke:quick
  - npm run eval:smoke
  - node scripts/eval/smoke-test.mjs --history
test_result:
ci_result:
smoke_result:
scenario_summary:
blocker_type:
blocker_detail:
regression_classification:
next_action:
```

## Blocker handling

Treat these outcomes explicitly:

| Situation                                                                                                             | Classification        | Required action                                                          |
| --------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `npm run test` fails                                                                                                  | product regression    | fix the repo-side regression before more smoke work                      |
| `npm run ci` fails                                                                                                    | product regression    | fix the repo-side regression before more smoke work                      |
| `npm run eval:smoke:quick` or `npm run eval:smoke` fails before scenarios run because `claude -p` cannot authenticate | environment blocker   | record the blocker and rerun on a supported authenticated host           |
| `npm run eval:smoke` starts scenarios and any scenario fails                                                          | product regression    | treat the feature as not complete and investigate the failing scenario   |
| `npm run eval:smoke` passes on one host but is blocked on the other                                                   | partial evidence only | keep the cross-platform bead open until both supported hosts are covered |

Use [docs/operations/troubleshooting.md](../operations/troubleshooting.md) for the auth-blocked path. The expected remediation is to rerun on a supported host with valid Claude access, not to downgrade the requirement.

## Closure criteria

This plan is complete only when all statements below are true:

- a Linux host ran `npm run test` and `npm run ci` successfully for the validated commit
- a Linux host ran `npm run eval:smoke` and produced scenario-level results rather than a preflight blocker
- a macOS host ran `npm run test` and `npm run ci` successfully for the validated commit
- a macOS host ran `npm run eval:smoke` and produced scenario-level results rather than a preflight blocker
- both hosts have captured evidence records using the repo’s smoke-result classification
- any blocked attempt is recorded as `blocked`, not misreported as `passed`
- the final note or PR summary links the generated smoke result files or transcript locations for both hosts

## Non-closure conditions

Do not close the cross-platform smoke gap if any of the following remain true:

- only quick smoke was run
- only one of Linux or macOS produced live smoke evidence
- the full run was skipped because repo-side gates were red
- the host failed before scenario execution and the result was recorded as a pass
- the run used native Windows as the parity claim host

## Recommended execution order

Use this order to reduce wasted time:

1. Linux: `npm run test`
2. Linux: `npm run ci`
3. Linux: `npm run eval:smoke:quick`
4. Linux: `npm run eval:smoke`
5. Linux: `node scripts/eval/smoke-test.mjs --history`
6. macOS: repeat the same sequence

If Linux exposes a product regression, stop and fix that before spending time on the macOS full run.

## What this bead should prove

This bead should close only after the repo has a concrete, repeatable plan and corresponding evidence path for supported-host smoke on Linux and macOS. The artifact for this bead is the plan itself; the remaining closure question is whether the project wants to close the bead on documented execution readiness alone or only after the two supported-host runs are actually recorded.
