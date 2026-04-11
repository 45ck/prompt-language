# Design: Generic Agent Runner Abstraction

## Status

Proposed architecture note for bead `prompt-language-9uqe.4`.

Primary related notes:

- [Host Lifecycle Boundary](host-lifecycle-boundary.md)
- [Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md)
- [Codex External Child-Session Decision](codex-external-child-session-decision.md)

## Question

Can prompt-language define a provider-neutral contract for spawned child sessions without pretending that Claude, Codex, and OpenCode already share one identical host lifecycle?

## Decision

Yes. Add a **provider-neutral spawned-session runner contract** as an adapter-facing abstraction below the runtime's `spawn` / `await` semantics.

The contract should normalize:

- launch intent
- workspace and session continuity inputs
- provider, model, and environment pass-through
- result capture
- capability reporting

It should **not** claim that all providers support the same session lifecycle. Instead, each provider adapter reports its own capabilities and chooses its own launch and capture strategy.

The current Claude path remains the **backward-compatible default behavior** until another provider-specific adapter is explicitly selected.

## Why this layer exists

The repo already has two different child-work shapes:

- `ClaudeProcessSpawner` launches an external `claude -p` child process and polls file-backed state
- `HeadlessProcessSpawner` runs child work in-process for headless Codex/OpenCode-style runner flows

Both satisfy the runtime's current `ProcessSpawner` port, but they hide provider differences inside ad hoc adapter logic. A generic runner layer gives the repo one place to describe:

- what a spawned child session needs
- how provider-specific launch details are injected
- which lifecycle features are actually supported

That improves clarity without widening the language surface.

## Boundary

This note does **not** propose:

- new DSL syntax
- a promise of full Claude/Codex/OpenCode lifecycle parity
- changes to `spawn` / `await` semantics
- a host-extension management plane

It proposes an internal contract that provider adapters can implement or emulate.

## Placement

The abstraction belongs below the runtime and above provider-specific launchers.

Suggested layering:

- runtime keeps using `spawn` / `await` as prompt-language concepts
- the current `ProcessSpawner` remains the narrow runtime port for now
- a new `SpawnedSessionRunner` sits behind provider adapters and can back `ProcessSpawner` implementations

That keeps the language stable while giving infrastructure a cleaner provider-neutral seam.

## Contract shape

```ts
export interface SpawnedSessionLaunch {
  readonly name: string;
  readonly goal: string;
  readonly flowText: string;
  readonly stateDir: string;
  readonly cwd?: string | undefined;
  readonly provider?: string | undefined;
  readonly model?: string | undefined;
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly session?:
    | {
        readonly parentSessionId?: string | undefined;
        readonly childSessionId?: string | undefined;
        readonly resumeToken?: string | undefined;
        readonly continuity: 'fresh' | 'resume' | 'provider-managed';
      }
    | undefined;
  readonly workspace?:
    | {
        readonly mode: 'inherit' | 'state-dir' | 'worktree' | 'provider-managed';
        readonly root?: string | undefined;
      }
    | undefined;
  readonly launch?:
    | {
        readonly executable?: string | undefined;
        readonly args?: readonly string[] | undefined;
      }
    | undefined;
}

export interface SpawnedSessionHandle {
  readonly runId: string;
  readonly provider: string;
  readonly stateDir: string;
  readonly pid?: number | undefined;
  readonly externalSessionId?: string | undefined;
  readonly captureMode: 'state-file' | 'stdout-json' | 'memory' | 'provider-api';
}

export interface SpawnedSessionResult {
  readonly status: 'running' | 'completed' | 'failed';
  readonly variables?: Readonly<Record<string, string>> | undefined;
  readonly summary?: string | undefined;
  readonly error?: string | undefined;
  readonly exitCode?: number | undefined;
  readonly rawOutputRef?: string | undefined;
}

export interface SpawnedSessionCapabilities {
  readonly externalProcess: boolean;
  readonly terminate: boolean;
  readonly cwdOverride: boolean;
  readonly customEnv: boolean;
  readonly modelPassThrough: boolean;
  readonly providerPassThrough: boolean;
  readonly sessionResume: boolean;
  readonly worktreeIsolation: boolean;
  readonly stateDirPolling: boolean;
  readonly structuredStdout: boolean;
  readonly providerManagedSessionId: boolean;
  readonly inProcessFallback: boolean;
}

export interface SpawnedSessionRunner {
  capabilities(provider?: string): SpawnedSessionCapabilities;
  launch(input: SpawnedSessionLaunch): Promise<SpawnedSessionHandle>;
  poll(handle: SpawnedSessionHandle): Promise<SpawnedSessionResult>;
  terminate?(handle: SpawnedSessionHandle): Promise<boolean>;
}
```

## Field responsibilities

### Launch command

`launch.executable` and `launch.args` allow an adapter to accept an explicit command shape when the caller already knows it, but the normal rule should be:

- runtime declares intent
- provider adapter resolves the actual command

That prevents prompt-language runtime code from hard-coding `claude`, `codex`, or `opencode` launch details.

### Workspace handling

`workspace.mode` makes isolation explicit instead of implicit.

Recommended meanings:

- `inherit`: child shares the parent workspace root
- `state-dir`: child uses the same workspace but writes lifecycle artifacts under `stateDir`
- `worktree`: child gets an isolated worktree or sandbox workspace
- `provider-managed`: the provider owns workspace or session storage outside the repo

This keeps worktree and sandbox support additive instead of assumed.

### Session handling

`session.continuity` is the contract's honesty mechanism.

- `fresh`: start a new child session
- `resume`: reopen a known child session if the provider supports it
- `provider-managed`: defer continuity to the provider's own session abstraction

