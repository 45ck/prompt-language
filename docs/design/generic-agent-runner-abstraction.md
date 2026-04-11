# Design: Generic Agent Runner Abstraction

## Status

Proposed implementation note for bead `prompt-language-9uqe.4`.

Primary related notes:

- [Host Lifecycle Boundary](host-lifecycle-boundary.md)
- [Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md)
- [Codex External Child-Session Decision](codex-external-child-session-decision.md)

## Problem

`prompt-language` already has two materially different child-runner paths:

- `src/infrastructure/adapters/claude-process-spawner.ts` launches an external `claude -p` process and treats `session-state.json` in `stateDir` as the source of truth.
- `src/infrastructure/adapters/headless-process-spawner.ts` runs the child flow in-process and keeps liveness in memory until `runFlowHeadless()` finishes.

Both are forced through the same application port:

```ts
export interface ProcessSpawner {
  spawn(input: SpawnInput): Promise<SpawnResult>;
  poll(stateDir: string): Promise<ChildStatus>;
  terminate?(pid: number): Promise<boolean>;
}
```

That port is correct for the runtime, but it is too low-level and too Claude-shaped to serve as the long-term infrastructure boundary. The result today is that:

- external-process concerns and provider concerns are mixed together
- `stateDir` polling is treated like the default lifecycle rather than one transport
- hook entry points instantiate `ClaudeProcessSpawner` directly
- adding another external runner would require cloning Claude-specific logic instead of plugging into one explicit contract

## Decision

Add an **infrastructure-only `SpawnedSessionRunner` abstraction** beneath `ProcessSpawner`.

The design is intentionally two-layered:

1. `application` continues to depend only on `ProcessSpawner`.
2. `infrastructure` gains `SpawnedSessionRunner` plus a thin `RunnerBackedProcessSpawner`.

This keeps the runtime stable while giving the adapter layer one concrete, provider-neutral place to describe:

- how a child run is launched
- which transport is used to observe completion
- which behaviors are actually supported by that runner
- how current `ProcessSpawner` semantics are preserved during migration

## Non-goals

This note does not propose:

- new DSL syntax
- changes to `spawn`, `await`, `race`, or `foreach_spawn` semantics
- a claim that Claude, Codex, and OpenCode already share one lifecycle model
- a domain-layer provider concept
- immediate changes to hook UX or flow authoring

## Current repo constraints

This design must fit the code that exists today.

### Runtime-facing data is currently narrow

`advance-flow.ts` only supplies these child-launch inputs:

- `name`
- `goal`
- `flowText`
- `variables`
- `stateDir`
- optional `cwd`
- optional `model`

There is no runtime-level `provider`, `env`, `resumeToken`, or workspace-isolation selection today. Phase 1 of this abstraction must not widen the application port just to appear more generic.

### Session state only persists `pid` and `stateDir`

`src/domain/session-state.ts` stores spawned-child runtime data as:

- `pid`
- `stateDir`
- timestamps
- returned variables
- terminal status

It does not persist a provider session id or runner-specific opaque handle. Phase 1 therefore needs a polling contract that can operate from `stateDir` plus optional in-memory handle data.

### Hooks are currently Claude-defaulted

Interactive hook entry points create `ClaudeProcessSpawner(process.cwd())` directly:

- `src/presentation/hooks/user-prompt-submit.ts`
- `src/presentation/hooks/stop.ts`
- `src/presentation/hooks/task-completed.ts`

That default must remain behaviorally unchanged until a separate provider-selection change is made.

### Headless spawn is already a real second implementation

`HeadlessProcessSpawner` is not hypothetical. It is the current deterministic path for headless Codex/OpenCode/Ollama-style flows. The generic runner abstraction must treat that path as a first-class implementation, not as a temporary exception.

## Boundary

The boundary is:

```text
presentation -> infrastructure -> application -> domain
```

Ownership by layer:

- `domain`: no awareness of runner/provider abstractions
- `application`: depends only on `ProcessSpawner`
- `infrastructure`: owns runner contracts, provider-specific implementations, and default selection
- `presentation`: may choose which `ProcessSpawner` implementation to instantiate, but should not know provider-specific launch details

The critical rule is: **provider-specific lifecycle details stay below `ProcessSpawner`**.

## Phase-1 contract

Phase 1 should be concrete and shaped around the repo as it exists today.

