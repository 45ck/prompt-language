import type { SessionState } from '../../domain/session-state.js';

export interface StateStore {
  load(sessionId: string): Promise<SessionState | null>;
  save(state: SessionState): Promise<void>;
  clear(sessionId: string): Promise<void>;
  exists(): Promise<boolean>;
  loadCurrent(): Promise<SessionState | null>;
}