The contract can carry `childSessionId` or `resumeToken` without claiming every provider can honor them.

### Env, model, and provider pass-through

The launch input intentionally separates:

- `provider`: which adapter family to use
- `model`: which model hint to pass through
- `env`: provider- or host-specific environment additions

This is enough for current and near-term needs:

- Claude needs model and `PROMPT_LANGUAGE_STATE_DIR`
- Codex may need model plus different CLI or JSON-mode arguments
- OpenCode may need provider-routed model names and API-key-backed environment variables

The runtime should pass these through only when the chosen adapter reports support.

### Result capture

`captureMode` and `SpawnedSessionResult` normalize child completion without forcing one transport.

Supported capture families:

- `state-file`: poll `session-state.json` or similar child-owned artifacts
- `stdout-json`: parse structured CLI output
- `memory`: in-process child execution returns final state directly
- `provider-api`: poll a provider session or run API

The runtime cares about normalized status and imported variables, not the transport.

## Capability flags

Capability flags are required so prompt-language does not silently assume unsupported behavior.

Minimum flag meanings:

| Flag                       | Meaning                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `externalProcess`          | Child work runs in a separate OS process                         |
| `terminate`                | Adapter can attempt best-effort termination                      |
| `cwdOverride`              | Caller may choose a child working directory                      |
| `customEnv`                | Adapter accepts additional environment variables                 |
| `modelPassThrough`         | Adapter can forward a model selection                            |
| `providerPassThrough`      | Adapter can switch behavior based on provider identity           |
| `sessionResume`            | Adapter can resume an existing child session                     |
| `worktreeIsolation`        | Adapter can launch child work in an isolated worktree or sandbox |
| `stateDirPolling`          | Adapter supports file-backed polling                             |
| `structuredStdout`         | Adapter can return machine-readable terminal output              |
| `providerManagedSessionId` | Adapter returns a durable external session identifier            |
| `inProcessFallback`        | Adapter can execute child work without a second external session |

These flags should be surfaced in diagnostics and future support matrices.

## Backward-compatible Claude default

This abstraction should not change current shipped behavior by default.

Default rule:

- if no provider is specified for interactive spawned-child execution, use the current Claude-backed adapter behavior

That means the effective default remains:

- launch `claude -p`
- pass `--model` only when a non-empty model is supplied
- set `PROMPT_LANGUAGE_STATE_DIR`
- inherit the current workspace unless spawn-level `cwd` overrides it
- capture completion through child state files in the spawn state directory

This preserves the repo's current Claude continuity story while making the abstraction ready for other providers.

## Provider mappings

### Claude

Claude is the default external-child implementation.

Recommended capability profile:

- `externalProcess: true`
- `terminate: true`
- `cwdOverride: true`
- `customEnv: true`
- `modelPassThrough: true`
- `providerPassThrough: false`
- `sessionResume: false`
- `worktreeIsolation: false`
- `stateDirPolling: true`
- `structuredStdout: false`
- `providerManagedSessionId: false`
- `inProcessFallback: false`

### Codex

This note should not reopen the existing Codex decision. The current honest Codex story in this repo is still the headless or supervised path documented in [Codex External Child-Session Decision](codex-external-child-session-decision.md).

Recommended near-term Codex profile:

- support `provider` and `model` pass-through
- allow either `memory` capture or structured CLI capture
- report `inProcessFallback: true` for the current shipped headless path
- report `externalProcess` and `sessionResume` only when a dedicated external-child adapter actually exists

In other words: the contract can represent future Codex external-child work, but it must not pretend that work is already shipped.

### OpenCode

OpenCode should be treated the same way: the abstraction may carry provider and model routing now, while capability flags state exactly what the repo can truly do.

Recommended near-term OpenCode profile:

- `providerPassThrough: true`
- `modelPassThrough: true`
- `customEnv: true`
- choose `memory`, `stdout-json`, or `provider-api` capture depending on the actual launcher
- leave `sessionResume` and `worktreeIsolation` false until verified

This keeps OpenCode additive and evidence-driven rather than aspirational.

## Migration path

1. Keep `ProcessSpawner` as the runtime-facing port for current code.
2. Introduce `SpawnedSessionRunner` as infrastructure-facing adapter contract.
3. Re-express `ClaudeProcessSpawner` in terms of a Claude runner profile.
4. Let headless Codex/OpenCode paths implement the same contract via `memory` capture.
5. Add diagnostics so support matrices report actual child-session capabilities by provider.

This sequence avoids a large rewrite and preserves current behavior.

## Consequences

What this improves:

- provider-specific child-launch logic becomes explicit and easier to compare
- model, provider, and environment pass-through stop being Claude-only assumptions
- result capture becomes normalized across external and in-process children
- future Codex/OpenCode work gains a contract without overclaiming parity

What this intentionally does not solve yet:

- generic host lifecycle parity
- worktree-based merge isolation
- provider-managed session restore guarantees
- rich child telemetry beyond normalized completion and variables

## Follow-up links

Codex follow-up:

- [Codex External Child-Session Decision](codex-external-child-session-decision.md)
- [Codex Parity Delta Analysis](../evaluation/codex-parity-delta-analysis.md)

OpenCode follow-up:

- [OpenCode Gemma 4 Plan](../evaluation/opencode-gemma-plan.md)
- [OpenCode Minimal Gate Subset](../evaluation/opencode-minimal-gate-subset.md)

Shared adapter boundary:

- [Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md)

## Summary

prompt-language should define one provider-neutral spawned-session runner contract, but it should use capability flags and capture modes to stay honest about provider differences. Claude remains the default external-child behavior. Codex and OpenCode can plug into the same contract only to the extent that checked-in evidence supports their actual capabilities.
