# Design

`docs/design/` is the canonical home for accepted architecture boundaries and long-lived design decisions that still shape the codebase.

Use this section for current design rationale. Do not use it as a backlog, feature-status board, or archive for every proposal revision.

For the repo-wide docs cleanup:

- Put planned or in-flight feature proposals under `docs/wip/` and mark them clearly as WIP or proposed.
- Move shipped behavior into the reference and other user-facing docs; keep a design note here only when the design rationale remains important.
- Keep superseded notes separate from canonical design docs so readers can distinguish current guidance from history.

## Canonical design docs

| Doc                                                                            | Focus                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [Host Extension Boundary](host-extension-boundary.md)                          | Host-managed skills, hooks, plugins, and MCP stay outside the core DSL                 |
| [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)             | Accepted subagent-first direction for orchestration                                    |
| [Operator Shell Boundary](operator-shell-boundary.md)                          | Accepted shell-over-runtime boundary for doctor, recovery, visibility, and supervision |
| [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md)              | Accepted ownership, merge, and cleanup contract for host hook install / refresh paths  |
| [Hooks Architecture](hooks-architecture.md)                                    | Three-hook enforcement loop and state-file model                                       |
| [Evaluation Stack V1 Boundary](evaluation-stack-v1.md)                         | Accepted first-slice boundary for rubrics, judges, eval tooling, and `review strict`   |
| [Diagnostics Contract V1](diagnostics-contract-v1.md)                          | Accepted report envelope, code ranges, and preflight boundary                          |
| [Foreach Design](foreach.md)                                                   | Canonical foreach design and rationale                                                 |
| [Skill / Profile / Agent / Flow File](terminology-skill-profile-agent-flow.md) | Terminology boundary for the backlog track                                             |

## Historical and superseded notes

| Doc                                          | Status                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| [foreach-construct.md](foreach-construct.md) | Superseded by the canonical [foreach.md](foreach.md) design doc |
| [output-parsing.md](output-parsing.md)       | Superseded note retained only for design history and context    |
