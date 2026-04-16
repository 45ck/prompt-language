/**
 * SnapshotStorePort — optional capture/restore of the stateDir file tree.
 *
 * PR2 self-hosting primitive. PR1's snapshot/rollback restored only pure
 * state (variables, currentPath, iteration counters). PR2 adds an opt-in
 * file-capture path so a flow that writes files under its stateDir can
 * rollback to an earlier on-disk state.
 *
 * The application layer depends on this interface. Infrastructure adapters
 * own the actual filesystem and archive logic. `NullSnapshotStore` is the
 * default and matches PR1 byte-for-byte behavior when file capture is not
 * enabled via `PL_SNAPSHOT_INCLUDE_FILES`.
 */
export interface SnapshotStorePort {
  /**
   * Capture the contents of `stateDir` and return an opaque reference.
   *
   * Implementations MAY content-address the ref so two captures over
   * identical trees return the same ref (see `FileSnapshotStore`).
   *
   * Implementations MUST reject when the tree exceeds the configured cap.
   * Implementations MUST NOT mutate caller-visible files under `stateDir`;
   * they MAY create entries under a reserved subtree (e.g. `.snapshots/`).
   */
  capture(stateDir: string): Promise<string>;

  /**
   * Restore the tree under `stateDir` from a previously returned ref.
   *
   * Rejects with a clearly-worded error when `ref` is unknown. Atomicity
   * is best-effort at the "extract-then-swap" boundary; see the adapter
   * docs for platform caveats.
   */
  restore(ref: string, stateDir: string): Promise<void>;

  /**
   * Optionally release a previously captured ref. Adapters that
   * content-address MUST refcount so shared tarballs are not deleted
   * while another snapshot still references them.
   */
  cleanup?(ref: string): Promise<void>;
}

/**
 * Null snapshot store — preserves PR1 behavior when file capture is off.
 * `capture()` returns a deterministic sentinel ref; the runtime never
 * consults `NullSnapshotStore` unless the env flag is set, so in practice
 * these methods are not reached during a normal run.
 */
export class NullSnapshotStore implements SnapshotStorePort {
  capture(_stateDir: string): Promise<string> {
    return Promise.reject(new Error('NullSnapshotStore.capture called; file capture is disabled'));
  }

  restore(_ref: string, _stateDir: string): Promise<void> {
    return Promise.reject(new Error('NullSnapshotStore.restore called; file capture is disabled'));
  }
}

export const NULL_SNAPSHOT_STORE: SnapshotStorePort = new NullSnapshotStore();
