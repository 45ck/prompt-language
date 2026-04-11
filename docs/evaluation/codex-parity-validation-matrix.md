# Codex CLI Parity Validation Matrix

This note defines the repo-owned validation matrix for claiming Codex CLI parity in prompt-language.

It is intentionally stricter than a one-command smoke note. A Codex parity claim in this repo has to distinguish between:

- repo-local parity, where deterministic repo commands pass through the Codex path
- supported-host live parity, where the real agent loop also passes on a supported host
- broader evaluation parity, where compare and verify evals have also been rerun

This note is a validation contract. It is not a claim that the matrix is currently green on every host.

## Current checked-in execution status

As of April 11, 2026 at `194d074a6f052662e99e69784beacc5ccfa95049`, the
checked-in evidence supports the following status for the `prompt-language-5pej.2`
full-run bead:

| Surface                          | Current checked-in status                                    | Result          | Why the bead still matters                                                 |
| -------------------------------- | ------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------- |
| `npm run test`                   | recorded as passing in the current parity notes              | `passed`        | repo-local regression bar is green                                         |
| `npm run ci`                     | recorded as passing in the current parity notes              | `passed`        | repo quality gate is green                                                 |
| `npm run eval:e2e`               | recorded as passing in the current parity notes              | `passed`        | repo-local eval runner path is proven                                      |
| `npm run eval:smoke:codex:quick` | recorded as `27/27` scenarios passed                         | `passed`        | quick Codex smoke is green                                                 |
| `npm run eval:smoke`             | blocked before scenarios by missing Claude auth on this host | `blocked`       | supported-host live-smoke evidence is still missing                        |
| `npm run eval:compare:quick`     | no current rerun checked in                                  | `not attempted` | broader comparative parity still lacks current execution evidence          |
| `npm run eval:compare:v4:quick`  | no current rerun checked in                                  | `not attempted` | current comparative-v4 parity still lacks current execution evidence       |
| `npm run eval:verify`            | no current rerun checked in                                  | `not attempted` | strong verification parity is still unproven in the current checked-in set |

This means `prompt-language-5pej.2` is still materially open. The remaining
work is execution evidence on a supported host, not a newly identified runtime
or semantic regression.

## Evidence fields

Capture the same evidence fields for every parity attempt:

| Field            | Required content                                            |
| ---------------- | ----------------------------------------------------------- |
| `date`           | local run date                                              |
| `commit`         | exact SHA or explicit dirty-worktree description            |
| `operator`       | who ran the validation                                      |
| `host`           | OS, shell, and whether the host is supported for live smoke |
| `runtime`        | Codex CLI command or harness used                           |
| `command`        | exact command executed                                      |
| `exit_code`      | numeric exit code                                           |
| `result`         | `passed`, `failed`, or `blocked`                            |
| `summary`        | test count, scenario count, or report summary               |
| `artifacts`      | report paths, log paths, or `none`                          |
| `blocker_detail` | concrete stderr or reason when blocked                      |

## Matrix

