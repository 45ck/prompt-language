/**
 * shouldEscalateToFullMode — pure domain function that inspects a SessionState
 * and determines whether compact rendering should be escalated to full mode.
 *
 * Returns an object with the escalation decision, trigger IDs, and a
 * human-readable reason. Uses the same trigger vocabulary as the design doc
 * (docs/design/context-adaptive-recovery-fallback.md).
 */

import type { FlowNode } from './flow-node.js';
import type { SessionState } from './session-state.js';

export type EscalationTriggerId =
  | 'resume_boundary'
  | 'host_compaction_boundary'
  | 'spawn_recovery'
  | 'retry_failure'
  | 'variable_density';

export interface EscalationDecision {
  readonly escalate: boolean;
  readonly reason: string;
  readonly triggerIds: readonly EscalationTriggerId[];
}

/** Threshold: escalate when variable count exceeds this. */
const VARIABLE_DENSITY_THRESHOLD = 20;

/**
 * Walk the path through the flow tree, collecting ancestor node kinds.
 * Returns node kinds from root to the current node (exclusive of the
 * current node itself for ancestor checks).
 */
function collectAncestorKinds(
  nodes: readonly FlowNode[],
  path: readonly number[],
): readonly string[] {
  const kinds: string[] = [];
  let current: readonly FlowNode[] = nodes;

  for (let depth = 0; depth < path.length - 1; depth++) {
    const idx = path[depth]!;
    const node = current[idx];
    if (!node) break;
    kinds.push(node.kind);
    current = getChildren(node);
  }

  return kinds;
}

/** Get child nodes for container node types. */
function getChildren(node: FlowNode): readonly FlowNode[] {
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
    case 'foreach':
    case 'foreach_spawn':
    case 'spawn':
    case 'review':
      return node.body;
    case 'if':
      return [...node.thenBranch, ...node.elseBranch];
    case 'try':
      return [...node.body, ...(node.catchBody ?? []), ...(node.finallyBody ?? [])];
    case 'race':
      return node.children.flatMap((c) => c.body);
    default:
      return [];
  }
}

/**
 * Check whether the flow was resumed after compaction.
 * The pre-compact hook stores a heartbeat in the state. If the sessionId
 * differs from the state's sessionId, that indicates a resumed session.
 */
function hasResumeBoundary(state: SessionState, currentSessionId?: string): boolean {
  if (currentSessionId == null) return false;
  return state.sessionId !== currentSessionId;
}

/** Check for active try/catch blocks in the current path ancestry. */
function hasActiveTryCatch(state: SessionState): boolean {
  const ancestors = collectAncestorKinds(state.flowSpec.nodes, state.currentNodePath);
  return ancestors.includes('try');
}

/** Check for active spawn/await: running spawned children or await in path. */
function hasActiveSpawnOrAwait(state: SessionState): boolean {
  const hasRunningChildren = Object.values(state.spawnedChildren).some(
    (child) => child.status === 'running',
  );
  if (hasRunningChildren) return true;

  // Also check if current node is an await or if spawn/race is an ancestor
  const ancestors = collectAncestorKinds(state.flowSpec.nodes, state.currentNodePath);
  return ancestors.includes('spawn') || ancestors.includes('race');
}

/** Check if we're in a retry loop where the previous attempt failed. */
function hasRetryWithFailure(state: SessionState): boolean {
  const ancestors = collectAncestorKinds(state.flowSpec.nodes, state.currentNodePath);
  if (!ancestors.includes('retry')) return false;

  // Check if command_failed is set (indicating previous attempt failed)
  const commandFailed = state.variables['command_failed'];
  if (commandFailed === true || commandFailed === 'true') return true;

  // Check nodeProgress for retry nodes that have iterated past attempt 1
  for (const progress of Object.values(state.nodeProgress)) {
    if (progress.status === 'running' && progress.iteration > 1 && progress.maxIterations > 1) {
      return true;
    }
  }

  return false;
}

/** Check if variable count exceeds the density threshold. */
function hasHighVariableDensity(state: SessionState): boolean {
  const varCount = Object.keys(state.variables).length;
  return varCount > VARIABLE_DENSITY_THRESHOLD;
}

export function shouldEscalateToFullMode(
  state: SessionState,
  currentSessionId?: string,
): EscalationDecision {
  if (state.status !== 'active') {
    return { escalate: false, reason: 'flow is not active', triggerIds: [] };
  }

  const triggerIds: EscalationTriggerId[] = [];
  const reasons: string[] = [];

  if (hasResumeBoundary(state, currentSessionId)) {
    triggerIds.push('resume_boundary');
    reasons.push('flow resumed after session change');
  }

  if (hasActiveTryCatch(state)) {
    triggerIds.push('host_compaction_boundary');
    reasons.push('active try/catch block requires error recovery context');
  }

  if (hasActiveSpawnOrAwait(state)) {
    triggerIds.push('spawn_recovery');
    reasons.push('active spawn/await state is complex');
  }

  if (hasRetryWithFailure(state)) {
    triggerIds.push('retry_failure');
    reasons.push('retry loop with previous failure');
  }

  if (hasHighVariableDensity(state)) {
    triggerIds.push('variable_density');
    reasons.push(`variable count exceeds ${VARIABLE_DENSITY_THRESHOLD}`);
  }

  const escalate = triggerIds.length > 0;
  return {
    escalate,
    reason: escalate ? reasons.join('; ') : 'no escalation triggers detected',
    triggerIds,
  };
}
