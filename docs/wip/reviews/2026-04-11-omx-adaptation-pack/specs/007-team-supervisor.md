# Spec 007 — Team Supervisor

## Goal

Add explicit team supervision around child flows without replacing existing runtime primitives.

## Relationship to current runtime

The current runtime already ships:

- `spawn`
- `await`
- `foreach-spawn`
- `send`
- `receive`
- `race`

The team supervisor should therefore orchestrate these primitives rather than invent a competing system.

## Proposed surfaces

- `team-status`
- `team-resume`
- `team-stop`
- `team-render`
- `team-doctor`

## Responsibilities

- discover active child flows
- show topology and state
- persist supervisor metadata
- support resume after interruption
- optionally attach host adapters such as worktrees
- preserve deterministic visibility into child state and gates

## Non-goals

- hidden autonomous swarms that bypass visible flow structure
- tmux-first semantics
- multi-agent magic that cannot be replayed or inspected

## Acceptance criteria

- team supervision can be explained entirely in terms of child-flow state
- the shell can recover interrupted topologies
- worktree or tmux integration is optional, not defining
- docs clearly distinguish supervision UX from orchestration semantics
