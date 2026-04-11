# Design: Operator Shell Rollout, Troubleshooting, and Promotion

## Status

Accepted rollout and evidence contract for the current operator-shell backlog.

Relevant bead:

- `prompt-language-f7jp.9` - Rollout, troubleshooting, and promotion evidence for operator-shell work

Primary WIP anchors:

- [Evaluation and Rollout](../wip/reviews/2026-04-11-omx-adaptation-pack/plans/evaluation-and-rollout.md)
- [Phased Delivery Roadmap](../wip/reviews/2026-04-11-omx-adaptation-pack/plans/phased-delivery-roadmap.md)
- [Source Notes](../wip/reviews/2026-04-11-omx-adaptation-pack/source-notes.md)

Related accepted design docs:

- [Operator Shell Boundary](operator-shell-boundary.md)
- [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md)

## Decision

Operator-shell work must follow a **promotion-by-evidence** rollout model.

That means:

- WIP packs may describe the target shape of the operator shell
- accepted design notes may describe the contract the repo intends to enforce
- shipped docs may describe only behavior that has passed the required checks for the relevant slice

The repo's docs-truth rule applies especially strongly here because the operator shell is easy to over-describe before host behavior, recovery paths, and smoke validation are actually stable.

## Why this needs a first-class design note

The imported OMX adaptation pack was grounded as an operator-shell best-practices input, not as permission to claim a new shipped product surface. The [Source Notes](../wip/reviews/2026-04-11-omx-adaptation-pack/source-notes.md) make that interpretation rule explicit.

The operator shell also spans several failure-prone boundaries:

- host-managed hooks and runner integrations
- local runtime state and recovery artifacts
- long-running supervision and watch surfaces
- canonical workflow conveniences that must lower to visible runtime artifacts

Those surfaces need a shared promotion rule so docs do not outrun what the branch, host adapters, and smoke environment can actually prove.

## Rollout model

Operator-shell work should roll out in the same order defined by the imported pack:

1. imported planning pack
2. issue slicing
3. hook / doctor MVP
4. state layout migration
5. cockpit
6. workflow lowering
7. team supervisor
8. documentation promotion where earned

The [Phased Delivery Roadmap](../wip/reviews/2026-04-11-omx-adaptation-pack/plans/phased-delivery-roadmap.md) already defines the phase rule: no phase is promoted into shipped messaging until docs exist, tests exist, the recovery story exists, and the surface is distinguishable from imported planning material.

This design note makes that rule operational for day-to-day delivery.

## Required checks before promotion

Before an operator-shell slice is described as shipped behavior, the evidence set must include all applicable checks for that slice:

- `npm run format:check`
- `npm run lint`
- `npm run spell`
- `npm run test`
- `npm run ci`

Additional required checks depend on the surface:

- rendering or lowering changes must include unit or snapshot coverage for the rendered artifact
- hook lifecycle changes must include install, refresh, uninstall, ownership, and conflict-path tests
- recovery or run-state changes must include interrupted-run and resume-path coverage
- doctor or diagnostics changes must include deterministic machine-readable output checks
- watch, cockpit, or other operator-shell presentation changes must include validation that the shown state maps back to runtime-owned artifacts

Passing the generic quality gates is necessary but not sufficient. Promotion also requires troubleshooting guidance and the recovery story for the changed surface.

## When live smoke is mandatory

Live smoke is mandatory whenever the change touches application or presentation behavior that must be proven against a real operator loop rather than mocks alone.

For operator-shell work, that includes at least:

- hook install, refresh, uninstall, or doctor flows
- parsing, advancement, or state-transition changes that affect shell behavior
- run-state migration or recovery UX
- `watch`, cockpit, or statusline behavior used for real diagnosis
- workflow alias rendering or scaffolding that is presented as a supported operator path
- team-supervisor actions such as resume, stop, topology inspection, or cleanup

In practice, this follows the repo workflow contract already stated in `AGENTS.md`: smoke is mandatory for changes to hooks, parsing, advancement, or state transitions, and for application or presentation-layer behavior where unit tests are not enough to establish operator reality.

## Blocked-host handling

Some operator-shell checks depend on host access that may be unavailable in a contributor environment, such as:

- missing runner authentication
- unsupported runner version
- blocked CLI access
- unavailable host hook surfaces
- sandbox or policy restrictions that prevent a real install / smoke loop

Blocked-host handling must be conservative:

1. Record the exact blocked condition and the command that failed.
2. Distinguish environment failure from product failure.
3. Keep the feature in WIP or accepted-design status if the missing smoke evidence is required for shipped claims.
4. Allow code and non-shipped docs to land only if the limitation is documented honestly and all non-host checks are green.
5. Do not promote host-dependent behavior into README-level or reference-level language until smoke evidence exists on a supported host.

Blocked-host evidence is not a substitute for smoke. It is only enough to justify why promotion is deferred.

## Evidence capture format

Each promotion candidate should produce one compact evidence record in the relevant bead, PR description, or review pack note. The format should be stable enough that another maintainer can audit it quickly.

