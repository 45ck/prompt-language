# Design

Architecture boundaries, canonical design notes, and superseded design history.

## Current anchors

| Doc                                                                            | Focus                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [Host Extension Boundary](host-extension-boundary.md)                          | Host-managed skills, hooks, plugins, and MCP stay outside the core DSL               |
| [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)             | Accepted subagent-first direction for orchestration                                  |
| [Hooks Architecture](hooks-architecture.md)                                    | Three-hook enforcement loop and state-file model                                     |
| [Evaluation Stack V1 Boundary](evaluation-stack-v1.md)                         | Accepted first-slice boundary for rubrics, judges, eval tooling, and `review strict` |
| [Diagnostics Contract V1](diagnostics-contract-v1.md)                          | Accepted report envelope, code ranges, and preflight boundary                        |
| [Foreach Design](foreach.md)                                                   | Canonical foreach design and rationale                                               |
| [Skill / Profile / Agent / Flow File](terminology-skill-profile-agent-flow.md) | Terminology boundary for the backlog track                                           |

## Historical and superseded notes

| Doc                                          | Status                                      |
| -------------------------------------------- | ------------------------------------------- |
| [foreach-construct.md](foreach-construct.md) | Superseded by [foreach.md](foreach.md)      |
| [output-parsing.md](output-parsing.md)       | Superseded design note retained for context |
