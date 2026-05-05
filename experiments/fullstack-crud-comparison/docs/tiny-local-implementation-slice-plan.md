# Tiny Local Implementation Slice Plan

Date: 2026-05-06

## Purpose

Test whether local-model responsibility can expand one step beyond bounded
selection/ranking without returning to the R30-R39 failure modes.

The question is deliberately narrow:

> Can the local model implement one tiny executable behavior while PL protects the
> rest of the product, verifies the change, and records failure categories?

This is not a full-stack local-only implementation claim.

## Hypothesis

If product scope, writable files, public gates, hidden oracle checks, and timeout
policy are fixed, a local model may be able to own a small executable change under
PL supervision even though it failed broader FSCRUD implementation responsibility.

## Candidate Slice

Use one behavior that is small, executable, and easy to verify:

- Add or repair one domain validation rule.
- Keep UI, seed data, server scaffolding, handoff artifacts, and verifier scripts
  protected.
- Allow the model to edit exactly one product file plus one test file.

Preferred first behavior:

```text
Reject work-order completion when the work order has no assigned technician.
```

Reason: it is domain-level, deterministic, independent of visual UI judgment, and
can be tested with a hidden oracle plus a public failing test.

## Arms

| Arm              | Model responsibility                  | Deterministic responsibility                      |
| ---------------- | ------------------------------------- | ------------------------------------------------- |
| `static-control` | None                                  | Apply known-good patch; prove verifier validity   |
| `solo-local`     | Direct prompt owns the tiny fix       | Same verifier and timeout policy                  |
| `pl-selector`    | Choose the correct fix strategy only  | Render known-good patch from validated choice     |
| `pl-tiny-impl`   | Edit the allowed implementation files | PL owns scope guard, public gate, hidden verifier |

The first live run should be a smoke with one repeat per arm. If the harness and
oracle behave correctly, rerun with `k=3`.

## Controls

- Same commit, model, runner, timeout policy, task text, and verifier for all arms.
- Hidden verifier source is not visible in model prompts.
- Public gate exposes only the failing behavior, not the hidden oracle internals.
- Writable file allowlist is enforced and recorded.
- Static control must pass before any model run is interpreted.
- Frontier help is forbidden in local-only arms.

## Metrics

Primary:

- Hidden oracle pass/fail.
- Public gate pass/fail.
- Scope integrity pass/fail.
- Failure class: `verified_pass`, `oracle_failed`, `scope_violation`,
  `runtime_failed`, `timeout_partial`, `no_edit`, or `flow_failed`.

Secondary:

- Wall-clock time.
- Retry count.
- Model turn count.
- Local GPU active minutes when available.

Runtime is telemetry, not the main score. The local model is expected to be slow.

## Claim Boundary

A `pl-tiny-impl` win would support only this claim:

> Local responsibility can sometimes expand from bounded semantic choice to one
> small executable implementation slice under deterministic PL supervision.

It would still not prove:

- autonomous local full-stack implementation;
- local senior-engineering judgment;
- local free-form artifact generation;
- PL speed advantage;
- hybrid-routing value.

## Next Work

1. Build the static control fixture and hidden oracle.
2. Add the `pl-selector` and `pl-tiny-impl` arms.
3. Run one smoke per arm.
4. If all controls behave, run `k=3` and write a dated evidence note.