```ts
import type { VariableStore } from '../../domain/variable-value.js';

export type SpawnCaptureMode = 'state-file' | 'memory';

export interface SpawnedSessionRequest {
  readonly name: string;
  readonly goal: string;
  readonly flowText: string;
  readonly variables: VariableStore;
  readonly stateDir: string;
  readonly cwd?: string | undefined;
  readonly model?: string | undefined;
}

export interface SpawnedSessionHandle {
  /**
   * Infrastructure-local identifier for the launched child. Phase 1 does not
   * need to persist this in SessionState.
   */
  readonly runId: string;
  /**
   * Stable lookup key shared with the current runtime contract.
   */
  readonly stateDir: string;
  /**
   * Present for external-process runners. Omitted for in-process runners.
   */
  readonly pid?: number | undefined;
  readonly captureMode: SpawnCaptureMode;
}

export interface SpawnedSessionSnapshot {
  readonly status: 'running' | 'completed' | 'failed';
  readonly variables?: Readonly<Record<string, string>> | undefined;
}

export interface SpawnedSessionCapabilities {
  readonly externalProcess: boolean;
  readonly terminate: boolean;
  readonly cwdOverride: boolean;
  readonly modelPassThrough: boolean;
  readonly stateDirPolling: boolean;
  readonly inProcessExecution: boolean;
}

export interface SpawnedSessionRunner {
  readonly capabilities: SpawnedSessionCapabilities;

  launch(request: SpawnedSessionRequest): Promise<SpawnedSessionHandle>;

  /**
   * stateDir is mandatory because the current runtime persists only stateDir
   * and pid. handle is optional so in-memory runners can use it when present,
   * while file-backed runners can re-derive state from disk.
   */
  poll(
    ref: Readonly<{
      readonly stateDir: string;
      readonly handle?: SpawnedSessionHandle | undefined;
    }>,
  ): Promise<SpawnedSessionSnapshot>;

  /**
   * Best effort. External-process runners may use pid and/or handle metadata.
   * In-process runners may always return false.
   */
  terminate?(
    ref: Readonly<{
      readonly pid?: number | undefined;
      readonly handle?: SpawnedSessionHandle | undefined;
      readonly stateDir: string;
    }>,
  ): Promise<boolean>;
}
```

## Why this contract is the right minimum

### It matches current runtime inputs

`SpawnedSessionRequest` is deliberately the same data shape the application already emits. No speculative `provider`, `env`, or session-resume fields are required to land Phase 1.

### It keeps `stateDir` as the stable rendezvous key

That is the implementation-critical detail missing from a more generic design. In this repo:

- Claude can recover status from `stateDir` alone
- headless runners can use `stateDir` as the map key for in-memory child bookkeeping
- `await` and cleanup logic already persist and reload `stateDir`

If `poll()` required an opaque handle only, the abstraction would not fit the current persisted state model.

### It models the real transport split

Phase 1 only needs two capture modes:

- `state-file`: Claude-style external child writes `session-state.json`
- `memory`: headless child returns results in-process

`stdout-json`, `provider-api`, and session-resume semantics can be added later if the repo actually grows those paths.

## Compatibility adapter

The migration seam should be a thin adapter:

```ts
export class RunnerBackedProcessSpawner implements ProcessSpawner {
  constructor(private readonly runner: SpawnedSessionRunner) {}

  private readonly handles = new Map<string, SpawnedSessionHandle>();

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    const handle = await this.runner.launch(input);
    this.handles.set(input.stateDir, handle);
    return { pid: handle.pid ?? 0 };
  }

  async poll(stateDir: string): Promise<ChildStatus> {
    const snapshot = await this.runner.poll({
      stateDir,
      handle: this.handles.get(stateDir),
    });
    return snapshot.variables != null
      ? { status: snapshot.status, variables: snapshot.variables }
      : { status: snapshot.status };
  }

  async terminate(pid: number): Promise<boolean> {
    if (!this.runner.terminate) return false;

    const handle = [...this.handles.values()].find((candidate) => candidate.pid === pid);
    return this.runner.terminate({
      pid,
      handle,
      stateDir: handle?.stateDir ?? '',
    });
  }
}
```

Design rules for this adapter:

- it stays in `infrastructure`, not `application`
- it does not add new runtime semantics
- it is responsible for the ephemeral `stateDir -> handle` map
- it returns `pid: 0` for runners that do not have a real OS process, preserving current headless behavior

## Provider mappings in this repo

### Claude external runner

`ClaudeProcessSpawner` maps cleanly to `SpawnedSessionRunner` with:

- `externalProcess: true`
- `terminate: true`
- `cwdOverride: true`
- `modelPassThrough: true`
- `stateDirPolling: true`
- `inProcessExecution: false`

