# Design

`docs/design/` is the canonical home for accepted architecture boundaries and long-lived design decisions that still shape the codebase.

Use this section for current design rationale. Do not use it as a backlog, feature-status board, or archive for every proposal revision.

For the repo-wide docs cleanup:

- Put planned or in-flight feature proposals under `docs/wip/` and mark them clearly as WIP or proposed.
- Move shipped behavior into the reference and other user-facing docs; keep a design note here only when the design rationale remains important.
- Keep superseded notes separate from canonical design docs so readers can distinguish current guidance from history.

## Canonical design docs

| Doc                                                                                               | Focus                                                                                  |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Host Extension Boundary](host-extension-boundary.md)                                             | Host-managed skills, hooks, plugins, and MCP stay outside the core DSL                 |
| [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)                                | Accepted subagent-first direction for orchestration                                    |
| [Operator Shell Boundary](operator-shell-boundary.md)                                             | Accepted shell-over-runtime boundary for doctor, recovery, visibility, and supervision |
| [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md)                                 | Accepted ownership, merge, and cleanup contract for host hook install / refresh paths  |
| [Operator Shell Lifecycle Hardening](operator-shell-lifecycle-hardening.md)                       | Accepted lifecycle contract for `doctor`, `refresh`, uninstall safety, and diagnostics |
| [Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md)                         | Accepted additive run-layout and recovery-artifact boundary                            |
| [Operator Cockpit, Watch, and Status Snapshots](operator-cockpit-watch-status-snapshots.md)       | Accepted operator visibility and machine-readable snapshot contract                    |
| [Team Supervisor Surfaces](team-supervisor-surfaces.md)                                           | Accepted shell-level status, resume, and stop surfaces over child runs                 |
| [Operator Scaffolding Boundary](operator-scaffolding.md)                                          | Accepted boundary for repo-visible AGENTS, starter flows, and reusable libraries       |
| [Operator Shell Rollout, Troubleshooting, and Promotion](operator-shell-rollout-and-promotion.md) | Accepted evidence and promotion contract for operator-shell work                       |
| [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md)                       | Accepted fail-closed fallback and escalation contract for compact rendering            |
| [Fresh-Context Policy for Steps and Loops](fresh-context-policy.md)                               | Accepted default fresh-versus-threaded session boundary policy                         |
| [Fresh-Step Bootstrap Context](fresh-step-bootstrap-context.md)                                   | Accepted bootstrap packet contract for fresh-session handoff                           |
| [Compact-Mode Fallback Matrix](compact-mode-fallback-matrix.md)                                   | Accepted trigger matrix for fail-closed compact-to-full escalation                     |
| [Hooks Architecture](hooks-architecture.md)                                                       | Three-hook enforcement loop and state-file model                                       |
| [Evaluation Stack V1 Boundary](evaluation-stack-v1.md)                                            | Accepted first-slice boundary for rubrics, judges, eval tooling, and `review strict`   |
| [Diagnostics Contract V1](diagnostics-contract-v1.md)                                             | Accepted report envelope, code ranges, and preflight boundary                          |
| [vNext Trust Hardening](vnext-trust-hardening.md)                                                 | Accepted strict-mode, budgets, checkpoint, and restore contract for trusted execution  |
| [Bounded Execution Contracts](bounded-execution-contracts.md)                                     | Accepted contracts, effects, policy, and capability boundary for bounded execution     |
| [Replayability Event Log](replayability-event-log.md)                                             | Accepted append-only ledger, replay, checkpoint, and derived-snapshot boundary         |
| [Flow IR and Static Analysis](flow-ir-and-static-analysis.md)                                     | Accepted compile-time-rigor boundary for IR, explain, lint, simulation, and flow tests |
| [Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md)                      | Accepted provider-adapter boundary over one shared runtime IR                          |
| [Memory Governance Alignment](memory-governance-alignment.md)                                     | Accepted alignment of vNext memory governance with the existing memory roadmap         |
| [Artifact Package, Manifest, and Renderer Contract](artifact-package-contract.md)                 | Accepted package layout, manifest semantics, and renderer-view boundary                |
| [Artifact Runtime Lifecycle](artifact-runtime-lifecycle.md)                                       | Accepted emit/validate/reference/review/supersede semantics                            |
| [Artifact Extension Boundary](artifact-extension-boundary.md)                                     | Accepted custom-type, review-storage, and plugin-renderer boundary                     |
| [Foreach Design](foreach.md)                                                                      | Canonical foreach design and rationale                                                 |
| [Skill / Profile / Agent / Flow File](terminology-skill-profile-agent-flow.md)                    | Terminology boundary for the backlog track                                             |

## Historical and superseded notes

| Doc                                          | Status                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| [foreach-construct.md](foreach-construct.md) | Superseded by the canonical [foreach.md](foreach.md) design doc |
| [output-parsing.md](output-parsing.md)       | Superseded note retained only for design history and context    |
