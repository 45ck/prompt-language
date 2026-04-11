# Design

`docs/design/` is the canonical home for accepted architecture boundaries and long-lived design decisions that still shape the codebase.

Use this section for current design rationale. Do not use it as a backlog, feature-status board, or archive for every proposal revision.

For the repo-wide docs cleanup:

- Put planned or in-flight feature proposals under `docs/wip/` and mark them clearly as WIP or proposed.
- Move shipped behavior into the reference and other user-facing docs; keep a design note here only when the design rationale remains important.
- Keep superseded notes separate from canonical design docs so readers can distinguish current guidance from history.

## Canonical design docs

| Doc                                                                                                                 | Focus                                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Host Extension Boundary](host-extension-boundary.md)                                                               | Host-managed skills, hooks, plugins, and MCP stay outside the core DSL                 |
| [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)                                                  | Accepted subagent-first direction for orchestration                                    |
| [Swarm Tooling Visibility](swarm-tooling-visibility.md)                                                             | Accepted lowered-flow preview, role-status, and failure-visibility contract for swarm  |
| [Operator Shell Boundary](operator-shell-boundary.md)                                                               | Accepted shell-over-runtime boundary for doctor, recovery, visibility, and supervision |
| [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md)                                                   | Accepted ownership, merge, and cleanup contract for host hook install / refresh paths  |
| [Operator Shell Lifecycle Hardening](operator-shell-lifecycle-hardening.md)                                         | Accepted lifecycle contract for `doctor`, `refresh`, uninstall safety, and diagnostics |
| [Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md)                                           | Accepted additive run-layout and recovery-artifact boundary                            |
| [Operator Cockpit, Watch, and Status Snapshots](operator-cockpit-watch-status-snapshots.md)                         | Accepted operator visibility and machine-readable snapshot contract                    |
| [Team Supervisor Surfaces](team-supervisor-surfaces.md)                                                             | Accepted shell-level status, resume, and stop surfaces over child runs                 |
| [Operator Scaffolding Boundary](operator-scaffolding.md)                                                            | Accepted boundary for repo-visible AGENTS, starter flows, and reusable libraries       |
| [Operator Shell Rollout, Troubleshooting, and Promotion](operator-shell-rollout-and-promotion.md)                   | Accepted evidence and promotion contract for operator-shell work                       |
| [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md)                                         | Accepted fail-closed fallback and escalation contract for compact rendering            |
| [Fresh-Context Policy for Steps and Loops](fresh-context-policy.md)                                                 | Accepted default fresh-versus-threaded session boundary policy                         |
| [Fresh-Step Bootstrap Context](fresh-step-bootstrap-context.md)                                                     | Accepted bootstrap packet contract for fresh-session handoff                           |
| [Context File Sets for Prompt Turns](context-filesets-for-prompt-turns.md)                                          | Accepted deterministic file-backed context model for prompt and ask turns              |
| [Compact-Mode Fallback Matrix](compact-mode-fallback-matrix.md)                                                     | Accepted trigger matrix for fail-closed compact-to-full escalation                     |
| [Hooks Architecture](hooks-architecture.md)                                                                         | Three-hook enforcement loop and state-file model                                       |
| [Evaluation Stack V1 Boundary](evaluation-stack-v1.md)                                                              | Accepted first-slice boundary for rubrics, judges, eval tooling, and `review strict`   |
| [Diagnostics Contract V1](diagnostics-contract-v1.md)                                                               | Accepted report envelope, code ranges, and preflight boundary                          |
| [vNext Trust Hardening](vnext-trust-hardening.md)                                                                   | Accepted strict-mode, budgets, checkpoint, and restore contract for trusted execution  |
| [Bounded Execution Contracts](bounded-execution-contracts.md)                                                       | Accepted contracts, effects, policy, and capability boundary for bounded execution     |
| [Replayability Event Log](replayability-event-log.md)                                                               | Accepted append-only ledger, replay, checkpoint, and derived-snapshot boundary         |
| [Flow IR and Static Analysis](flow-ir-and-static-analysis.md)                                                       | Accepted compile-time-rigor boundary for IR, explain, lint, simulation, and flow tests |
| [Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md)                                        | Accepted provider-adapter boundary over one shared runtime IR                          |
| [Host Lifecycle Boundary](host-lifecycle-boundary.md)                                                               | Accepted split between core flow semantics, narrow config, and host-specific lifecycle |
| [MCP Flow-Facing Scope](mcp-flow-facing-scope.md)                                                                   | Accepted boundary keeping MCP tied to flow state and bounded runtime control           |
| [Safe Parallelism via Worktrees, Locks, Ownership, and Merge Policy](safe-parallelism-worktrees-locks-ownership.md) | Accepted concurrency-safety boundary for isolated child execution and merge control    |
| [Memory Governance Alignment](memory-governance-alignment.md)                                                       | Accepted alignment of vNext memory governance with the existing memory roadmap         |
| [Retrieval Boundary and Trust Model](retrieval-boundary-and-trust-model.md)                                         | Accepted split between deterministic retrieval, grounding retrieval, and source trust  |
| [Scoped Memory Semantics](scoped-memory-semantics.md)                                                               | Accepted scope, strict-read, TTL, invalidation, and transactional-write contract       |
| [Markdown Knowledge Interop](markdown-knowledge-interop.md)                                                         | Accepted `knowledge:` and deterministic `section` lookup boundary                      |
| [Memory Checkpoint, Handoff, and Compaction Boundary](memory-checkpoint-handoff-compaction.md)                      | Accepted split between runtime recovery state and durable memory                       |
| [Wisdom Promotion Workflow](wisdom-promotion-workflow.md)                                                           | Accepted proposal, review, promote, and demote workflow for durable wisdom             |
| [Artifact Taxonomy and Initial Built-ins](artifact-taxonomy-and-builtins.md)                                        | Accepted first-release built-in artifact cut over the broader taxonomy                 |
| [Artifact Package, Manifest, and Renderer Contract](artifact-package-contract.md)                                   | Accepted package layout, manifest semantics, and renderer-view boundary                |
| [Artifact Runtime Lifecycle](artifact-runtime-lifecycle.md)                                                         | Accepted emit/validate/reference/review/supersede semantics                            |
| [Artifact Extension Boundary](artifact-extension-boundary.md)                                                       | Accepted custom-type, review-storage, and plugin-renderer boundary                     |
| [Artifact Syntax and Review UI Rollout Gate](artifact-syntax-and-review-ui-rollout.md)                              | Accepted evidence gate for any future artifact DSL syntax or review UI claims          |
| [Variable Data Structure Roadmap](variable-data-structure-roadmap.md)                                               | Accepted scalar-first store and deferred native-map direction                          |
| [Foreach Design](foreach.md)                                                                                        | Canonical foreach design and rationale                                                 |
| [Skill / Profile / Agent / Flow File](terminology-skill-profile-agent-flow.md)                                      | Terminology boundary for the backlog track                                             |

## Historical and superseded notes

| Doc                                          | Status                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| [foreach-construct.md](foreach-construct.md) | Superseded by the canonical [foreach.md](foreach.md) design doc |
| [output-parsing.md](output-parsing.md)       | Superseded note retained only for design history and context    |