Required fields:

- slice or bead id
- commit SHA or branch ref
- date
- host and runner context
- exact commands run
- result for each command
- smoke status: `passed`, `blocked-host`, or `not-required`
- links to artifacts
- remaining known gaps
- promotion decision

Recommended artifact list:

- test or CI summary
- smoke transcript or terminal capture
- doctor JSON output where relevant
- rendered workflow or scaffold sample where relevant
- screenshots only when the operator surface is primarily visual and text output is insufficient

Example format:

```text
Bead: prompt-language-f7jp.9
Commit: <sha>
Date: 2026-04-11
Environment: Windows + PowerShell + supported runner version
Checks:
  - npm run test: passed
  - npm run ci: passed
  - npm run eval:smoke: blocked-host (runner auth unavailable)
Artifacts:
  - doctor output: <path or PR attachment>
  - smoke transcript: <path or PR attachment>
Known gaps:
  - live host validation pending on authenticated runner
Promotion:
  - remain in WIP / design docs only
```

The important property is not the exact prose shape. It is that the evidence record makes promotion auditable.

## Troubleshooting expectations

No operator-shell surface is ready for promotion until an operator can diagnose failure without source-diving or guesswork.

Troubleshooting guidance for a promoted slice must cover:

- the symptom an operator will see
- the command or diagnostic entry point to run next
- the file, hook entry, run id, or artifact that anchors the diagnosis
- expected healthy output
- known conflict or stale-state signatures
- the recovery or escalation path when the operator cannot self-heal

At minimum, troubleshooting should answer:

- Is the failure in the runtime, the shell, the host runner, or the local environment?
- What exact artifact proves that conclusion?
- What action is safe for the operator to take next?
- When should the operator stop and escalate instead of retrying?

Troubleshooting text should prefer concrete evidence handles over generic advice:

- file paths
- managed hook markers
- run ids
- command output modes
- rendered workflow names
- machine-readable diagnostics fields

## Promotion gates from WIP to shipped docs

Promotion is a sequence, not a single boolean.

### Gate 1: imported pack to accepted design or tracked implementation

Allowed when:

- the imported idea has been translated into repo-native terminology
- boundaries are clear
- the work is mapped to explicit beads or slices
- shipped docs still do not claim the behavior exists

### Gate 2: accepted design to implementation-ready or partially landed

Allowed when:

- the code path exists or is actively landing
- applicable unit and integration tests exist
- troubleshooting expectations are written
- recovery behavior is defined for the slice

This gate still does not justify README-level claims.

### Gate 3: implementation to shipped reference or README language

Allowed only when:

- the required quality gates pass
- applicable live smoke passes on a supported host, or the slice is genuinely host-independent
- troubleshooting guidance matches the real commands and artifacts
- recovery behavior has been exercised, not just described
- the shipped wording is narrower than or equal to the proven behavior
- imported-pack language is no longer doing the explanatory work for the shipped claim

If any of those conditions are missing, the feature stays in WIP, roadmap, or accepted-design documentation rather than shipped docs.

## Practical promotion rules by slice type

### Hook and doctor slices

Must prove:

- ownership preservation
- uninstall safety
- conflict detection
- host-visible install or refresh behavior

These slices normally require live smoke because host behavior is the point of the feature.

### Run-state and recovery slices

Must prove:

- interrupted-run recovery
- stale-state diagnosis
- migration behavior
- artifact retention or cleanup expectations

If the recovery claim depends on real runner behavior, live smoke is mandatory.

### Cockpit and watch slices

Must prove:

- the shown state matches runtime-owned artifacts
- operators can locate the failing gate, child, or checkpoint faster than before
- troubleshooting output is stable enough to reference in docs

Presentation-only unit tests are not enough if the promoted claim is about real diagnosis.

### Workflow alias and scaffolding slices

Must prove:

- the alias lowers to visible, ordinary artifacts
- the rendered or generated files are inspectable
- docs do not imply a hidden workflow engine or separate runtime

Smoke is required when the promoted claim includes the real end-to-end operator path rather than only static rendering.

### Team-supervisor slices

Must prove:

- child topology can be inspected and resumed safely
- failure and cleanup paths are diagnosable
- the shell remains a layer over existing runtime primitives

These slices should be treated as high bar for promotion because recovery failures here are especially costly.

## Consequences

What this unblocks:

- a single evidence standard for operator-shell slices
- disciplined movement from imported planning to accepted design to shipped docs
- honest handling of environments where smoke is currently blocked

What this constrains:

- README and reference docs cannot advertise operator-shell conveniences just because a design note exists
- blocked-host environments cannot silently self-certify host-dependent features
- troubleshooting and recovery remain part of the promotion bar, not post-release cleanup

## Current repository implication

This note is an accepted promotion contract. It is not a blanket claim that every operator-shell slice already satisfies it today.

The repo may land partial operator-shell implementation and accepted design notes before every slice is promotable. That is valid as long as shipped docs remain narrower than the proven evidence.
