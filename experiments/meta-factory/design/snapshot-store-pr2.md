# Snapshot Store — PR2 Design (Optional File Capture)

Status: Design-only. Depends on PR1 (state-only snapshot/rollback semantics and
the `StateSnapshot` shape with its `filesDigestRef?: string` field). PR2 must
not land until PR1 is merged; if PR1's shape changes, Section 3 and Section 5
here need a revision pass.

## 1. Problem

PR1 gives us `snapshot "name"` and `rollback to "name"` over pure session
state: variables, current node path, and per-node iteration counters. That is
enough for flows whose only side effects are variable assignments and control
flow. It is not enough for meta-flows that write files.

Concretely: a meta-flow generates source code under `out/`, runs a tool, and
then decides to rollback to an earlier branching decision. Under PR1, the
variables revert, the cursor moves back, and the loop iteration counters reset
— but the generated files stay. On the next iteration the flow sees a workspace
that disagrees with its restored beliefs. That is exactly the self-hosting loop
(a flow generating and judging generated code) we want to make honest.

PR2's job: let a snapshot optionally capture the `stateDir` file tree so a
rollback can restore it. This is opt-in, narrowly scoped to the plugin's own
`stateDir`, capped, and additive to PR1.

## 2. Scope

In scope:
- New port `SnapshotStorePort` with `capture(stateDir)` / `restore(ref, stateDir)` / optional `cleanup(ref)`.
- New adapter `FileSnapshotStore` implementing capture via tar-gzip, restore via extract, keyed by sha256.
- A `NullSnapshotStore` default adapter so `PL_SNAPSHOT_INCLUDE_FILES` unset means byte-for-byte PR1 behavior.
- Wiring in `advance-flow.ts` so the `SnapshotNode` advancement calls `capture()` under the env flag and writes `filesDigestRef` onto the `StateSnapshot`, and the `RollbackNode` advancement calls `restore()` when `filesDigestRef` is present.
- 10 MB cap (overridable by env) with a clear error message on over-cap captures.
- Trace detail fields on existing `node_advance` events: `filesCaptured`, `filesDigestRef`, `filesRestored`.

Out of scope: see Section 9.

## 3. Port contract

`src/application/ports/snapshot-store.ts`:

- `capture(stateDir: string): Promise<string>` — returns an opaque ref string.
  - Must throw synchronously-via-Promise-rejection if `stateDir` exceeds the cap.
  - Two successive captures over the same unchanged tree MAY return identical refs (content-addressed) or distinct refs (timestamped). `FileSnapshotStore` chooses content-addressed: identical content → identical ref. This is the "same semantics, possibly the same ref" contract.
  - Must not mutate caller-visible files under `stateDir`. It may create entries under a reserved `<stateDir>/.snapshots/` subtree.
  - Must be safe to call concurrently from the same process; see Section 4 for the concurrency decision.
- `restore(ref: string, stateDir: string): Promise<void>` — replaces stateDir contents with the captured tree.
  - Must reject with a clearly-worded error if `ref` is unknown ("snapshot ref <ref> not found; cannot restore files").
  - Atomicity: not filesystem-atomic in the strict sense. The adapter extracts into a sibling temp directory and then performs a rename-swap of the live tree. On Windows, rename-swap of non-empty directories is not atomic; we document the weaker guarantee: "restore is all-or-nothing at the temp-extract boundary; if the final swap is interrupted, a `.snapshots/restore-in-progress` marker is left behind and subsequent restores detect and complete it." That lets us promise "no partially-extracted tar" while being honest that directory swap is best-effort on Windows.
- `cleanup(ref)?` — optional. `FileSnapshotStore` implements it as "delete the tar for this ref if no other snapshot references it." Null adapter returns undefined for the whole method.

Rationale for port-not-inlined: matches PR1's pattern (audit-logger, state-store, memory-store). Lets tests substitute an in-memory store. Lets future adapters (S3, content-addressed store) slot in without a schema change.

## 4. Adapter: FileSnapshotStore

Implementation plan:

- Tar-gzip the `stateDir` into a temp file at `<stateDir>/.snapshots/tmp-<pid>-<counter>.tar.gz`. Excludes `.snapshots/` itself to prevent recursive inflation.
- Compute sha256 of the finalized gzip'd tar; rename to `<stateDir>/.snapshots/<sha256>.tar.gz`. Ref = sha256 hex.
- Size check *before* tar'ing: walk `stateDir` (excluding `.snapshots/`), sum file byte sizes. If over cap, throw `Error("snapshot capture exceeds PL_SNAPSHOT_MAX_MB cap of <N> MB; measured <M> MB under <stateDir>")`. This avoids unbounded RAM/disk from streaming a huge tar only to reject it.
- Restore: verify ref exists → extract into `<stateDir>/.snapshots/restore-<ref>-<pid>/` → create `<stateDir>/.snapshots/restore-in-progress` marker file pointing at that temp dir → delete every entry under `stateDir` except `.snapshots/` → move extracted entries into place → delete marker. On start, `restore()` first checks for a stale marker and completes or aborts with a clear diagnostic.

