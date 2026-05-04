<!-- cspell:ignore FSCRUD fscrud precheck -->

# R30 Domain-Control Experiment

Date: 2026-05-04

## Purpose

R29 separated one failure mode from another. Public domain API artifacts and export
normalization stabilized the CommonJS export surface, but the run still failed
executable customer behavior and the hidden verifier still reported
`domain_behavior_failed`.

R30 is a narrow control experiment. It tests whether the current FSCRUD bottleneck
is executable domain behavior, static artifact/export control, or the local model's
ability to use PL feedback.

## Hypotheses

H30-A, executable domain behavior is the bottleneck: if a lane supplies or
successfully produces a passing `src/domain.js`, the remaining server, UI, docs,
seed, and manifest work should reach verifier pass or fail on non-domain issues.

H30-B, static/export control is still the bottleneck: stricter domain behavior
gates will not materially improve over R29 because the same export, path, or
artifact-integrity failures recur before behavior can be measured.

H30-C, senior metacognitive control helps local domain implementation: a compact
senior-pairing lane can make the same local model pass the public domain checks
without deterministic or frontier-authored domain code.

H30-D, frontier-domain routing isolates model capability: if the hybrid frontier
domain lane passes the domain checks while local PL lanes do not, the blocker is
likely domain reasoning/implementation capability rather than PL export control.

## Arms

| Arm                          | Flow                                                 | Provider boundary          | Purpose                                                                   |
| ---------------------------- | ---------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `r30-solo-local`             | `../flows/solo-local-crud-r30-domain-control.flow`   | Local only                 | Direct local baseline with no PL repair loop.                             |
| `r29-static-export-control`  | `../flows/pl-fullstack-crud-micro-contract-v2.flow`  | Local only                 | Existing export-control diagnostic replay.                                |
| `r30-pl-domain-control`      | `../flows/pl-fullstack-crud-domain-control-r30.flow` | Local only                 | Stronger executable domain gate before server/UI/docs work.               |
| `r30-pl-senior-domain`       | `../flows/pl-fullstack-crud-senior-domain-r30.flow`  | Local only                 | Senior-pairing metacognition plus the same executable domain gate.        |
| `r30-hybrid-frontier-domain` | `../flows/hybrid-frontier-domain-r30.flow`           | Hybrid, explicitly labeled | Frontier may author only `src/domain.js`; local owns remaining artifacts. |

If the harness cannot route only the domain step to a frontier runner, skip the
hybrid arm or run it as a separately labeled frontier-domain feasibility probe. Do
not mix it into local-only claim evidence.

Current runner support:

- `--arms r30-domain-control` runs `r30-solo-local`,
  `r29-static-export-control`, and `r30-pl-domain-control`.
- `--arms r30-local` adds `r30-pl-senior-domain` to the same local-only matrix.
- `r30-hybrid-frontier-domain` is predeclared as a flow artifact, but is not part
  of a runner arm group until the FSCRUD harness can route only the domain step to
  a frontier provider.

## Timeout Policy

Use the same timeout policy across local-only R30 arms:

- Solo wall-clock timeout: `90` minutes.
- PL local wall-clock timeout: `150` minutes.
- Hybrid wall-clock timeout: `180` minutes, split as `60` minutes for the
  frontier-domain step and `120` minutes for local bulk completion.
- Per-command timeout: `300` seconds for public checks, tests, and verifier runs.
- Per-model-turn timeout: `600` seconds.
- Retry/review loops: max `5` for the R30 domain gate, max `2` for final
  server/UI/docs repair.

Timeouts are outcomes, not missing data. Preserve artifacts and classify them as
`timeout_partial` unless the runner failed before a usable workspace exists, in
which case classify `runtime_failed`.

## Metrics

Primary endpoint: hidden FSCRUD verifier pass with no hard failures.

Primary diagnostic metrics:

- `domainBehavior` pass/fail and `domainSubScores.executableBehavior`.
- First failing public domain check: exports, customer, assets, work orders, or
  `npm test`.
- Whether `domain_behavior_failed` remains the hidden hard failure.
- Whether non-domain hard failures appear after a domain-green lane.

Secondary metrics:

- final score out of `100`
- hard-failure list
- public check sequence and repair count
- runner exit code and timeout status
- wall-clock time and sampled GPU active minutes
- count of model-authored edits to protected contract files
- run-root app-file leaks
- whether frontier-authored files are limited to `workspace/fscrud-01/src/domain.js`

## Expected Falsification Criteria

Falsify H30-A if `r30-pl-domain-control` or `r30-hybrid-frontier-domain` passes the
public domain checks but still fails with the same broad static artifact/export
failures as R29.

Falsify H30-B if a domain-green lane reaches verifier pass or moves the only hidden
hard failure away from `domain_behavior_failed` while preserving the same static
export controls.

Falsify H30-C if `r30-pl-senior-domain` fails the same first public domain check as
`r30-pl-domain-control`, times out before editing `src/domain.js`, or repairs by
weakening tests/contracts instead of implementing behavior.

Falsify H30-D if the frontier-domain lane cannot pass the public domain checks when
limited to `src/domain.js`, or if it passes only by modifying protected tests,
contracts, seed data, package scripts, or verifier-visible scaffolding.

## Claim-Grade Evidence

R30 is claim-grade only for the narrow bottleneck question, not for a broad
PL-vs-solo product claim.

Minimum claim-grade evidence:

- all local-only arms run from the same commit, task, verifier, runner, model, and
  timeout policy;
- `k=3` paired repeats for `r30-solo-local`, `r29-static-export-control`, and
  `r30-pl-domain-control`;
- the senior-pairing and hybrid arms are either predeclared in the same matrix or
  explicitly marked as follow-up diagnostics;
- the hidden verifier is run only by the harness after the flow;
- public domain checks, run manifests, transcripts, score JSON, and hard-failure
  lists are retained;
- frontier-authored code is separated from local-only evidence and labeled at the
  file/step level;
- no per-run changes to task, verifier, rubric, scaffold scripts, model, runner,
  timeout, or commit.

A defensible R30 conclusion should be phrased as one of:

- "R29 was primarily an executable domain behavior bottleneck."
- "R29 was not isolated to domain behavior; static artifact/export or UI/server
  controls still dominate."
- "Senior PL control was sufficient/insufficient for the local model on the domain
  layer."
- "Hybrid frontier-domain routing was necessary/unnecessary to clear the domain
  layer."
