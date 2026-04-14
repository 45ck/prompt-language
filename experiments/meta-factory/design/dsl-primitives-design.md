# Self-Hosting DSL Primitives — Design

Design handshake produced before implementation of the four self-hosting
primitives from META-1 MD-4: `snapshot`, `rollback`, `diff-review human`,
`self-trace-replay`. Implementation is split into four sequential PRs
because the primitives interact (rollback semantics depend on snapshot
shape; trace replay requires a chain verifier port) and because skipping
the design handshake risks corrupting `SessionState` immutability and
hash-chain invariants that the existing trace verification relies on.

## 1. Entity model — `SessionState.snapshots`

```ts
// src/domain/session-state.ts
export interface StateSnapshot {
  readonly name: string;
  readonly createdAt: string;
  readonly stateHash: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly currentPath: readonly number[];
  readonly iterations: Readonly<Record<string, number>>;
  readonly filesDigestRef?: string;
}

export interface SessionState {
  // existing fields unchanged
  readonly snapshots: Readonly<Record<string, StateSnapshot>>;
}
```

Key decisions:

- Keyed by `name`; last-write-wins.
- Snapshot captures only the subset of state that is safe to restore —
  variables, currentPath, iteration counters. Intentionally excludes
  `spawnedChildren`, `completed`, `failed`, `warnings`, and trace
  sequence numbers. Restoring those would violate trace monotonicity and
  orphan live child processes.
- `filesDigestRef` is opaque to domain; infrastructure `SnapshotStore`
  adapter resolves it.

## 2. Ports

```ts
// src/application/ports/snapshot-store-port.ts
export interface SnapshotStorePort {
  capture(stateDir: string): Promise<string>;
  restore(ref: string, stateDir: string): Promise<void>;
}

// src/application/ports/trace-reader-port.ts
export interface TraceReaderPort {
  read(dir: string, runId: string): Promise<readonly TraceEntry[] | null>;
}
```

Adapters live in `src/infrastructure/adapters/`. Keep `fs`, `tar`, and
`node:crypto` out of the domain boundary.

## 3. Transaction boundaries

- `snapshot`: atomic state mutation — `{...state, snapshots: {...state.snapshots, [name]: snap}}`.
  File capture happens outside the domain transition; `filesDigestRef`
  is written back via a second domain call after capture succeeds. If
  capture fails, the snapshot is still recorded without `filesDigestRef`
  and a warning is appended; the flow never fails.
- `rollback`: two-phase. Phase 1 (pure) applies variables/path/iterations
  from the snapshot, leaving `snapshots`, `spawnedChildren`, `completed`,
  `failed`, and trace state untouched. Phase 2 (infra, optional) calls
  `SnapshotStorePort.restore(ref, stateDir)` if a ref is present. If file
  restore fails, emit `state_mutation` with `detail.fileRestoreFailed=true`
  and continue. **Do not re-run node execution**: `currentPath` jumps to
  the snapshot's recorded path, not past it.
- `diff-review`: pauses the flow; no state mutation beyond a pause-reason
  record. Diff-hash computation is an infra call (git or hasher port); the
  result is passed into the node as a pre-computed string.
  `PL_DIFF_REVIEW_AUTO` is read in infrastructure, never domain. Domain
  exposes an optional `autoDecision` on the node.
- `self-trace-replay`: read-only w.r.t. the replayed file. Sets
  `replay.*` variables via the existing `setVariable()` path. Must never
  throw — failure sets `replay.success="false"` and `replay.error=msg`.

## 4. Error model

| Primitive | Failure | Behavior |
| --- | --- | --- |
| `snapshot` | duplicate name | overwrite silently; warning `snapshot "<name>" overwritten` |
| `snapshot` | file capture fails | record snapshot without `filesDigestRef`; warning |
| `rollback` | unknown name | pause with `failureReason: "rollback: no snapshot named <name>"`. Do NOT `markFailed` — let `try`/`catch` recover |
| `rollback` | file restore fails | advance anyway; warning recorded |
| `diff-review` | no auto, no operator | pause (share `approve` pause infra) |
| `diff-review` | `PL_DIFF_REVIEW_AUTO=reject` | set `diff_review_rejected="true"`; advance |
| `self-trace-replay` | dir/file missing, parse error, invalid chain | set `replay.success="false"`, `replay.error=<msg>`, `replay.entries_count="0"`; advance |

