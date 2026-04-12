export type CompactRenderTriggerId =
  | 'resume_boundary'
  | 'state_mismatch'
  | 'gate_uncertainty'
  | 'capture_failure'
  | 'spawn_uncertainty';

export interface CompactRenderModeDecision {
  readonly requestedMode: 'compact';
  readonly actualMode: 'compact' | 'full';
  readonly escalated: boolean;
  readonly triggerIds: readonly CompactRenderTriggerId[];
  readonly summary: string;
}

const GATE_PENDING_RE = /^\s+[\w:-]+\s+\[pending\]\s*$/m;
const RESUME_BOUNDARY_RE = /\[resumed from [^\]]+\]/i;
const CAPTURE_RECOVERY_RE =
  /\[Internal — prompt-language (?:variable|JSON) capture:|\[Capture active:/;
const STATE_MISMATCH_RE =
  /\bPLR-004\b|\bchecksum mismatch\b|\bstate version\b|\bstate recovered from\b/i;
const AWAIT_NODE_RE = /^\s*[~>| ]*\s*await\b/im;
const RUNNING_SPAWN_RE = /^\s*[~>| ]*\s*spawn\s+"[^"]+"\s+\[(?:running|failed)\]/im;

export function selectCompactRenderModeForEnvelope(prompt: string): CompactRenderModeDecision {
  const triggerIds: CompactRenderTriggerId[] = [];
  const summaryParts: string[] = [];

  const addTrigger = (triggerId: CompactRenderTriggerId, summary: string): void => {
    if (!triggerIds.includes(triggerId)) {
      triggerIds.push(triggerId);
      summaryParts.push(summary);
    }
  };

  const trimmed = prompt.trim();
  if (!trimmed.startsWith('[prompt-language] Flow:')) {
    return {
      requestedMode: 'compact',
      actualMode: 'compact',
      escalated: false,
      triggerIds,
      summary: 'not a prompt-language flow envelope',
    };
  }

  const crossedResumeBoundary = RESUME_BOUNDARY_RE.test(trimmed);
  if (crossedResumeBoundary) {
    addTrigger('resume_boundary', 'turn crossed a resume boundary');
  }

  if (CAPTURE_RECOVERY_RE.test(trimmed)) {
    addTrigger('capture_failure', 'capture recovery is active');
  }

  if (STATE_MISMATCH_RE.test(trimmed)) {
    addTrigger('state_mismatch', 'state mismatch markers are present');
  }

  if (GATE_PENDING_RE.test(trimmed)) {
    addTrigger('gate_uncertainty', 'pending gate status is visible');
  }

  if (crossedResumeBoundary && (AWAIT_NODE_RE.test(trimmed) || RUNNING_SPAWN_RE.test(trimmed))) {
    addTrigger('spawn_uncertainty', 'spawn or await state is active during resume');
  }

  const escalated = triggerIds.length > 0;
  return {
    requestedMode: 'compact',
    actualMode: escalated ? 'full' : 'compact',
    escalated,
    triggerIds,
    summary:
      summaryParts.length > 0
        ? summaryParts.join('; ')
        : 'no high-risk context detected for compact rendering',
  };
}
