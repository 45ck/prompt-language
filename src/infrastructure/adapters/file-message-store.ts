/**
 * FileMessageStore — file-based implementation of the MessageStore port.
 *
 * beads: prompt-language-n6gr
 *
 * Inbox layout:
 *   Send parent → child: writes to {childStateDir}/messages/inbox.json
 *   Child receives:      reads from {childStateDir}/messages/inbox.json
 *   Send child → parent: writes to {parentStateDir}/messages/{childName}/inbox.json
 *   Parent reads child:  reads from {parentStateDir}/messages/{childName}/inbox.json
 *
 * The asymmetry between send and receive is handled by separate path resolvers.
 *
 * Concurrency: read-modify-write is not atomic. For the single-threaded
 * Claude plugin loop this is acceptable. Use file locking if concurrency
 * becomes necessary.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import type { MessageStore, MessageEntry } from '../../application/ports/message-store.js';

export class FileMessageStore implements MessageStore {
  /**
   * @param stateDir    The state directory of the CURRENT process
   *                    (e.g. `/cwd/.prompt-language` or `/cwd/.prompt-language-worker`).
   * @param spawnedChildrenStateDirs  Map of child name → child state dir path,
   *                    used by the parent to locate child inboxes.
   */
  constructor(
    private readonly stateDir: string,
    private readonly spawnedChildrenStateDirs: Readonly<Record<string, string>>,
  ) {}

  async send(target: string, text: string): Promise<void> {
    const inboxPath = this.resolveSendPath(target);
    const existing = await this.readInbox(inboxPath);
    const seq = existing.length > 0 ? (existing[existing.length - 1]?.seq ?? 0) + 1 : 1;
    const entry: MessageEntry = {
      seq,
      timestamp: new Date().toISOString(),
      text,
      consumed: false,
    };
    await this.writeInbox(inboxPath, [...existing, entry]);
  }

  async receive(from: string): Promise<string | undefined> {
    const inboxPath = this.resolveReceivePath(from);
    const existing = await this.readInbox(inboxPath);
    const pendingIdx = existing.findIndex((e) => !e.consumed);
    if (pendingIdx < 0) return undefined;

    const entry = existing[pendingIdx]!;
    const updated = existing.map((e, i) => (i === pendingIdx ? { ...e, consumed: true } : e));
    await this.writeInbox(inboxPath, updated);
    return entry.text;
  }

  /**
   * Resolve where to WRITE a message when sending.
   *
   * send('parent') from child:
   *   → {parentStateDir}/messages/{childName}/inbox.json
   * send('childName') from parent:
   *   → {childStateDir}/messages/inbox.json
   */
  private resolveSendPath(target: string): string {
    if (target === 'parent') {
      const childName = this.deriveChildName();
      const parentStateDir = this.deriveParentStateDir();
      return join(parentStateDir, 'messages', childName, 'inbox.json');
    }

    const childStateDir = this.spawnedChildrenStateDirs[target];
    if (childStateDir) {
      return join(childStateDir, 'messages', 'inbox.json');
    }
    // Fallback: derive child state dir by convention relative to current state dir
    const fallbackDir = join(dirname(this.stateDir), `.prompt-language-${target}`);
    return join(fallbackDir, 'messages', 'inbox.json');
  }

  /**
   * Resolve where to READ messages from a given source.
   *
   * receive('parent') in child:
   *   → {childStateDir}/messages/inbox.json  (parent writes here when sending to this child)
   * receive('childName') in parent:
   *   → {parentStateDir}/messages/{childName}/inbox.json  (child writes here when sending to parent)
   */
  private resolveReceivePath(from: string): string {
    if (from === 'parent') {
      // Child reads from its own inbox (parent writes here)
      return join(this.stateDir, 'messages', 'inbox.json');
    }

    // Parent reads the named child's outbox slot inside the parent state dir
    return join(this.stateDir, 'messages', from, 'inbox.json');
  }

  /** Extract the child name from the state dir basename (e.g. ".prompt-language-worker" → "worker"). */
  private deriveChildName(): string {
    const base = basename(this.stateDir);
    return base.replace(/^\.prompt-language-/, '');
  }

  /** Derive the parent state dir: sibling directory named ".prompt-language". */
  private deriveParentStateDir(): string {
    return join(dirname(this.stateDir), '.prompt-language');
  }

  private async readInbox(inboxPath: string): Promise<MessageEntry[]> {
    try {
      const raw = await readFile(inboxPath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed as MessageEntry[];
    } catch {
      return [];
    }
  }

  private async writeInbox(inboxPath: string, entries: readonly MessageEntry[]): Promise<void> {
    await mkdir(dirname(inboxPath), { recursive: true });
    await writeFile(inboxPath, JSON.stringify(entries, null, 2), 'utf-8');
  }
}
