# Diagnostics Proposal Pack

Imported planning pack from `prompt-language-diagnostics-bundle.zip`.

Provenance summary: [Hydra import summary](../../../source-imports/from-hydra-reach-2026-04-11/README.md#diagnostics-bundle).

This pack proposes a small, explicit diagnostics contract for parse/profile/runtime problems, terminal flow outcomes, CLI exit codes, and `validate`-time profile compatibility checks.

Status: proposal only. Nothing in this folder is shipped language or CLI behavior unless it also appears in the shipped [reference](../../../reference/index.md) or accepted [design](../../../design/index.md) docs.

Backlog anchor: `prompt-language-d1ag` and its child Beads in `.beads/issues.jsonl`.

## Contents

| Doc                                                           | Focus                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| [Final Plan](final-plan.md)                                   | Core decisions, non-goals, and the initial rollout boundary  |
| [Diagnostic Contract](diagnostic-contract.md)                 | Proposed `Report`, `Diagnostic`, and `Outcome` model         |
| [Diagnostic Codes](diagnostic-codes.md)                       | Stable code ranges and initial codes                         |
| [Exit Codes and CLI Behavior](exit-codes-and-cli-behavior.md) | `validate`, `run`, and `ci` exit semantics                   |
| [Validate Profile Policy](validate-profile-policy.md)         | Proposed compatibility policy for `validate --runner --mode` |
| [Implementation Phases](implementation-phases.md)             | Four-pass rollout plan                                       |
| [Repo Changeset](repo-changeset.md)                           | Suggested file-level rollout and touch points                |

## Import boundary

This import keeps the planning docs only.

The zip's `proposed-src/`, `proposed-tests/`, and `patches/` content was not copied into `src/` or `test/` because the bundle itself marks that material as proposal-only scaffolding rather than accepted repo code.

## Summary

The pack argues for:

- separate `diagnostics[]` and `outcomes[]` channels
- a deliberately small first taxonomy (`parse`, `profile`, `runtime`, `internal`)
- fail-loud compatibility checks in `validate`
- exit-code semantics that distinguish blocked, unsuccessful, and failed runs
- a phased rollout instead of a full runtime rewrite
