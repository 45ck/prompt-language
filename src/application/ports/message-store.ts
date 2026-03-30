/**
 * MessageStore — port for file-based parent-child message passing.
 *
 * beads: prompt-language-n6gr
 *
 * Messages are written to and read from inbox files inside the state
 * directory. The application layer depends only on this interface;
 * the infrastructure adapter owns the actual file I/O.
 *
 * Inbox layout (relative to the session state dir):
 *   messages/{target}/inbox.json   — list of MessageEntry
 *
 * "parent" is a reserved target name for messages directed back to the
 * spawning process.
 */

export interface MessageEntry {
  /** Monotonically increasing sequence number (set by the store). */
  readonly seq: number;
  /** ISO 8601 timestamp. */
  readonly timestamp: string;
  /** Resolved message text. */
  readonly text: string;
  /** Whether the message has been consumed by a receive node. */
  readonly consumed: boolean;
}

export interface MessageStore {
  /**
   * Write a message to the named target's inbox.
   *
   * `target` is either a child spawn name or the literal string "parent".
   * The store resolves the inbox file path relative to the appropriate
   * state directory.
   */
  send(target: string, text: string): Promise<void>;

  /**
   * Read the oldest unconsumed message from the named source's inbox
   * and mark it consumed. Returns `undefined` when no pending message exists.
   *
   * `from` is either a child spawn name or "parent".
   */
  receive(from: string): Promise<string | undefined>;
}
