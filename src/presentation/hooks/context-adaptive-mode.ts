import type { SessionState } from '../../domain/session-state.js';
import type { StateLoadStatus } from '../../infrastructure/adapters/file-state-store.js';

const CURRENT_STATE_VERSION = 1;

export interface ContextAdaptiveModeDecision {
  readonly requestedMode: 'compact';
  readonly actualMode: 'compact' | 'full';
  readonly escalated: boolean;
  readonly triggerIds: readonly string[];
  readonly summary: string;
  readonly markerLine: string;
}

export function selectPreCompactMode(
  state: SessionState,
  loadStatus: StateLoadStatus | null,
): ContextAdaptiveModeDecision {
  const triggerIds: string[] = [];
  const summaryParts: string[] = [];
  const addTrigger = (triggerId: string): void => {
    if (!triggerIds.includes(triggerId)) {
      triggerIds.push(triggerId);
    }
  };

  addTrigger('compaction_boundary');
  summaryParts.push('hook pre-compact crossed a compaction boundary');

  if (loadStatus?.source === 'backup' || loadStatus?.source === 'backup2') {
    addTrigger('resume_boundary');
    addTrigger('state_mismatch');
    summaryParts.push(`state recovered from ${loadStatus.recoveredFrom}`);
  }

  if (loadStatus?.source === 'checksum_sanitized') {
    addTrigger('state_mismatch');
    summaryParts.push('state checksum mismatch required gate-result sanitization');
  }

  if (state.version !== undefined && state.version !== CURRENT_STATE_VERSION) {
    addTrigger('state_mismatch');
    summaryParts.push(
      `state version ${state.version} differs from expected v${CURRENT_STATE_VERSION}`,
    );
  }

  if (
    Object.values(state.nodeProgress).some((progress) => progress.status === 'awaiting_capture')
  ) {
    addTrigger('capture_failure');
    summaryParts.push('capture recovery is active');
  }

  const escalated = triggerIds.length > 0;
  const actualMode = escalated ? 'full' : 'compact';
  const summary =
    summaryParts.length > 0 ? summaryParts.join('; ') : 'no full-required trigger detected';

  return {
    requestedMode: 'compact',
    actualMode,
    escalated,
    triggerIds,
    summary,
    markerLine:
      `[prompt-language] render-mode requested=compact actual=${actualMode} ` +
      `escalated=${escalated} triggerIds=${triggerIds.join(',') || 'none'} ` +
      `sessionId=${state.sessionId}`,
  };
}