| Surface                      | Command                          | When required                                                                                                                                                      | Evidence expectation                                                                                         | Pass criteria                                                                                           | Fail or blocked criteria                                                                                                                                   | What the row proves                                                              |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Repo regression bar          | `npm run test`                   | Mandatory for every Codex parity pass                                                                                                                              | record exit code, Vitest summary, date, host, runtime                                                        | exit code `0`; no failed suites; no failed tests                                                        | any test failure or non-zero exit code is `failed`                                                                                                         | Codex-side work did not break the repo test suite                                |
| Repo quality gate            | `npm run ci`                     | Mandatory for every Codex parity pass                                                                                                                              | record exit code, gate summary, coverage summary, date, host, runtime                                        | exit code `0`; all CI substeps pass; coverage thresholds remain green                                   | any substep failure or threshold miss is `failed`                                                                                                          | the repo's authoritative quality bar is green                                    |
| Codex quick smoke            | `npm run eval:smoke:codex:quick` | Mandatory for Codex runner parity claims                                                                                                                           | record exit code, scenario totals, failing scenario ids if any, date, host, runtime                          | exit code `0`; the full quick subset passes; with the current suite that means `27/27` scenarios passed | any scenario failure is `failed`; inability to launch the Codex harness is `blocked`                                                                       | the Codex headless runner path still works on the fast regression slice          |
| Live smoke through real loop | `npm run eval:smoke`             | Mandatory for supported-host parity claims and for changes that touch hooks, parsing, advancement, state transitions, gates, application, or presentation behavior | record exit code, scenario totals, host classification, runtime, and blocker detail if scenarios never start | on a supported host, real scenarios execute and all pass                                                | any scenario failure on a supported host is `failed`; auth, unsupported-host, or harness-start failures before scenarios begin are `blocked`, not `passed` | the real agent loop works end to end, not just mocked or headless repo tests     |
| Eval runner baseline         | `npm run eval:e2e`               | Mandatory for repo-local eval parity claims                                                                                                                        | record exit code, phase summary, report/log path, date, host, runtime                                        | exit code `0`; seeded end-to-end eval flow completes successfully                                       | any runner, dataset, or report failure is `failed`                                                                                                         | the checked-in eval runner path is functional through Codex-related flows        |
| Comparative quick rerun      | `npm run eval:compare:quick`     | Mandatory for claiming broader comparative parity beyond the quick smoke subset                                                                                    | record exit code, compared report ids or output paths, summary deltas                                        | exit code `0`; compare run completes and emits usable comparison output                                 | any comparison failure is `failed`; missing harness availability is `blocked`                                                                              | Codex can participate in the comparative eval workflow, not just isolated smoke  |
| Comparative v4 rerun         | `npm run eval:compare:v4:quick`  | Mandatory for current comparative parity claims that rely on the v4 compare slice                                                                                  | record exit code, output location, summary deltas                                                            | exit code `0`; v4 comparison completes and produces usable output                                       | any comparison failure is `failed`; missing harness availability is `blocked`                                                                              | Codex remains compatible with the current comparative-v4 path                    |
| Verification rerun           | `npm run eval:verify`            | Mandatory for strong verification parity claims                                                                                                                    | record exit code, report path, summary metrics, date, host, runtime                                          | exit code `0`; verify run completes and output is readable                                              | any verify failure is `failed`; missing harness availability is `blocked`                                                                                  | Codex can satisfy the stronger verification workflow, not only smoke and compare |

## Classification rules

| Situation                                                                                                                   | Classification  | Meaning                                             |
| --------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------- |
| `npm run test` fails                                                                                                        | `failed`        | parity is not satisfied                             |
| `npm run ci` fails                                                                                                          | `failed`        | parity is not satisfied                             |
| `npm run eval:smoke:codex:quick` fails one or more scenarios                                                                | `failed`        | Codex quick-smoke parity is broken                  |
| `npm run eval:smoke` runs on a supported host and one or more scenarios fail                                                | `failed`        | supported-host parity is broken                     |
| `npm run eval:smoke` cannot start scenarios because auth is missing, the harness is unavailable, or the host is unsupported | `blocked`       | live parity evidence is missing; this is not a pass |
| compare or verify commands are not rerun                                                                                    | `not attempted` | broader parity cannot be claimed                    |

Blocked is never equivalent to passed. A blocked live-smoke run keeps the parity gap open until a supported-host rerun exists.

## Claim levels

Use the matrix to make only the narrow claim that the evidence supports.

| Claim level                 | Minimum green rows                                                                                                  | What can be claimed                                                                     | What cannot be claimed                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Repo-local Codex parity     | `npm run test`, `npm run ci`, `npm run eval:e2e`, `npm run eval:smoke:codex:quick`                                  | Codex is credible for deterministic repo validation and the quick headless smoke subset | supported-host live parity                                                  |
| Supported-host Codex parity | all repo-local rows plus `npm run eval:smoke` on a supported host                                                   | Codex has end-to-end parity through the real agent loop on a supported host             | broader comparative or verification parity unless those rows are also green |
| Broader eval parity         | supported-host parity plus `npm run eval:compare:quick`, `npm run eval:compare:v4:quick`, and `npm run eval:verify` | Codex has parity across repo gates, live smoke, compare, and verify surfaces            | claims beyond the exact scopes and hosts evidenced                          |

## Repo-specific notes

- `npm run ci` is the authority for repo completion. A green `test` run without a green `ci` run is not enough.
- `npm run eval:smoke` is mandatory for live-path changes under the repo rules in `AGENTS.md` and `CLAUDE.md`.
- Native Windows is not the supported parity target for hooks and live smoke. A Windows live-smoke block should be recorded as a host limitation, then rerouted to Linux, macOS, or a WSL-style supported host.
- `npm run eval:smoke:codex:quick` is strong fast evidence, but it does not replace supported-host live smoke.
- Compare and verify rows are what separate a narrow quick-smoke claim from a broader Codex parity claim.

## Pass/fail checklist

Do not call Codex CLI parity complete unless all of the following are true for the claim level you are making:

- every mandatory row for that claim level has an explicit recorded result
- every mandatory row has captured command, exit code, host, runtime, and summary evidence
- no mandatory row is `failed`
- no mandatory live-smoke row is `blocked`
- any blocked non-mandatory row is called out as an open evidence gap rather than silently omitted

If one of those statements is false, the parity claim is still open.
