/**
 * InMemoryStateStore — Map-based test double for StateStore.
 */

import type { StateStore } from '../../application/ports/state-store.js';
import type { SessionState } from '../../domain/session-state.js';

export class InMemoryStateStore implements StateStore {
  private readonly store = new Map<string, SessionState>();
  private lastSaved: SessionState | null = null;
  private pendingPrompt: string | null = null;

  async load(sessionId: string): Promise<SessionState | null> {
    return this.store.get(sessionId) ?? null;
  }

  async save(state: SessionState): Promise<void> {
    this.store.set(state.sessionId, state);
    this.lastSaved = state;
  }

  async clear(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
    if (this.lastSaved?.sessionId === sessionId) {
      this.lastSaved = null;
    }
  }

  async exists(): Promise<boolean> {
    return this.store.size > 0;
  }

  async loadCurrent(): Promise<SessionState | null> {
    return this.lastSaved;
  }

  async savePendingPrompt(prompt: string): Promise<void> {
    this.pendingPrompt = prompt;
  }

  async loadPendingPrompt(): Promise<string | null> {
    return this.pendingPrompt;
  }

  async clearPendingPrompt(): Promise<void> {
    this.pendingPrompt = null;
  }

  /** Test helper: return the internal map size. */
  get size(): number {
    return this.store.size;
  }
}