All four auto-advance on success (except `diff-review` human pause).
None call `markFailed()`: meta-flows must stay in control.

## 5. Parser shape

- `snapshot "name"` — single-line, no block. Bareword fallback is a
  footgun because of variable interpolation collision; require quotes as
  canonical, accept bareword only if it matches
  `[A-Za-z_][A-Za-z0-9_-]*` and emit a parse warning.
- `rollback to "name"` — require the `to` keyword; error if absent.
- `diff-review human` — block form; `human` required (forward compat for
  `auto`/`ci`). `summary:` and `paths:` modifiers parse identically to
  existing `timeout:` on `approve`.
- `self-trace-replay "id" [from "dir"]` — single-line. `from` optional.
  Trailing modifier pattern matches existing `spawn ... cwd "..."`.

## 6. State-hash chain

`snapshot` and `rollback` emit normal `node_advance` trace entries with
correct `stateBeforeHash`/`stateAfterHash`. For `rollback`, the
post-state hash will NOT equal the snapshot's recorded hash (because
`snapshots`, trace seq, etc. differ). Include `detail.rolledBackTo:
<name>` and `detail.restoredStateHash: <snapshot.stateHash>` so verifiers
can correlate without being confused by hash drift.

## 7. Risks and guards

| Risk | Severity | Guard |
| --- | --- | --- |
| Rollback resurrects `currentPath` inside a loop whose iteration counter was reset, re-running side effects | HIGH | Parser warning when `snapshot` appears inside `while`/`foreach`/`retry` |
| Rollback while spawned children are live — children keep running, parent forgets about them | HIGH | `snapshots` deliberately excludes `spawnedChildren` |
| Exhaustive switch update burden — 4 new kinds × many switches; TS catches it, lint/coverage may not | MED | Update every `kind: 'return'` sentinel case simultaneously |
| `PL_SNAPSHOT_INCLUDE_FILES=1` with large `.prompt-language/` — unbounded memory/disk | MED | 10 MB cap; refuse and warn above |
| `self-trace-replay` on a concurrently-being-written `provenance.jsonl` reads partial trailing line | MED | Tolerate trailing partial JSON; count only fully-parsed entries; never throw |
| `snapshot` bareword collides if a user later defines variable named `snapshot` | LOW | Reserved keyword; reject as variable name |
| `SessionState.snapshots` collides with existing serialization fixtures | LOW | Default `{}`; backwards-compatible via `createSessionState` |
| Chain verifier duplicated between `.mjs` and `.ts` | LOW | Parity test over hand-crafted 3-entry trace |
| Smoke test id collision with concurrent agents | LOW | Coordinate via git; use the highest unused letter |

## 8. Implementation PR split

Do not attempt in a single pass. Split into four sequential PRs, each
≤ 400 LOC with individually green CI + targeted smoke:

1. **PR1 — snapshot + rollback (state-only, no file capture)**. Smallest
   risk; unblocks meta-factory atomic checkpointing. `SnapshotStorePort`
   stubbed with a null adapter.
2. **PR2 — `SnapshotStorePort` file capture/restore adapter**. Env-gated.
   Independent test.
3. **PR3 — diff-review human**. Shares `approve`'s pause plumbing; adds
   diff-hash field.
4. **PR4 — self-trace-replay + `TraceReaderPort` + TS port of chain
   verifier**. Parity test with the `.mjs` verifier.

## 9. Files likely touched

- `src/domain/flow-node.ts` — add 4 kinds, factories, update every
  exhaustive switch (~8-15 sites)
- `src/domain/session-state.ts` — `snapshots` field +
  `addSnapshot`/`applySnapshot` transitions
- `src/application/parse-flow.ts` — 4 new line/block parsers
- `src/application/advance-flow.ts` — 4 new advancement functions
- `src/domain/render-flow.ts` — 4 new render branches
- `src/application/ports/snapshot-store-port.ts` — new
- `src/application/ports/trace-reader-port.ts` — new
- `src/domain/verify-trace.ts` — new (TS port of
  `scripts/eval/provenance-schema.mjs`)
- `src/infrastructure/adapters/file-snapshot-store.ts` — new
- `src/infrastructure/adapters/file-trace-reader.ts` — new
- `scripts/eval/smoke-test.mjs` — add test per PR
- `CLAUDE.md` — update DSL primitives list
