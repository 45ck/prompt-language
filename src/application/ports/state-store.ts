import type { SessionState } from '../../domain/session-state.js';

export interface StateStore {
  load(sessionId: string): Promise<SessionState | null>;
  save(state: SessionState): Promise<void>;
  clear(sessionId: string): Promise<void>;
  exists(): Promise<boolean>;
  loadCurrent(): Promise<SessionState | null>;

  /** Store a pending NL prompt for the confirmation round-trip. */
  savePendingPrompt(prompt: string): Promise<void>;
  /** Load a previously stored pending NL prompt, or null if none. */
  loadPendingPrompt(): Promise<string | null>;
  /** Clear any stored pending NL prompt. */
  clearPendingPrompt(): Promise<void>;
}