Fine-grained decisions (rationale each):

- **Symlinks: dereference into regular files on capture.** Rationale: stateDir is plugin-owned; symlinks escaping the dir are not legitimate plugin state, and dereferencing keeps the restored tree self-contained across machines.
- **Permissions bits: captured but not restored on Windows.** Rationale: POSIX mode bits in tar are meaningful on Linux/macOS and noise on NTFS; attempting to re-apply them on Windows produces warnings without value. Restore on POSIX applies the stored bits; restore on Windows logs a one-shot "mode bits skipped" diagnostic into the session warning array.
- **Windows 260-char path limit: reject at capture with an explicit error listing the offending path.** Rationale: silently truncating or UNC-prefixing makes restore non-portable. Operators opting into file capture on Windows must know their path budget.
- **Unicode filenames: UTF-8 in tar headers (PAX).** Rationale: matches node-tar defaults and avoids legacy ustar 100-byte truncation.
- **Concurrent captures from nested meta-flows: per-stateDir advisory lock at `<stateDir>/.snapshots/.lock`.** Rationale: two captures racing into the same stateDir could produce a tar that sees a half-written file from the other capture; the lock serializes captures within a process tree. Lock is best-effort (lockfile with pid+mtime, stale after 60s) — not a distributed lock.

## 5. Integration with advance-flow

Pseudocode sketch (prose, not code):

