/**
 * EvaluateStop — Stop hook use case.
 *
 * Blocks the stop if a flow is active and not yet complete.
 */

import { isFlowComplete } from '../domain/session-state.js';
import type { StateStore } from './ports/state-store.js';

export interface EvaluateStopOutput {
  readonly blocked: boolean;
  readonly reason: string;
}

export async function evaluateStop(stateStore: StateStore): Promise<EvaluateStopOutput> {
  const state = await stateStore.loadCurrent();

  if (!state) {
    return { blocked: false, reason: '' };
  }

  if (isFlowComplete(state)) {
    return { blocked: false, reason: '' };
  }

  const goal = state.flowSpec.goal;
  const path = state.currentNodePath.join('.');
  return {
    blocked: true,
    reason:
      `Flow "${goal}" is still active at step [${path}]. ` +
      'Complete all steps and pass completion gates before stopping.',
  };
}