Concrete behavior that must remain unchanged:

- launch `claude -p --dangerously-skip-permissions`
- pass `--model` only when `model` is supplied
- set `PROMPT_LANGUAGE_STATE_DIR`
- use spawn-level `cwd` when provided, otherwise instance `cwd`
- treat unreadable or absent `session-state.json` as `running`
- map `completed` to completed, and `failed` or `cancelled` to failed

### Headless runner

`HeadlessProcessSpawner` maps cleanly to `SpawnedSessionRunner` with:

- `externalProcess: false`
- `terminate: false`
- `cwdOverride: true`
- `modelPassThrough: true`
- `stateDirPolling: false`
- `inProcessExecution: true`

Concrete behavior that must remain unchanged:

- launch via `runFlowHeadless()`
- key child bookkeeping by `stateDir`
- return `pid: process.pid` through the current `ProcessSpawner` shim so `await` liveness checks remain stable
- expose terminal variables as stringified child variables

## Explicitly out of scope for Phase 1

These are valid future extensions, but they should not be bundled into the first abstraction change:

- provider routing on the application port
- extra environment-variable pass-through
- worktree or sandbox isolation modes
- provider-managed session ids
- resume tokens
- structured stdout capture
- provider API polling

Each of those changes widens semantics beyond what the runtime currently emits and would need its own evidence and tests.

## Migration plan

### Step 1: add the runner contract in infrastructure

Add an infrastructure-local contract file, for example:

- `src/infrastructure/adapters/spawned-session-runner.ts`

Do not change `ProcessSpawner` yet.

### Step 2: add the compatibility adapter

Add:

- `src/infrastructure/adapters/runner-backed-process-spawner.ts`

This becomes the only place that translates between `ProcessSpawner` and `SpawnedSessionRunner`.

### Step 3: extract Claude logic behind the runner

Refactor `src/infrastructure/adapters/claude-process-spawner.ts` into one of two acceptable shapes:

- rename it to a Claude runner and introduce a new `ClaudeProcessSpawner` wrapper, or
- keep the public filename/class stable, but internally delegate to `RunnerBackedProcessSpawner(new ClaudeSpawnedSessionRunner(...))`

The key requirement is that the Claude-specific launch and poll logic moves behind the runner contract.

### Step 4: extract the headless path behind the same runner

Do the same for `src/infrastructure/adapters/headless-process-spawner.ts`.

After this step, Claude and headless implementations share one infrastructure contract while the application still sees `ProcessSpawner`.

### Step 5: remove direct provider knowledge from hooks

Once the runner-backed spawners exist, hook entry points should instantiate a repo-default spawner factory rather than constructing `ClaudeProcessSpawner` directly.

That follow-up is outside this bead's file-only scope, but it is the next repo change needed to make the abstraction operationally real.

## Required tests for the migration

The code change that follows this note should add or preserve tests covering:

- Claude launch arguments and env propagation still match current behavior
- Claude poll still treats missing state files as `running`
- headless child execution still returns parent-visible variables
- `RunnerBackedProcessSpawner` preserves `pid: 0` and `pid: process.pid` behavior exactly as current callers expect
- `terminateRunningSpawnedChildren()` still works against the process-spawner surface without learning about provider concepts

## Acceptance criteria

This bead should be considered satisfied when the note is concrete enough that an implementer can make the change without inventing repo-specific behavior. Specifically:

- the abstraction boundary is explicitly below `ProcessSpawner`
- the contract is limited to fields the repo already emits today
- `stateDir` is called out as the stable poll key for Phase 1
- the Claude and headless mappings are described in terms of actual checked-in behavior
- the migration path names the exact compatibility adapter needed for this repo
- future extensions are separated from the minimum viable migration

## Consequences

What improves:

- the repo gets one explicit infrastructure contract for child-runner behavior
- Claude-specific assumptions stop leaking into the generic adapter boundary
- headless child execution becomes a first-class implementation of the same abstraction
- future provider work can extend from a concrete seam rather than from copied spawner logic

What remains intentionally unchanged:

- application/runtime semantics
- domain state shape
- default Claude behavior in interactive hooks
- the existing Codex external-child decision

## Summary

The implementation-ready design for this repo is not "replace `ProcessSpawner` with a universal provider API". It is: keep `ProcessSpawner` as the application port, add an infrastructure-only `SpawnedSessionRunner`, and bridge them with a thin compatibility adapter keyed by `stateDir`. That is the smallest change that fits the current runtime, preserves Claude defaults, treats headless execution as a first-class runner, and creates a real extension seam for later provider work.