For `SnapshotNode`:
1. Build the pure `StateSnapshot` per PR1.
2. If `deps.snapshotStore != null` and `env.PL_SNAPSHOT_INCLUDE_FILES === '1'`, `await deps.snapshotStore.capture(deps.stateDir)` → `ref`. Attach `ref` as `filesDigestRef` on the snapshot.
3. `addSnapshot(state, snapshot)`.
4. Emit `node_advance` with `detail.filesCaptured: true` and `detail.filesDigestRef: ref` when capture ran; otherwise omit both fields (don't emit `filesCaptured: false` — absent is the PR1-compatible signal).

For `RollbackNode`:
1. Look up `state.snapshots[name]`. If missing, fail per PR1.
2. Apply pure-state restore first (`applySnapshot`).
3. If the snapshot has a `filesDigestRef` and `deps.snapshotStore != null`, `await deps.snapshotStore.restore(ref, deps.stateDir)`.
4. Emit `node_advance` with `detail.filesRestored: true` when restore ran.

Failure handling: if `restore()` rejects, the pure state has already been applied. We surface a `markFailed` with reason `"rollback files failed: <msg>"` so the operator sees divergence rather than continuing on a half-restored workspace. This is a deliberate asymmetry: state restore is cheap and already reversible by normal flow; file restore failing is catastrophic for correctness.

Storage of the ref: `snapshots[name].filesDigestRef` (already present on `StateSnapshot` from PR1).

Backward compatibility: PR2 changes no schema. With `PL_SNAPSHOT_INCLUDE_FILES` unset, the snapshot store is never consulted, `filesDigestRef` stays undefined, and behavior is identical to PR1.

## 6. Env controls

- `PL_SNAPSHOT_INCLUDE_FILES=1` — enables capture at snapshot nodes. Unset/any-other-value: state-only PR1 behavior.
- `PL_SNAPSHOT_MAX_MB=<N>` — integer MB cap. Default 10.
- `PL_SNAPSHOT_STORE_DIR=<path>` — overrides `<stateDir>/.snapshots/`. Used by tests to point at a tmpdir outside the workspace, and by CI to route to a scratch volume.

All three are read through the existing env-reader port, not `process.env` directly. Tests inject fake env readers.

## 7. Tests required before PR2 can land

- Unit (`FileSnapshotStore`):
  - Round-trip on a 5-file tree with mixed sizes (bytes / KB / one 1 MB file); assert file contents, relative paths, and (on POSIX) mode bits match after restore.
  - 10 MB cap: capture of an 11 MB tree rejects with the exact error string.
  - Restore on unknown ref rejects with the exact error string.
  - Concurrent capture stress: two `capture()` calls from the same process against the same stateDir both resolve to valid refs; neither tar contains half-written content.
  - Windows path-length: simulated path > 260 chars rejects with the offending path in the message. (Skipped on POSIX with `it.skipIf`.)
  - Stale restore marker recovery: seed a marker file, call `restore()`, assert the marker is either completed or aborted-with-diagnostic.
- Integration (advance-flow):
  - `SnapshotNode` advancement with `PL_SNAPSHOT_INCLUDE_FILES=1` records `filesDigestRef`; without the flag, it does not.
  - `RollbackNode` advancement with `filesDigestRef` present restores files; without it, falls back to PR1 pure-state behavior.
  - Restore failure surfaces as `markFailed` with the expected reason prefix.
- Smoke (`scripts/eval/smoke-test.mjs`): a new test (e.g. "AG") that runs a flow which snapshots with the env flag, writes a file via `run:`, rolls back, and asserts the file is gone. Gated by `PL_SNAPSHOT_INCLUDE_FILES=1` in the smoke harness env.

## 8. Risks specific to PR2

- **Destructive restore (highest user-visible risk).** `restore()` deletes modified files in `stateDir`. Opt-in via env flag and the explicit `rollback to` DSL gesture both exist; documentation must call out the "you will lose uncommitted workspace edits under stateDir" contract in bold.
- **Cross-platform tar handling (highest implementation risk — this is the one I'd flag highest).** Symlinks, permissions, Unicode normalization on macOS (NFD vs NFC), Windows path length, and mid-write rename semantics are all individually small but collectively the largest source of latent bugs. Mitigation: node-tar with explicit options; the capture/restore round-trip test must run in CI on both a POSIX and a Windows runner before PR2 ships.
- **Nested meta-flows filling disk.** A meta-flow that loops and snapshots each iteration accumulates tarballs. `cleanup()` is optional and not auto-called; the operator must choose to prune. Document this and expose a lifecycle hook in Section 5's ref bookkeeping so a follow-up PR can add auto-prune without a schema change.
- **10 MB cap is arbitrary.** Picked to make "meta-flow writing a small `out/` tree" work while rejecting "someone pointed snapshot at a node_modules." Revisit after one self-hosting experiment runs end-to-end.
- **Ref reuse via content addressing is a subtle trap.** Two snapshots over identical trees share one tarball. If `cleanup(refA)` is called, it must refcount, not blind-delete, or `refB` breaks. Section 4 addresses this; the test suite must cover it.

## 9. What is NOT in PR2

- Capturing anything outside `stateDir` (e.g. repo root, `out/` as a sibling).
- Remote storage backends (S3, GCS, HTTP). Port shape is compatible with a future `S3SnapshotStore` — no schema migration needed.
- Integration with diff-review (PR3). PR3 will likely consume `filesDigestRef` but that wiring belongs there.
- Automatic snapshot pruning or retention policy.
- Capturing process state (open file handles, in-flight child processes).

## 10. Implementation order (each step ≤ ~250 LOC)

1. `SnapshotStorePort` interface + `NullSnapshotStore` default. Wire it into the dependency bag consumed by advance-flow. No behavior change because `NullSnapshotStore.capture` is never called (advance-flow gates on the env flag).
2. `FileSnapshotStore` adapter: capture, restore, cleanup, size check, lock, marker recovery.
3. Extend `advanceSnapshotNode` and `advanceRollbackNode` in `advance-flow.ts` to consult `deps.snapshotStore` and emit the new trace detail fields.
4. DI wiring in `bin/cli.mjs` and hook entry points — select `FileSnapshotStore` when `PL_SNAPSHOT_INCLUDE_FILES=1`, else `NullSnapshotStore`.
5. Unit tests, integration tests, smoke test AG. Documentation update in README and CLAUDE.md's "Built-in variables" area noting the new env flags.

## Assumptions and open questions

- Assumes PR1 lands the `filesDigestRef?: string` field on `StateSnapshot` exactly as currently in `src/domain/session-state.ts`. Confirmed present at time of writing.
- Assumes `stateDir` is always the plugin's `.prompt-language-*` directory and never a user-chosen path. If that changes, the "delete everything not under .snapshots/" rule becomes unsafe.
- Open: should `capture()` also snapshot open session-state.json, or rely on the state-store adapter to have flushed it already? Current answer: rely on the adapter; snapshot nodes advance synchronously after state writes, so the on-disk state is current. Worth verifying with the test-designer when PR2 tests are written.
- Open: Windows CI coverage. If we can't get a Windows runner in CI for PR2, the cross-platform risk is mitigated only by local testing, which is weaker than it should be.
