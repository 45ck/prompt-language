/**
 * MemoryStore — port for persistent memory storage.
 *
 * beads: prompt-language-7g58
 *
 * Reads and writes `.prompt-language/memory.json`. The application layer
 * depends only on this interface; the infrastructure adapter owns the
 * actual file I/O.
 */

export interface MemoryEntry {
  /** ISO 8601 timestamp. */
  readonly timestamp: string;
  /** Free-form text memory (mutually exclusive with key/value). */
  readonly text?: string | undefined;
  /** Named key for key-value storage. */
  readonly key?: string | undefined;
  /** Named value for key-value storage. */
  readonly value?: string | undefined;
}

export interface MemoryStore {
  /**
   * Append or replace an entry to persistent memory.
   *
   * If `entry.key` is set, any existing entry with the same key is replaced
   * (last-write-wins). Free-form `text` entries are always appended.
   */
  append(entry: MemoryEntry): Promise<void>;

  /**
   * Find the most recent entry for a named key.
   * Returns `undefined` when no entry exists for that key.
   */
  findByKey(key: string): Promise<MemoryEntry | undefined>;

  /**
   * Read all entries from memory.
   * Returns an empty array when the memory file does not exist.
   */
  readAll(): Promise<readonly MemoryEntry[]>;
}
